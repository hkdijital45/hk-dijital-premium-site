// HK Admin push service worker. Scope is set to /hk-admin/ at
// registration time (src/lib/notifications/client.ts) — this file lives
// at the site root only because a service worker's default scope is its
// own directory, and registering a narrower scope than that needs no
// extra server header. It intentionally has NO "fetch" handler: it never
// caches anything (not admin API responses, not auth tokens, not static
// assets) — its only job is push notifications.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "HK Admin", body: event.data.text() };
  }
  const title = payload.title || "HK Admin";
  const options = {
    body: payload.body || "",
    icon: "/branding/hk-dijital-logo.png",
    badge: "/branding/hk-dijital-logo.png",
    data: { deepLink: payload.deepLink || "/hk-admin", notificationId: payload.notificationId || null },
    tag: payload.notificationId || undefined
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || "/hk-admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/hk-admin") && "focus" in client) {
          client.navigate(deepLink);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(deepLink);
    })
  );
});
