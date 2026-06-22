import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { WSMessage } from '../types/game';

interface UseWebSocketOptions {
  url?: string;
  onMessage?: (msg: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_RECONNECT_INTERVAL = 3000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
  const url = options.url || baseUrl;

  const [ws, setWs] = createSignal<WebSocket | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [lastMessage, setLastMessage] = createSignal<WSMessage | null>(null);
  const [reconnectCount, setReconnectCount] = createSignal(0);
  const [isManualClose, setIsManualClose] = createSignal(false);

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const reconnectInterval = options.reconnectInterval || DEFAULT_RECONNECT_INTERVAL;
  const maxReconnectAttempts = options.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;

  const connect = (playerId?: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      setIsManualClose(false);
      const fullUrl = playerId ? `${url}?playerId=${playerId}` : url;
      const socket = new WebSocket(fullUrl);

      const timeoutId = setTimeout(() => {
        reject(new Error('WebSocket连接超时'));
      }, 10000);

      socket.onopen = () => {
        clearTimeout(timeoutId);
        setIsConnected(true);
        setReconnectCount(0);
        setWs(socket);
        options.onOpen?.();
        resolve(socket);
      };

      socket.onclose = () => {
        clearTimeout(timeoutId);
        setIsConnected(false);
        setWs(null);
        options.onClose?.();

        const shouldReconnect = !isManualClose()
          && reconnectCount() < maxReconnectAttempts;

        if (shouldReconnect) {
          reconnectTimer = setTimeout(() => {
            setReconnectCount((c) => c + 1);
            connect(playerId).catch(() => {});
          }, reconnectInterval);
        }
      };

      socket.onerror = (event) => {
        clearTimeout(timeoutId);
        options.onError?.(event);
        reject(event);
      };

      socket.onmessage = (event) => {
        try {
          const data: WSMessage = typeof event.data === 'string'
            ? JSON.parse(event.data)
            : event.data;
          setLastMessage(data);
          options.onMessage?.(data);
        } catch (e) {
          console.error('解析WebSocket消息失败:', e, event.data);
        }
      };
    });
  };

  const disconnect = () => {
    setIsManualClose(true);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const socket = ws();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    setWs(null);
    setIsConnected(false);
  };

  const send = (type: string, data: any = {}): boolean => {
    const socket = ws();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  };

  const reconnect = (playerId?: string) => {
    disconnect();
    return connect(playerId);
  };

  createEffect(() => {
    if (options.autoConnect && !ws()) {
      connect().catch(() => {});
    }
  });

  onCleanup(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    disconnect();
  });

  return {
    ws,
    isConnected,
    lastMessage,
    reconnectCount,
    connect,
    disconnect,
    send,
    reconnect,
  };
}

export default useWebSocket;
