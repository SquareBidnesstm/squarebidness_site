self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "New Booking", body: event.data.text() }; }

  const title = data.title || "SquareBidness";
  const options = {
    body: data.body || "",
    icon: "/booking-192.png",
    badge: "/booking-32.png",
    data: { url: data.url || "/" },
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
