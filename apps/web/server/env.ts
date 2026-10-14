import type { GameRoom } from "./gameRoom";

/** What the Worker is given (apps/web/wrangler.jsonc). */
export interface Env {
  /** The built game (static files). */
  ASSETS: Fetcher;
  /** One room per online game. */
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  /** Accounts, games and seats. */
  DB: D1Database;
  /** The Access team domain (keel-nkurtz.cloudflareaccess.com). */
  ACCESS_TEAM: string;
  /** The Conquerra Access app's AUD tag (Nate sets it: docs/infra-cloudflare.md). Empty: online play is off. */
  ACCESS_AUD?: string;
  /** Local development only (`wrangler dev`, from .dev.vars): the email to sign in as on localhost. */
  DEV_EMAIL?: string;
}
