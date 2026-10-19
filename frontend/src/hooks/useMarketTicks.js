import { io } from "socket.io-client";
import { useRef, useState, useEffect, useCallback } from "react";

export function useMarketTicks(url, opts = {}) {
  const socket = useRef(null);
  // RAW DATA STORE (0ms latency): Mutable Map to store latest ticks
  const ticksRef = useRef(new Map());
  const [isConnected, setIsConnected] = useState(false);

  // Track all active subscriptions: Map of instrument_token -> subscriptionType
  const activeSubscriptionsRef = useRef(new Map());
  const lastMessageTimeRef = useRef(Date.now());

  // Store opts in ref to avoid recreating socket on every render
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  // Stable subscribe function (wrapped in useCallback)
  const subscribe = useCallback(async (list, subscriptionType = 'full') => {
    if (list && list.length > 0) {
      list.forEach(item => {
        if (item && item.instrument_token) {
          activeSubscriptionsRef.current.set(String(item.instrument_token), subscriptionType);
        }
      });
    }

    if (socket.current?.connected) {
      socket.current.emit("subscribe", list, subscriptionType);
    } else {
      console.warn("[useMarketTicks] Subscribe called while socket is not connected.");
    }
  }, []);

  // Stable unsubscribe function (wrapped in useCallback)
  const unsubscribe = useCallback(async (list, subscriptionType = 'full') => {
    if (list && list.length > 0) {
      list.forEach(item => {
        if (item && item.instrument_token) {
          activeSubscriptionsRef.current.delete(String(item.instrument_token));
        }
      });
    }

    if (socket.current?.connected) {
      socket.current.emit("unsubscribe", list, subscriptionType);
    }
  }, []);

  // INSTANT refresh - called immediately when user returns to tab
  const refreshSubscriptions = useCallback(() => {
    if (socket.current?.connected && activeSubscriptionsRef.current.size > 0) {
      console.log("[useMarketTicks] INSTANT refresh on tab return/reconnect for", activeSubscriptionsRef.current.size, "tokens");
      
      // Group by subscriptionType
      const groups = {};
      activeSubscriptionsRef.current.forEach((type, token) => {
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push({ instrument_token: token });
      });

      // Emit subscribe for each group
      Object.entries(groups).forEach(([type, list]) => {
        socket.current.emit("subscribe", list, type);
      });
    }
  }, []);

  // Handle visibility change - INSTANT refresh when tab becomes visible
  useEffect(() => {
    const checkAndRefresh = () => {
      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
      console.log(`[useMarketTicks] Tab active check. Time since last message: ${timeSinceLastMessage}ms`);

      if (!socket.current?.connected) {
        console.log("[useMarketTicks] Socket not connected, connecting...");
        socket.current?.connect();
      } else if (timeSinceLastMessage > 5000) {
        console.log("[useMarketTicks] Possible zombie connection (no messages for >5s). Forcing reconnect...");
        socket.current?.disconnect();
        socket.current?.connect();
      } else {
        console.log("[useMarketTicks] Connection active. Refreshing subscriptions...");
        refreshSubscriptions();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAndRefresh();
      }
    };

    const handleFocus = () => {
      checkAndRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshSubscriptions]);

  // Effect for socket setup and cleanup
  useEffect(() => {
    console.log("[useMarketTicks] Creating socket connection...");

    const newSocket = io(url, {
      ...optsRef.current,
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 5000,
    });
    socket.current = newSocket;

    const onConnect = () => {
      console.log("✅ market connected:", newSocket.id);
      setIsConnected(true);

      // Instant re-subscribe on reconnect
      if (activeSubscriptionsRef.current.size > 0) {
        console.log("[useMarketTicks] Re-subscribing after reconnect");
        
        const groups = {};
        activeSubscriptionsRef.current.forEach((type, token) => {
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push({ instrument_token: token });
        });

        Object.entries(groups).forEach(([type, list]) => {
          newSocket.emit("subscribe", list, type);
        });
      }
    };

    const onDisconnect = (reason) => {
      console.log("❌ market disconnected:", reason);
      setIsConnected(false);
    };

    const onMarketUpdate = (update) => {
      lastMessageTimeRef.current = Date.now();
      // Kite format: use instrument_token as key
      if (update?.instrument_token !== undefined) {
        // DIRECT MUTATION (0ms latency): Update the Ref instantly
        // No React State update = No Re-render per tick
        const key = String(update.instrument_token);
        const existing = ticksRef.current.get(key) || {};
        ticksRef.current.set(key, { ...existing, ...update });
      }
    };

    const onCustomerJobbingUpdated = (data) => {
      // Broadcast globally to any open components containing jobbing inputs
      console.log("[useMarketTicks] Received customer_jobbing_updated:", data);
      window.dispatchEvent(new CustomEvent('customer_jobbing_updated', { detail: data }));
    };

    newSocket.on("connect", onConnect);
    newSocket.on("market_update", onMarketUpdate);
    newSocket.on("customer_jobbing_updated", onCustomerJobbingUpdated);
    newSocket.on("index_update", onMarketUpdate);
    newSocket.on("ticker_update", onMarketUpdate);
    newSocket.on("quote_update", onMarketUpdate);
    newSocket.on("oi_update", onMarketUpdate);
    newSocket.on("prev_close_update", onMarketUpdate);
    newSocket.on("market_status_update", onMarketUpdate);
    newSocket.on("disconnect", onDisconnect);

    return () => {
      console.log("[useMarketTicks] Disconnecting socket");
      newSocket.off("connect", onConnect);
      newSocket.off("market_update", onMarketUpdate);
      newSocket.off("customer_jobbing_updated", onCustomerJobbingUpdated);
      newSocket.off("index_update", onMarketUpdate);
      newSocket.off("ticker_update", onMarketUpdate);
      newSocket.off("quote_update", onMarketUpdate);
      newSocket.off("oi_update", onMarketUpdate);
      newSocket.off("prev_close_update", onMarketUpdate);
      newSocket.off("market_status_update", onMarketUpdate);
      newSocket.off("disconnect", onDisconnect);
      newSocket.disconnect();
      socket.current = null;
    };
  }, [url]);

  return {
    ticksRef, // Expose the Ref directly for consumers to poll
    subscribe,
    unsubscribe,
    isConnected,
    refreshSubscriptions
  };
}
