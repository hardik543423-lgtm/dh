// TradingChart.jsx - Professional trading chart using TradingView Lightweight Charts
import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { useMarketData } from '../../contexts/MarketDataContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';

/**
 * Transform Dhan API candle format to Lightweight Charts format
 * From: [timestamp, open, high, low, close, volume]
 * To: { time: unixSeconds, open, high, low, close }
 */
function transformCandles(rawCandles) {
  return rawCandles.map(([timestamp, open, high, low, close, volume]) => ({
    time: Math.floor(timestamp / 1000), // Convert ms to seconds
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
    volume: parseFloat(volume)
  }));
}

function TradingChart({
  candles = [],
  symbol,
  interval,
  chartType = 'candle',
  isLiveEnabled = false,
  loading = false
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const { ticksRef, isConnected } = useMarketData();
  const { isDark } = useTheme();
  const [lastCandleTime, setLastCandleTime] = useState(null);
  const lastUpdateRef = useRef(0); // Throttle updates

  // Theme-aware chart colors using transparency to blend with app dark/light mode seamlessly
  const chartColors = isDark ? {
    background: 'transparent', 
    textColor: '#d1d4dc', 
    gridColor: 'rgba(255, 255, 255, 0.05)', 
    borderColor: 'rgba(255, 255, 255, 0.1)',
    crosshairColor: '#758696',
    labelBackground: '#4682B4',
  } : {
    background: 'transparent',
    textColor: '#191919',
    gridColor: 'rgba(0, 0, 0, 0.05)', 
    borderColor: 'rgba(0, 0, 0, 0.1)',
    crosshairColor: '#9598a1',
    labelBackground: '#4682B4',
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      // Create chart with theme-aware colors
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          background: { color: chartColors.background },
          textColor: chartColors.textColor,
        },
        grid: {
          vertLines: { color: chartColors.gridColor },
          horzLines: { color: chartColors.gridColor },
        },
        crosshair: {
          mode: 0, // Normal mode
          vertLine: {
            width: 1,
            color: chartColors.crosshairColor,
            style: 1,
            labelBackgroundColor: chartColors.labelBackground,
          },
          horzLine: {
            width: 1,
            color: chartColors.crosshairColor,
            style: 1,
            labelBackgroundColor: chartColors.labelBackground,
          },
        },
        rightPriceScale: {
          borderColor: chartColors.borderColor,
          scaleMargins: {
            top: 0.1,
            bottom: 0.2, // Leave room for volume
          },
        },
        timeScale: {
          borderColor: chartColors.borderColor,
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
      });

      console.log('[TradingChart] Chart created successfully');

      // Add candlestick or line series dynamically - Using premium colors
      let candleSeries;
      if (chartType === 'line') {
        candleSeries = chart.addSeries(LineSeries, {
          color: '#2962ff',
          lineWidth: 2,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });
      } else {
        candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#089981',
          downColor: '#f23645',
          borderDownColor: '#f23645',
          borderUpColor: '#089981',
          wickDownColor: '#f23645',
          wickUpColor: '#089981',
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });
      }

      // Add volume series (histogram)
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.85, // Volume bars take bottom 15%
          bottom: 0,
        },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          const { width, height } = chartContainerRef.current.getBoundingClientRect();
          chartRef.current.applyOptions({
            width: width,
            height: height
          });
        }
      };

      // Use ResizeObserver for better responsiveness
      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(chartContainerRef.current);

      // Initial resize
      handleResize();

    } catch (error) {
      console.error('[TradingChart] Error initializing chart:', error);
    }

    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isDark, chartType]); // Re-create chart when theme or chartType changes

  // Load historical candles
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles || candles.length === 0) return;

    try {
      const transformedCandles = transformCandles(candles);

      // Set candle data based on chartType
      if (chartType === 'line') {
        const lineData = transformedCandles.map(candle => ({
          time: candle.time,
          value: candle.close
        }));
        candleSeriesRef.current.setData(lineData);
      } else {
        candleSeriesRef.current.setData(transformedCandles);
      }

      // Set volume data with colors
      const volumeData = transformedCandles.map(candle => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? '#08998180' : '#f2364580'
      }));
      volumeSeriesRef.current.setData(volumeData);

      // Zoom elegantly to the recent candles
      if (chartRef.current) {
        const totalCandles = transformedCandles.length;
        if (totalCandles > 30) {
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: totalCandles - 30,
            to: totalCandles + 2 // Extra space on the right
          });
        } else {
          chartRef.current.timeScale().fitContent();
        }
      }

      // Store last candle time for live updates
      if (transformedCandles.length > 0) {
        const lastCandle = transformedCandles[transformedCandles.length - 1];
        setLastCandleTime(lastCandle.time);
      }
    } catch (error) {
      console.error('[TradingChart] Error loading candles:', error);
    }
  }, [candles, chartType]);

  // REPLACEMENT: Polling Loop for Chart Updates
  useEffect(() => {
    if (!isLiveEnabled || !isConnected || !symbol) return;

    const [segment, securityId] = symbol.split('|');
    if (!segment || !securityId) return;

    const segmentMap = {
      "IDX_I": 0, "NSE_EQ": 1, "NSE_FNO": 2, "NSE_CURRENCY": 3,
      "BSE_EQ": 4, "BSE_CURRENCY": 5, "MCX_COMM": 5, "NSE_INDEX": 0,
    };
    const numericSegment = segmentMap[segment];
    const tickKey = `${numericSegment}-${securityId}`;

    const intervalId = setInterval(() => {
      const tick = ticksRef.current?.get(tickKey);
      if (tick && tick.ltp) {
        setLastCandleTime(prevTime => {
          if (!prevTime) return prevTime;

          const intervalMs = Number(interval) * 60 * 1000;
          const currentTime = Math.floor(Date.now() / 1000);
          const timeSince = (currentTime - prevTime) * 1000;

          // Update Logic
          if (timeSince < intervalMs) {
            if (chartType === 'line') {
              candleSeriesRef.current.update({
                time: prevTime,
                value: tick.ltp
              });
            } else {
              candleSeriesRef.current.update({
                time: prevTime,
                open: tick.open || tick.ltp,
                high: tick.high || tick.ltp,
                low: tick.low || tick.ltp,
                close: tick.ltp
              });
            }
            if (tick.volume) {
              volumeSeriesRef.current.update({
                time: prevTime,
                value: tick.volume,
                color: tick.ltp >= (tick.open || tick.ltp) ? '#08998180' : '#f2364580'
              });
            }
            return prevTime; // Time hasn't changed
          } else if (timeSince >= intervalMs && timeSince < intervalMs * 2) {
            const newTime = prevTime + Math.floor(intervalMs / 1000);
            if (chartType === 'line') {
              candleSeriesRef.current.update({
                time: newTime,
                value: tick.ltp
              });
            } else {
              candleSeriesRef.current.update({
                time: newTime,
                open: tick.ltp,
                high: tick.ltp,
                low: tick.ltp,
                close: tick.ltp
              });
            }
            volumeSeriesRef.current.update({
              time: newTime,
              value: tick.volume || 0,
              color: '#08998180'
            });
            return newTime; // New candle time
          }
          return prevTime;
        });
      }
    }, 1000); // 1 Second throttle

    return () => clearInterval(intervalId);
  }, [symbol, isConnected, isLiveEnabled, interval, chartType]);

  if (loading) {
    return (
      <div
        ref={chartContainerRef}
        className="absolute inset-0 w-full h-full flex items-center justify-center bg-[var(--bg-card)] rounded-lg"
        style={{ minHeight: '300px' }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="text-[var(--text-secondary)] text-sm">Loading chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="absolute inset-0 w-full h-full bg-[var(--bg-card)] rounded-lg"
      style={{
        minHeight: '300px'
      }}
    />
  );
}

export default TradingChart;
