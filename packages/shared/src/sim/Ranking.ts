export interface RankInput {
  seat: number;
  balance: number;
  alive: boolean;
  eliminatedTick: number | null;
}

export const rankSeats = (entries: readonly RankInput[]): number[] => {
  const alive = entries
    .filter((entry) => entry.alive)
    .sort((a, b) => b.balance - a.balance || a.seat - b.seat);
  const dead = entries
    .filter((entry) => !entry.alive)
    .sort(
      (a, b) =>
        (b.eliminatedTick ?? 0) - (a.eliminatedTick ?? 0) || a.seat - b.seat,
    );
  return [...alive, ...dead].map((entry) => entry.seat);
};

export const ranksBySeat = (entries: readonly RankInput[]): number[] => {
  const ranks = new Array<number>(entries.length).fill(0);
  rankSeats(entries).forEach((seat, index) => {
    ranks[seat] = index + 1;
  });
  return ranks;
};
