/*
 * Session 29: "your turn" pushes, inside the app's own service worker (the generated one loads this with
 * importScripts, so its caching and "Update ready" stay exactly as they were). The message is the room's, encrypted
 * for this browser: "Your turn in Conquerra" and "Embervale, turn 12", and the game's link. A tap opens the game.
 */
self.addEventListener("push", (event) => {
  let m = {};
  try {
    m = event.data ? event.data.json() : {};
  } catch {
    m = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(m.title || "Conquerra", {
      body: m.body || "",
      tag: m.tag || "conquerra",
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-64.png",
      data: { url: m.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // The game open in a tab already: bring it forward. Otherwise open it.
      for (const w of wins) if (w.url === url && "focus" in w) return w.focus();
      for (const w of wins) if ("navigate" in w && "focus" in w) return w.navigate(url).then((c) => (c || w).focus());
      return self.clients.openWindow(url);
    }),
  );
});
