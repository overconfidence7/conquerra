import { worker } from "./api";
import type { Env } from "./env";

/**
 * The Worker `conquerra` (session 26): the game's static files, the online API (./api.ts) and the game rooms
 * (./gameRoom.ts, one Durable Object per online game).
 */
export { GameRoom } from "./gameRoom";

export default worker satisfies ExportedHandler<Env>;
