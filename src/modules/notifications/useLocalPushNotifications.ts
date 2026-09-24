// src/modules/notifications/useLocalPushNotifications.ts
// Hook to listen to local Wi-Fi WebSocket push notifications on port 8080

import { useEffect, useState, useCallback } from 'react';

export interface PushNotificationMessage {
  title: string;
  message: string;
  timestamp: string;
}

export function useLocalPushNotifications() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<PushNotificationMessage | null>(null);
  const [notifications, setNotifications] = useState<PushNotificationMessage[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNotification = useCallback((title: string, message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Native notification error:', err);
      }
    }
  }, []);

  useEffect(() => {
    const host = window.location.hostname || '10.1.201.165';
    const wsUrl = `ws://${host}:8080`;
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') return;

            const notif: PushNotificationMessage = {
              title: data.title || 'NER-Connect Push',
              message: data.message || '',
              timestamp: data.timestamp || new Date().toISOString(),
            };

            setLastNotification(notif);
            setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
            showNotification(notif.title, notif.message);
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        socket.onerror = () => {
          if (socket) socket.close();
        };
      } catch (e) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [showNotification]);

  return {
    isConnected,
    permission,
    requestPermission,
    lastNotification,
    notifications,
  };
}
