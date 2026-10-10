// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BumpArena is EIP712, ReentrancyGuard, Ownable2Step, Pausable {
    enum Status {
        None,
        Open,
        Started,
        Settled,
        Cancelled,
        Refunding
    }

    struct Result {
        bytes32 matchId;
        address[] players;
        uint32[] finalBalances;
        uint8[] ranks;
        bytes32 inputLogHash;
        bytes32 replayHash;
        uint64 endedAt;
    }

    struct JoinIntent {
        bytes32 matchId;
        address player;
        address sessionKey;
        uint8 vehicleId;
        uint256 deadline;
    }

    struct MatchView {
        uint256 stake;
        uint32 startBalance;
        uint8 maxPlayers;
        uint8 playerCount;
        Status status;
        uint64 joinDeadline;
        uint64 settleDeadline;
        uint256 pot;
    }

    struct Match {
        uint256 stake;
        uint256 pot;
        uint32 startBalance;
        uint8 maxPlayers;
        Status status;
        uint64 joinDeadline;
        uint64 settleDeadline;
        address[] players;
        mapping(address => address) sessionKeys;
        mapping(address => uint8) vehicles;
        mapping(address => bool) joined;
        mapping(address => bool) refunded;
    }

    bytes32 public constant RESULT_TYPEHASH = keccak256(
        "Result(bytes32 matchId,address[] players,uint32[] finalBalances,uint8[] ranks,bytes32 inputLogHash,bytes32 replayHash,uint64 endedAt)"
    );

    bytes32 public constant JOIN_INTENT_TYPEHASH =
        keccak256("JoinIntent(bytes32 matchId,address player,address sessionKey,uint8 vehicleId,uint256 deadline)");

    uint8 public constant VEHICLE_COUNT = 7;
    uint8 public constant MAX_PLAYERS_LIMIT = 8;

    address public signer;
    address public operator;
    address public treasury;
    uint64 public immutable settleWindow;
    IERC20 public immutable token;

    mapping(bytes32 => Match) private matches;

    event MatchOpened(
        bytes32 indexed matchId,
        uint256 stake,
        uint8 maxPlayers,
        uint32 startBalance,
        uint64 joinDeadline,
        uint64 settleDeadline
    );
    event PlayerJoined(
        bytes32 indexed matchId, address indexed player, address sessionKey, uint8 vehicleId, uint8 seat
    );
    event MatchStarted(bytes32 indexed matchId, uint8 playerCount);
    event PlayerResult(
        bytes32 indexed matchId, address indexed player, uint32 finalBalance, uint8 rank, uint256 payout
    );
    event MatchSettled(
        bytes32 indexed matchId,
        bytes32 resultHash,
        bytes32 inputLogHash,
        bytes32 replayHash,
        address winner,
        uint256 pot
    );
    event MatchCancelled(bytes32 indexed matchId);
    event Refunded(bytes32 indexed matchId, address indexed player, uint256 amount);
    event SignerUpdated(address signer);
    event OperatorUpdated(address operator);
    event TreasuryUpdated(address treasury);

    error NotOperator();
    error BadStatus();
    error JoinClosed();
    error IntentExpired();
    error MatchFull();
    error AlreadyJoined();
    error ZeroSessionKey();
    error BadVehicle();
    error NotEnoughPlayers();
    error PlayersMismatch();
    error BalanceSumMismatch();
    error BadRanks();
    error BadSignature();
    error SettleWindowClosed();
    error TooEarly();
    error NotJoined();
    error AlreadyRefunded();
    error MatchExists();
    error InvalidMatchParams();
    error ZeroAddress();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(
        address owner_,
        address signer_,
        address operator_,
        address treasury_,
        uint64 settleWindow_,
        address token_
    ) EIP712("BumpArena", "1") Ownable(owner_) {
        if (signer_ == address(0) || operator_ == address(0) || treasury_ == address(0) || token_ == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(token_);
        signer = signer_;
        operator = operator_;
        treasury = treasury_;
        settleWindow = settleWindow_;
    }

    function openMatch(bytes32 matchId, uint256 stake, uint8 maxPlayers, uint32 startBalance, uint64 joinDeadline)
        external
        onlyOperator
        whenNotPaused
    {
        Match storage m = matches[matchId];
        if (m.status != Status.None) revert MatchExists();
        if (
            stake == 0 || maxPlayers < 2 || maxPlayers > MAX_PLAYERS_LIMIT || startBalance == 0
                || joinDeadline <= block.timestamp
        ) revert InvalidMatchParams();

        uint64 settleDeadline = joinDeadline + settleWindow;
        m.stake = stake;
        m.startBalance = startBalance;
        m.maxPlayers = maxPlayers;
        m.status = Status.Open;
        m.joinDeadline = joinDeadline;
        m.settleDeadline = settleDeadline;

        emit MatchOpened(matchId, stake, maxPlayers, startBalance, joinDeadline, settleDeadline);
    }

    function join(bytes32 matchId, address sessionKey, uint8 vehicleId) external nonReentrant whenNotPaused {
        _join(matchId, msg.sender, sessionKey, vehicleId);
    }

    function joinWithSig(JoinIntent calldata intent, bytes calldata signature) external nonReentrant whenNotPaused {
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (ECDSA.recover(hashJoin(intent), signature) != intent.player) revert BadSignature();
        _join(intent.matchId, intent.player, intent.sessionKey, intent.vehicleId);
    }

    function _join(bytes32 matchId, address player, address sessionKey, uint8 vehicleId) private {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert BadStatus();
        if (block.timestamp > m.joinDeadline) revert JoinClosed();
        uint8 seat = uint8(m.players.length);
        if (seat >= m.maxPlayers) revert MatchFull();
        if (m.joined[player]) revert AlreadyJoined();
        if (sessionKey == address(0)) revert ZeroSessionKey();
        if (vehicleId >= VEHICLE_COUNT) revert BadVehicle();

        uint256 stake = m.stake;
        m.joined[player] = true;
        m.sessionKeys[player] = sessionKey;
        m.vehicles[player] = vehicleId;
        m.players.push(player);
        m.pot += stake;

        SafeERC20.safeTransferFrom(token, player, address(this), stake);

        emit PlayerJoined(matchId, player, sessionKey, vehicleId, seat);
    }

    function startMatch(bytes32 matchId) external onlyOperator whenNotPaused {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert BadStatus();
        uint8 count = uint8(m.players.length);
        if (count < 2) revert NotEnoughPlayers();
        m.status = Status.Started;
        emit MatchStarted(matchId, count);
    }

    function settle(Result calldata result, bytes calldata signature) external nonReentrant whenNotPaused {
        Match storage m = matches[result.matchId];
        if (m.status != Status.Started) revert BadStatus();
        if (block.timestamp > m.settleDeadline) revert SettleWindowClosed();

        uint256 n = m.players.length;
        if (result.players.length != n || result.finalBalances.length != n || result.ranks.length != n) {
            revert PlayersMismatch();
        }
        for (uint256 i; i < n; ++i) {
            if (result.players[i] != m.players[i]) revert PlayersMismatch();
        }

        uint256 balanceSum = 0;
        uint256 rankBitmap = 0;
        for (uint256 i; i < n; ++i) {
            balanceSum += result.finalBalances[i];
            uint8 rank = result.ranks[i];
            if (rank == 0 || rank > n) revert BadRanks();
            uint256 bit = 1 << rank;
            if (rankBitmap & bit != 0) revert BadRanks();
            rankBitmap |= bit;
        }
        if (balanceSum != n * m.startBalance) revert BalanceSumMismatch();

        bytes32 digest = hashResult(result);
        if (ECDSA.recover(digest, signature) != signer) revert BadSignature();

        m.status = Status.Settled;

        (uint256 paid, address winner) = _payOut(result, m.stake, m.startBalance);
        uint256 pot = m.pot;
        uint256 dust = pot - paid;
        if (dust != 0) SafeERC20.safeTransfer(token, treasury, dust);

        emit MatchSettled(result.matchId, digest, result.inputLogHash, result.replayHash, winner, pot);
    }

    function _payOut(Result calldata result, uint256 stake, uint256 startBalance)
        private
        returns (uint256 paid, address winner)
    {
        uint256 n = result.players.length;
        for (uint256 i; i < n; ++i) {
            address player = result.players[i];
            uint32 finalBalance = result.finalBalances[i];
            uint8 rank = result.ranks[i];
            uint256 payout = stake * finalBalance / startBalance;
            paid += payout;
            if (payout != 0) SafeERC20.safeTransfer(token, player, payout);
            if (rank == 1) winner = player;
            emit PlayerResult(result.matchId, player, finalBalance, rank, payout);
        }
    }

    function cancel(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert BadStatus();
        uint256 n = m.players.length;
        if (msg.sender != operator && !(block.timestamp > m.joinDeadline && n < 2)) revert NotOperator();

        m.status = Status.Cancelled;
        uint256 stake = m.stake;
        for (uint256 i; i < n; ++i) {
            SafeERC20.safeTransfer(token, m.players[i], stake);
        }

        emit MatchCancelled(matchId);
    }

    function claimRefund(bytes32 matchId, address player) external nonReentrant {
        Match storage m = matches[matchId];
        Status status = m.status;
        if (status != Status.Open && status != Status.Started && status != Status.Refunding) revert BadStatus();
        if (block.timestamp <= m.settleDeadline) revert TooEarly();
        if (!m.joined[player]) revert NotJoined();
        if (m.refunded[player]) revert AlreadyRefunded();

        m.refunded[player] = true;
        m.status = Status.Refunding;
        uint256 stake = m.stake;
        SafeERC20.safeTransfer(token, player, stake);

        emit Refunded(matchId, player, stake);
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getMatch(bytes32 matchId) external view returns (MatchView memory) {
        Match storage m = matches[matchId];
        return MatchView({
            stake: m.stake,
            startBalance: m.startBalance,
            maxPlayers: m.maxPlayers,
            playerCount: uint8(m.players.length),
            status: m.status,
            joinDeadline: m.joinDeadline,
            settleDeadline: m.settleDeadline,
            pot: m.pot
        });
    }

    function getPlayers(bytes32 matchId) external view returns (address[] memory) {
        return matches[matchId].players;
    }

    function sessionKeyOf(bytes32 matchId, address player) external view returns (address) {
        return matches[matchId].sessionKeys[player];
    }

    function vehicleOf(bytes32 matchId, address player) external view returns (uint8) {
        return matches[matchId].vehicles[player];
    }

    function hashResult(Result calldata result) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    RESULT_TYPEHASH,
                    result.matchId,
                    keccak256(abi.encodePacked(result.players)),
                    keccak256(abi.encodePacked(result.finalBalances)),
                    keccak256(abi.encodePacked(result.ranks)),
                    result.inputLogHash,
                    result.replayHash,
                    result.endedAt
                )
            )
        );
    }

    function hashJoin(JoinIntent calldata intent) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    JOIN_INTENT_TYPEHASH,
                    intent.matchId,
                    intent.player,
                    intent.sessionKey,
                    intent.vehicleId,
                    intent.deadline
                )
            )
        );
    }
}
