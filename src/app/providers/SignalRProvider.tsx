import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '@/app/providers/AuthProvider';

interface SignalRContextType {
  connection: HubConnection | null;
  isConnected: boolean;
  startConnection: () => Promise<void>;
  stopConnection: () => Promise<void>;
  onNotification: (callback: (notification: any) => void) => () => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

const HUB_URL = import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs/notifications';

export function SignalRProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken } = useAuth();
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const startConnection = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    if (connection?.state === 'Connected') return;

    try {
      const newConnection = new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => accessToken,
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(LogLevel.Information)
        .build();

      newConnection.on('NotificationReceived', (notification: any) => {
        console.log('Notification received:', notification);
      });

      newConnection.onclose(async (error) => {
        setIsConnected(false);
        if (error) {
          console.warn('SignalR connection closed:', error);
        }
      });

      newConnection.onreconnecting(() => {
        setIsConnected(false);
      });

      newConnection.onreconnected(() => {
        setIsConnected(true);
      });

      await newConnection.start();
      setIsConnected(true);
      setConnection(newConnection);
    } catch (error) {
      console.error('SignalR connection failed:', error);
      setIsConnected(false);
    }
  }, [isAuthenticated, accessToken, connection]);

  const stopConnection = useCallback(async () => {
    if (connection) {
      await connection.stop();
      setIsConnected(false);
      setConnection(null);
    }
  }, [connection]);

  const onNotification = useCallback((callback: (notification: any) => void) => {
    if (!connection) return () => {};
    connection.on('NotificationReceived', callback);
    return () => {
      connection.off('NotificationReceived', callback);
    };
  }, [connection]);

  useEffect(() => {
    if (isAuthenticated) {
      startConnection();
    } else {
      stopConnection();
    }
    return () => {
      stopConnection();
    };
  }, [isAuthenticated, startConnection, stopConnection]);

  return (
    <SignalRContext.Provider value={{ connection, isConnected, startConnection, stopConnection, onNotification }}>
      {children}
    </SignalRContext.Provider>
  );
}

export function useSignalR() {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
}