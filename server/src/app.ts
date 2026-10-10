import { ROOM_NAME } from "@bump/shared";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  createEndpoint,
  createRouter,
  defineRoom,
  defineServer,
  matchMaker,
} from "colyseus";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { RpcProxy } from "./relay/RpcProxy";
import { type RoomContext, setRoomContext } from "./rooms/context";

export const clientIp = (headers: Headers): string => {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    return (hops[hops.length - 1] ?? "").trim() || "unknown";
  }
  return "unknown";
};

export const createApp = (context: RoomContext) => {
  setRoomContext(context);
  const allowed = context.config.corsOrigins;
  matchMaker.controller.getCorsHeaders = (headers: Headers) => {
    const origin = headers.get("origin") ?? "";
    return {
      "Access-Control-Allow-Origin": allowed.includes(origin)
        ? origin
        : (allowed[0] ?? ""),
      Vary: "Origin",
    };
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const rpcProxy = context.config.solana
    ? new RpcProxy({
        url: context.config.solana.rpcUrl,
        now: context.now,
        perMinute: 1800,
      })
    : null;
  const board = context.leaderboard;
  const boardRoute = (path: string) =>
    createEndpoint(path, { method: "GET" }, async (ctx) => {
      const response = ctx.request
        ? await board?.handleRequest(ctx.request)
        : null;
      return response ?? json(404, { code: "NOT_FOUND" });
    });
  const boardRoutes: Record<string, ReturnType<typeof boardRoute>> = board
    ? {
        leaderboard: boardRoute("/leaderboard"),
        player: boardRoute("/players/:wallet"),
        matches: boardRoute("/matches"),
        match: boardRoute("/matches/:id"),
        ready: boardRoute("/ready"),
      }
    : {};
  return defineServer({
    transport: new WebSocketTransport(),
    rooms: {
      [ROOM_NAME]: defineRoom(ArenaRoom),
    },
    routes: createRouter({
      ...boardRoutes,
      metrics: createEndpoint("/metrics.json", { method: "GET" }, async () => {
        let relayerBalanceWei: string | null = null;
        try {
          relayerBalanceWei = (await context.guard.balance()).toString();
        } catch {
          relayerBalanceWei = null;
        }
        return { ...context.metrics.snapshot(), relayerBalanceWei };
      }),
      ...(rpcProxy
        ? {
            rpc: createEndpoint(
              "/rpc",
              {
                method: "POST",
                metadata: { allowedMediaTypes: ["application/json"] },
              },
              async (ctx) => {
                const result = await rpcProxy.handle(
                  ctx.body,
                  clientIp(ctx.request?.headers ?? new Headers()),
                );
                return json(result.status, result.body);
              },
            ),
          }
        : {}),
      health: createEndpoint("/health", { method: "GET" }, async () => ({
        ok: true,
        rooms: context.stats.rooms,
      })),
      faucet: createEndpoint(
        "/faucet",
        {
          method: "POST",
          metadata: { allowedMediaTypes: ["application/json"] },
        },
        async (ctx) => {
          const body = (ctx.body ?? {}) as { wallet?: unknown };
          const result = await context.faucet.claim(
            body.wallet,
            clientIp(ctx.request?.headers ?? new Headers()),
          );
          return json(result.status, result.body);
        },
      ),
      faucetStatus: createEndpoint(
        "/faucet/status",
        { method: "GET" },
        async (ctx) => {
          const wallet = new URL(
            ctx.request?.url ?? "http://x",
          ).searchParams.get("wallet");
          const result = await context.faucet.status(wallet);
          return json(result.status, result.body);
        },
      ),
    }),
  });
};
