import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** "0.1.0 · Oct 4 · 8b6d540": shown in Settings, so we can tell which version a phone is running. */
function buildLabel() {
  let commit = "local";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    // Not a git checkout.
  }
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${process.env.npm_package_version ?? "0.1.0"} · ${date} · ${commit}`;
}
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
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
        description: "A fantasy strategy game: set your orders, lock in, and watch every plan play out at once.",
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
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: { __BUILD__: JSON.stringify(buildLabel()) },
  worker: { format: "es" },
  server: { open: true },
});
