import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const HUB_URL = import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs/notifications';

let connection: HubConnection | null = null;
let accessTokenFactory: (() => string) | null = null;
let isStarting = false;
const notificationCallbacks: Array<(notification: any) => void> = [];

export function setAccessTokenFactory(factory: () => string) {
  accessTokenFactory = factory;
}

export function getConnection(): HubConnection | null {
  return connection;
}

export function isConnected(): boolean {
  return connection?.state === 'Connected';
}

export async function startConnection(): Promise<void> {
  if (connection?.state === 'Connected' || isStarting) {
    return;
  }

  if (!accessTokenFactory) {
    console.warn('SignalR: No access token factory set, skipping connection');
    return;
  }

  isStarting = true;

  try {
    connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('NotificationReceived', (notification: any) => {
      notificationCallbacks.forEach(cb => cb(notification));
    });

    connection.onclose(async (error) => {
      console.warn('SignalR connection closed:', error);
    });

    connection.onreconnecting(() => {
      console.log('SignalR reconnecting...');
    });

    connection.onreconnected(() => {
      console.log('SignalR reconnected');
    });

    await connection.start();
    console.log('SignalR connected');
  } catch (error) {
    console.error('SignalR connection failed:', error);
  } finally {
    isStarting = false;
  }
}

export async function stopConnection(): Promise<void> {
  if (connection) {
    await connection.stop();
    connection = null;
  }
}

export function onNotification(callback: (notification: any) => void): () => void {
  notificationCallbacks.push(callback);
  return () => {
    const index = notificationCallbacks.indexOf(callback);
    if (index > -1) {
      notificationCallbacks.splice(index, 1);
    }
  };
}