// Debug helper: joins the newest arena room as a passive client and prints the synced state.
import { Client } from "@colyseus/sdk";
import { MatchState } from "@bump/shared";
const url = process.argv[2] ?? "ws://localhost:2567";
const c = new Client(url);
const rooms: any[] = [];
console.log("rooms", rooms.map((r: any) => `${r.roomId}:${r.clients}`).join(","));
const r = { roomId: "" };
if (r) {
  const room = await c.joinOrCreate("arena", { vehicleId: 0 }, MatchState);
  room.onMessage("*", (t: any, p: any) => console.log("msg", t, JSON.stringify(p)?.slice(0, 200)));
  await new Promise((s) => setTimeout(s, 1500));
  const s: any = room.state;
  console.log(JSON.stringify({ phase: s.phase, fillEndsAt: s.fillEndsAt, joinDeadline: s.joinDeadline, cars: [...s.cars.keys()], lobby: s.lobby, matchId: s.matchId }));
  await room.leave();
}
process.exit(0);
