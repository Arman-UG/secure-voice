
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

// Handle incoming push notifications.
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
  } catch (error) {
    console.error('[push] Invalid JSON payload:', error);
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
          { action: 'accept', title: 'Accept' },
          { action: 'reject', title: 'Reject' },
        ],
      })
      .then(() => {
        console.log('[push] NOTIFICATION SHOW SUCCESS');
      })
      .catch((error) => {
        console.error('[push] NOTIFICATION SHOW FAILED:', error);
      })
  );
});

// Handle notification clicks and Accept/Reject actions.
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const callerNumber = notification.data?.callerNumber || '';

  notification.close();

  event.waitUntil(
    (async () => {
      const isCallAction =
        action === 'accept' || action === 'reject';

      const appUrl = new URL('/', self.location.origin);

      // Pass the action through the URL if a new window is needed.
      if (isCallAction) {
        appUrl.searchParams.set('callAction', action);

        if (callerNumber) {
          appUrl.searchParams.set('callerNumber', callerNumber);
        }
      }

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer focusing an existing app window.
      for (const client of windowClients) {
        if (new URL(client.url).origin !== self.location.origin) {
          continue;
        }

        await client.focus();

        if (isCallAction) {
          const messageChannel = new MessageChannel();

          const messageId =
            typeof self.crypto?.randomUUID === 'function'
              ? self.crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

          const ackPromise = new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              messageChannel.port1.close();

              console.warn(
                '[ACK] No acknowledgement within 3 seconds.'
              );

              resolve(false);
            }, 3000);

            messageChannel.port1.onmessage = (messageEvent) => {
              const ack = messageEvent.data;

              if (
                ack?.type === 'SECURE_VOICE_CALL_ACTION_ACK' &&
                ack.messageId === messageId
              ) {
                clearTimeout(timeoutId);
                messageChannel.port1.close();

                console.log(
                  '[ACK] React received the command.'
                );

                resolve(true);
              }
            };

            messageChannel.port1.start();
          });

          try {
            client.postMessage(
              {
                type: 'SECURE_VOICE_CALL_ACTION',
                action,
                callerNumber,
                messageId,
              },
              [messageChannel.port2]
            );
          } catch (error) {
            messageChannel.port1.close();

            console.error(
              '[ACK] Failed to send notification action:',
              error
            );

            return;
          }

          await ackPromise;
        }

        return;
      }

      // No existing app window: open the app.
      await self.clients.openWindow(appUrl.href);
    })().catch((error) => {
      console.error('[notificationclick] Failed:', error);
    })
  );
});

// Handle service-worker messages.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
