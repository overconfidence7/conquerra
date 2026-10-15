import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** "0.1.0 · Oct 4 · 8b6d540": shown in Settings, so we can tell which version a phone is running. */
function buildLabel() {
  // The stale-build check (scripts/s21-stale-build.mjs) builds a second, "newer" version under another label.
  if (process.env.CONQUERRA_BUILD) return process.env.CONQUERRA_BUILD;
  let commit = "local";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    // A build with uncommitted changes says so ("8b6d540+"): it isn't exactly that commit (deploys refuse one).
    if (execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()) commit += "+";
  } catch {
    // Not a git checkout.
  }
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${process.env.npm_package_version ?? "0.1.0"} · ${date} · ${commit}`;
}
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";
import { NETWORK_ONLY_NAVIGATIONS } from "./src/logic/freshness";
import catalog from "../../packages/content/data/maps/catalog.json";

// Each map's data is its own file (`loadMap`). Embervale and Greatmarch are cached for offline play up front, as
// before; the newer, bigger maps are cached the first time a game on them starts, so a phone's first visit doesn't
// download every map.
const LATER_MAPS = catalog.map((m) => m.id).filter((id) => id !== "embervale" && id !== "greatmarch");

const BUILD = buildLabel();

/**
 * `version.json`: which build is live (session 21). The app fetches it on every load, past the offline cache, and
 * compares it with the build it's running, so an old build can't hide behind an update check that failed.
 */
function versionFile(): Plugin {
  return {
    name: "conquerra-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify({ build: BUILD })}
` });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    versionFile(),
    // The installable app: a manifest (name, colours, icons) and offline caching, so single player works with no
    // connection after the first visit. New versions wait for "Update ready" instead of reloading mid-game.
    VitePWA({
      registerType: "prompt",
      // The preview sits behind Cloudflare Access: the manifest must be fetched with the login cookie, or the
      // browser gets the sign-in page instead and won't offer to install the app.
      useCredentials: true,
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon-64.png"],
      manifest: {
        name: "Conquerra",
        short_name: "Conquerra",
        description: "A fantasy strategy game: set your orders, lock in, and watch everyone's plans collide.",
        theme_color: "#0f1620",
        background_color: "#0f1620",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Everything the game needs, including the map art and the game engine's worker.
        globPatterns: ["**/*.{js,css,html,webp,png,svg,json,woff,woff2}"],
        // version.json is never cached: it's how the app finds out a newer build is live.
        globIgnores: [...LATER_MAPS.map((id) => `**/assets/${id}-*.js`), "version.json"],
        runtimeCaching: [
          // The game's sounds (session 24) aren't fetched up front: each is kept once it has played, and refreshed in the
          // background (a replaced sound keeps its name).
          {
            urlPattern: /\/sound\/[\w-]+\.mp3$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "sound", expiration: { maxEntries: 120 } },
          },
          {
            urlPattern: new RegExp(String.raw`/assets/(${LATER_MAPS.join("|")})-[\w-]+\.js$`),
            handler: "CacheFirst",
            options: { cacheName: "maps", expiration: { maxEntries: 40 } },
          },
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        // "Sign in again" and Cloudflare Access's own pages must reach the server, or the sign-in never happens.
        navigateFallbackDenylist: NETWORK_ONLY_NAVIGATIONS,
        cleanupOutdatedCaches: true,
        // Session 29: "your turn" pushes (public/push-sw.js), loaded into this same service worker: its caching and
        // updates stay exactly as generated, and the push code is a few plain lines beside them.
        importScripts: ["push-sw.js"],
      },
    }),
  ],
  define: { __BUILD__: JSON.stringify(BUILD) },
  worker: { format: "es" },
  server: { open: true },
});
