import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { WS_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const SocketContext = createContext({ connected: false, subscribe: () => () => {}, send: () => {} });

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const listeners = useRef(new Set());
  const retryRef = useRef(0);
  const timerRef = useRef(null);
  const pingRef = useRef(null);
  const activeRef = useRef(false);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!token || !user) {
      activeRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return undefined;
    }
    activeRef.current = true;

    const connect = () => {
      if (!activeRef.current) return;
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch (e) {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        // the token travels in the first frame, never in the URL (URLs end up in server / proxy logs)
        ws.send(JSON.stringify({ type: "auth", token }));
        retryRef.current = 0;
        setConnected(true);
        clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };
      ws.onmessage = (ev) => {
        let data;
        try {
          data = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        if (data.type === "pong") return;
        listeners.current.forEach((fn) => {
          try {
            fn(data);
          } catch (e) {
            // ignore listener errors
          }
        });
      };
      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingRef.current);
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch (e) {
          // noop
        }
      };
    };

    const scheduleReconnect = () => {
      if (!activeRef.current) return;
      clearTimeout(timerRef.current);
      const delay = Math.min(15000, 1000 * 2 ** retryRef.current);
      retryRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    connect();
    return () => {
      activeRef.current = false;
      clearTimeout(timerRef.current);
      clearInterval(pingRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const value = useMemo(() => ({ connected, subscribe, send }), [connected, subscribe, send]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
