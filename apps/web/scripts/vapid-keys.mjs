// Session 29: make the room's VAPID key pair for "your turn" pushes.
//
//   node apps/web/scripts/vapid-keys.mjs
//
// The private half goes straight to Cloudflare as the secret VAPID_PRIVATE (`wrangler secret put`, through a pipe: it's
// never printed or written to a file). The public half is printed: put it in apps/web/wrangler.jsonc as VAPID_PUBLIC.
// Making a new pair means every browser has to turn "Tell me when it's my turn" on again (their subscriptions were
// made for the old public key), so run this only if the private key is ever lost or leaked.
import { spawn } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";

const b64u = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);

const child = spawn("npx", ["wrangler", "secret", "put", "VAPID_PRIVATE", "--config", "apps/web/wrangler.jsonc"], { stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" });
child.stdin.end(d);
const code = await new Promise((ok) => child.on("close", ok));
if (code !== 0) {
  console.error("The secret wasn't set (wrangler failed): nothing changed. The new pair is thrown away.");
  process.exit(1);
}
console.log(`\nVAPID_PUBLIC (put this in apps/web/wrangler.jsonc):\n${pub}`);
