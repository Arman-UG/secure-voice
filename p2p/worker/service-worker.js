import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  console.log('[push] EVENT RECEIVED', event);

  if (!event.data) {
    console.error('[push] No data in event');
    return;
  }

  console.log('[push] event.data', event.data.text());

  let data = {};

  try {
    data = event.data.json();
  } catch (_) {
    return;
  }

  if (data.type !== 'incoming-call') return;

  const callerName = data.callerName || 'Unknown';
  const callerNumber = data.callerNumber || '';

  event.waitUntil(
  self.registration
    .showNotification('Incoming Secure Voice Call', {
      body: `${callerName} (${callerNumber}) is calling you`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'secure-voice-incoming-call',
      renotify: true,
      requireInteraction: true,
      data: {
        type: 'incoming-call',
        callerName,
        callerNumber,
      },
      actions: [
        {
          action: 'open',
          title: 'Open Secure Voice',
        },
      ],
    })
    .then(() => {
      console.log('[push] NOTIFICATION SHOW SUCCESS');
    })
    .catch((err) => {
      console.error('[push] NOTIFICATION SHOW FAILED:', err);
    })
);
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});