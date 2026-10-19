// hooks/useOptionChain.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';

const apiBase = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8080';

const UNDERLYING_MAPPING = {
  'NIFTY 50': 'NIFTY',
  'NIFTY BANK': 'BANKNIFTY',
  'NIFTY FIN SERVICE': 'FINNIFTY',
  'NIFTY MID SELECT': 'MIDCPNIFTY',
  'NIFTY MIDCAP 100': 'MIDCPNIFTY',
  'SENSEX': 'SENSEX',
  'BANKEX': 'BANKEX',
  'BSE INDEX BANKEX': 'BANKEX'
};

/**
 * Custom hook to fetch and manage option chain data with live WebSocket updates
 * @param {Object} params - { name, segment, expiry }
 * @returns {Object} - { chainData, loading, error, spotPrice, expiries, refetch }
 */
export function useOptionChain({ name, segment, expiry }) {
  const [chainData, setChainData] = useState(null);
  const [spotPrice, setSpotPrice] = useState(null);
  const [spotInstrumentInfo, setSpotInstrumentInfo] = useState(null);
  const [expiries, setExpiries] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null); // The actual OPT segment from backend
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { ticksRef, subscribe, unsubscribe, isConnected } = useMarketData();

  // Track subscribed option tokens for cleanup
  const subscribedTokensRef = useRef([]);
  const lastFetchParamsRef = useRef(null);

  // Store instrument_token to chain position mapping for tick updates
  const tokenMapRef = useRef(new Map());

  /**
   * Fetch option chain data from backend
   */
  const fetchOptionChain = useCallback(async () => {
    if (!name) {
      console.warn('[useOptionChain] Missing required params: name');
      return;
    }

    const normalizedName = UNDERLYING_MAPPING[name] || name;
    const params = new URLSearchParams({ name: normalizedName });
    if (segment) params.append('segment', segment);
    if (expiry) params.append('expiry', expiry);

    const paramsKey = `${name}|${segment || 'auto'}|${expiry || 'nearest'}`;

    // Avoid duplicate fetches
    if (lastFetchParamsRef.current === paramsKey) {
      console.log('[useOptionChain] Skipping duplicate fetch');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('[useOptionChain] Fetching option chain:', { name, segment, expiry });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBase}/api/option-chain?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        // 404 means no expiries or no option data — not a real error, just no data
        if (response.status === 404) {
          console.log('[useOptionChain] No option data available:', errData.details || errData.error);
          setChainData([]);
          setError(null);
          lastFetchParamsRef.current = paramsKey;
          return null;
        }
        throw new Error(errData.details || errData.error || 'Failed to fetch option chain');
      }

      const result = await response.json();
      console.log('[useOptionChain] Received data:', {
        totalStrikes: result.data?.chain?.length,
        spotInstrumentInfo: result.data?.spotInstrumentInfo,
        expiry: result.data?.expiry
      });

      setChainData(result.data.chain);
      setSpotInstrumentInfo(result.data.spotInstrumentInfo);
      setActiveSegment(result.data.segment); // Set the normalized segment
      setSpotPrice(null); // Reset spot price until we get WebSocket update

      lastFetchParamsRef.current = paramsKey;
      return result.data;

    } catch (err) {
      console.error('[useOptionChain] Fetch error:', err);
      setError(err.message);
      setChainData(null);
    } finally {
      setLoading(false);
    }
  }, [name, segment, expiry]);

  /**
   * Fetch available expiry dates for the underlying
   */
  const fetchExpiries = useCallback(async () => {
    if (!name) return;

    const normalizedName = UNDERLYING_MAPPING[name] || name;
    const params = new URLSearchParams({ name: normalizedName });
    if (segment) params.append('segment', segment);

    console.log('[useOptionChain] Fetching expiries for:', name);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBase}/api/option-chain/expiries?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('[useOptionChain] Failed to fetch expiries');
        return;
      }

      const result = await response.json();
      console.log('[useOptionChain] Expiries received:', result.data?.expiries);
      setExpiries(result.data?.expiries || []);

    } catch (err) {
      console.warn('[useOptionChain] Expiries fetch error:', err);
    }
  }, [name, segment]);

  /**
   * Subscribe to live ticker data for all option strikes in the chain
   * Uses 'ticker' packet type for LTP-only updates (most efficient)
   */
  const subscribeToOptionStrikes = useCallback((chainArray) => {
    if (!chainArray || chainArray.length === 0 || !isConnected) {
      console.warn('[useOptionChain] Cannot subscribe - no chain data or socket disconnected');
      return;
    }

    // Build subscription list and token mapping
    const subscriptionList = [];
    const newTokenMap = new Map();

    chainArray.forEach((row, index) => {
      // Subscribe to CE (call) option if has instrument_token
      if (row.call?.instrument_token) {
        const token = String(row.call.instrument_token);
        subscriptionList.push({
          instrument_token: token
        });
        // Map token to chain position for tick updates
        newTokenMap.set(token, {
          index,
          type: 'call',
          strike: row.strike
        });
      }

      // Subscribe to PE (put) option if has instrument_token
      if (row.put?.instrument_token) {
        const token = String(row.put.instrument_token);
        subscriptionList.push({
          instrument_token: token
        });
        newTokenMap.set(token, {
          index,
          type: 'put',
          strike: row.strike
        });
      }
    });

    if (subscriptionList.length === 0) {
      console.warn('[useOptionChain] No instrument_tokens found in chain data');
      return;
    }

    // Store mapping for tick updates
    tokenMapRef.current = newTokenMap;

    // Store for cleanup
    subscribedTokensRef.current = subscriptionList;

    console.log(`[useOptionChain] Subscribing to ${subscriptionList.length} option contracts (quote mode)`);

    // Subscribe with 'quote' packet type for LTP and volume updates
    subscribe(subscriptionList, 'quote');

  }, [isConnected, subscribe]);

  /**
   * Unsubscribe from option strikes
   */
  const unsubscribeFromOptionStrikes = useCallback(() => {
    if (subscribedTokensRef.current.length === 0) return;

    console.log('[useOptionChain] Unsubscribing from', subscribedTokensRef.current.length, 'option contracts');

    unsubscribe(subscribedTokensRef.current, 'quote');

    // Clear tracking
    subscribedTokensRef.current = [];
    tokenMapRef.current.clear();
    lastFetchParamsRef.current = null;

  }, [unsubscribe]);

  /**
   * Initial fetch when params change
   */
  useEffect(() => {
    if (!name) return;

    // Unsubscribe from previous subscriptions
    unsubscribeFromOptionStrikes();

    fetchOptionChain().then(data => {
      if (data?.chain && isConnected) {
        subscribeToOptionStrikes(data.chain);
        
        // NEW: Subscribe to spot instrument if available
        if (data.spotInstrumentInfo?.token) {
          subscribe([{ instrument_token: data.spotInstrumentInfo.token }], 'ticker');
        }
      }
    });

    fetchExpiries();

    // Cleanup on unmount or param change
    return () => {
      unsubscribeFromOptionStrikes();
      // NEW: Unsubscribe from spot instrument if needed
      if (spotInstrumentInfo?.token) {
        unsubscribe([{ instrument_token: spotInstrumentInfo.token }], 'ticker');
      }
    };
  }, [name, segment, expiry, isConnected, fetchOptionChain, fetchExpiries, subscribeToOptionStrikes, unsubscribeFromOptionStrikes]);

  /**
   * Re-subscribe when socket reconnects
   */
  useEffect(() => {
    if (isConnected && chainData && subscribedTokensRef.current.length === 0) {
      console.log('[useOptionChain] Socket reconnected - re-subscribing');
      subscribeToOptionStrikes(chainData);
    }
  }, [isConnected, chainData, subscribeToOptionStrikes]);

  /**
   * Update chain data with live ticks from WebSocket
   * Maps incoming ticker updates to the correct CE/PE in the chain
   * Uses ref to track current chain to avoid dependency loop
   */
  const chainDataRef = useRef(chainData);
  useEffect(() => {
    chainDataRef.current = chainData;
  }, [chainData]);

  useEffect(() => {
    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 50; // Update UI max 20 times per second

    const updateLoop = (timestamp) => {
      // Throttle checks
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const ticks = ticksRef.current;
      if (!chainDataRef.current || chainDataRef.current.length === 0 || ticks.size === 0) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      if (tokenMapRef.current.size === 0) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      let hasUpdates = false;
      const currentChain = chainDataRef.current;

      const pendingUpdates = new Map(); // index -> { callLtp, callVolume, putLtp, putVolume }

      tokenMapRef.current.forEach((position, token) => {
        // Ticks are keyed by instrument_token directly (Kite format)
        const tick = ticks.get(token);

        if (tick?.ltp !== undefined && tick.ltp > 0) {
          const { index, type } = position;
          const row = currentChain[index];
          if (!row) return;

          const optionData = type === 'call' ? row.call : row.put;
          const currentLtp = optionData?.ltp;
          const currentVolume = optionData?.volume || 0;
          const tickVolume = tick.volume || 0;

          if (currentLtp !== tick.ltp || currentVolume !== tickVolume) {
            // Found a change!
            const entry = pendingUpdates.get(index) || {};
            if (type === 'call') {
              entry.callLtp = tick.ltp;
              entry.callVolume = tickVolume;
            } else {
              entry.putLtp = tick.ltp;
              entry.putVolume = tickVolume;
            }
            pendingUpdates.set(index, entry);
          }
        }
      });

      if (pendingUpdates.size > 0) {
        const updatedChain = [...currentChain]; // Shallow clone array

        for (const [index, updates] of pendingUpdates.entries()) {
          const row = updatedChain[index];
          const newRow = { ...row };

          if (updates.callLtp !== undefined && newRow.call) {
            newRow.call = { 
              ...newRow.call, 
              ltp: updates.callLtp,
              volume: updates.callVolume !== undefined ? updates.callVolume : newRow.call.volume
            };
          }
          if (updates.putLtp !== undefined && newRow.put) {
            newRow.put = { 
              ...newRow.put, 
              ltp: updates.putLtp,
              volume: updates.putVolume !== undefined ? updates.putVolume : newRow.put.volume
            };
          }
          updatedChain[index] = newRow;
        }

        chainDataRef.current = updatedChain;
        setChainData(updatedChain);
        hasUpdates = true;
        lastUpdate = timestamp;
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    // Start the loop
    animationFrameId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []); // Empty dependency array = runs once on mount, but closes over Refs

  // Add spot price calculation from WebSocket updates
  useEffect(() => {
    if (!spotInstrumentInfo?.token) return;

    let animationFrameId;
    let lastUpdate = 0;
    const THROTTLE_MS = 50; // Update UI max 20 times per second

    const spotUpdateLoop = (timestamp) => {
      // Throttle checks
      if (timestamp - lastUpdate < THROTTLE_MS) {
        animationFrameId = requestAnimationFrame(spotUpdateLoop);
        return;
      }

      const ticks = ticksRef.current;
      if (!ticks.size) {
        animationFrameId = requestAnimationFrame(spotUpdateLoop);
        return;
      }

      // Check for spot instrument updates
      const spotTick = ticks.get(String(spotInstrumentInfo.token));
      if (spotTick?.ltp !== undefined && spotTick.ltp > 0) {
        if (spotPrice !== spotTick.ltp) {
          setSpotPrice(spotTick.ltp);
          lastUpdate = timestamp;
        }
      }

      animationFrameId = requestAnimationFrame(spotUpdateLoop);
    };

    // Start the loop
    animationFrameId = requestAnimationFrame(spotUpdateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [spotInstrumentInfo, spotPrice, ticksRef]);

  return {
    chainData,
    spotPrice, // This will now be updated via WebSocket
    spotInstrumentInfo, // NEW: Expose spot instrument info
    expiries,
    loading,
    error,
    segment: activeSegment,
    refetch: fetchOptionChain,
  };
}
