import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, RefreshCw, AlertCircle, Loader, TrendingDown, ChevronDown } from 'lucide-react';
import { useOptionChain } from '../../../hooks/useOptionChain';
import OptionStrikeBottomWindow from './OptionStrikeBottomWindow';
import StockChart from '../../Chart/StockChart';
import LockedButtonWrapper from '../../../components/LockedButtonWrapper';

// Strike count options
const STRIKE_OPTIONS = [
    { label: 'All', value: 0 },
    { label: '6 Strikes', value: 6 },
    { label: '12 Strikes', value: 12 },
   
];

// Auto-refresh interval (in ms) - 5 seconds for near real-time feel
const AUTO_REFRESH_INTERVAL = 5000;

const OptionChainFullscreen = ({ selectedStock, sheetData, onClose, brokerId, customerId, initialTab = 'Charts' }) => {
    const prevLtpRef = useRef({});

    const styleTag = (
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes blink-green-bg {
                0% { background-color: rgba(34, 197, 94, 0.4); color: #22c55e !important; }
                100% { background-color: transparent; }
            }
            @keyframes blink-red-bg {
                0% { background-color: rgba(239, 68, 68, 0.4); color: #ef4444 !important; }
                100% { background-color: transparent; }
            }
            .flash-green-bg {
                animation: blink-green-bg 1s ease-out;
            }
            .flash-red-bg {
                animation: blink-red-bg 1s ease-out;
            }
        `}} />
    );

    // Tab State: 'Charts' | 'OptionChain'
    const [activeTab, setActiveTab] = useState(initialTab);
    
    // Default to OptionChain if no options? Wait, initialTab will control this now.
    // If we want to stay updated if initialTab prop changes:
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const [selectedExpiry, setSelectedExpiry] = useState(null);
    const [strikeCount, setStrikeCount] = useState(12);
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const [selectedStrike, setSelectedStrike] = useState(null);

    // Option Chain Data Hook
    const {
        chainData,
        spotPrice,
        expiries,
        loading,
        error,
        segment: chainSegment,
        refetch
    } = useOptionChain({
        name: selectedStock?.name || selectedStock?.tradingSymbol,
        segment: selectedStock?.segment,
        expiry: selectedExpiry
    });

    // Check if options are available (simple check: if we have expiries or chainData)
    // We can also check segment usually (NFO/MCX), but this hook data is a good proxy.
    // If loading, we assume it might be available to avoid flickering.
    const hasOptions = useMemo(() => {
        if (selectedStock?.segment === 'NFO' || selectedStock?.segment === 'MCX' || selectedStock?.segment === 'INDICES') return true;
        return (expiries && expiries.length > 0) || (chainData && chainData.length > 0);
    }, [selectedStock, expiries, chainData]);

    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Auto-refresh (only when Option Chain tab is active)
    useEffect(() => {
        if (activeTab !== 'OptionChain') return;

        const interval = setInterval(() => {
            refetch();
            setLastUpdateTime(new Date());
        }, AUTO_REFRESH_INTERVAL);

        setLastUpdateTime(new Date());
        return () => clearInterval(interval);
    }, [refetch, activeTab]);

    // Update timestamp when data changes
    useEffect(() => {
        if (chainData) setLastUpdateTime(new Date());
    }, [chainData]);

    const currentPrice = spotPrice || sheetData?.ltp || 0;

    // Filter Logic for Option Chain (Only calculate if tab is active)
    const { filteredChain, atmStrike } = useMemo(() => {
        if (activeTab !== 'OptionChain' || !chainData || chainData.length === 0 || !currentPrice) {
            return { filteredChain: [], atmStrike: null };
        }

        // Find ATM strike
        let closestStrike = chainData[0]?.strike;
        let minDiff = Math.abs(chainData[0]?.strike - currentPrice);

        chainData.forEach(row => {
            const diff = Math.abs(row.strike - currentPrice);
            if (diff < minDiff) {
                minDiff = diff;
                closestStrike = row.strike;
            }
        });

        // If 'All' selected (strikeCount === 0), return full chain
        if (strikeCount === 0) {
            return {
                filteredChain: chainData,
                atmStrike: closestStrike
            };
        }

        const atmIndex = chainData.findIndex(row => row.strike === closestStrike);
        const strikesPerSide = Math.floor((strikeCount - 1) / 2);
        let strikesAbove = strikesPerSide;
        let strikesBelow = strikesPerSide;

        const availableAbove = atmIndex;
        const availableBelow = chainData.length - atmIndex - 1;

        if (availableAbove < strikesAbove) {
            strikesAbove = availableAbove;
            strikesBelow = Math.min(availableBelow, strikeCount - strikesAbove - 1);
        }
        if (availableBelow < strikesBelow) {
            strikesBelow = availableBelow;
            strikesAbove = Math.min(availableAbove, strikeCount - strikesBelow - 1);
        }

        const startIndex = Math.max(0, atmIndex - strikesAbove);
        const endIndex = Math.min(chainData.length, atmIndex + strikesBelow + 1);

        return {
            filteredChain: chainData.slice(startIndex, endIndex),
            atmStrike: closestStrike
        };
    }, [chainData, currentPrice, strikeCount, activeTab]);

    const formatExpiry = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatLTP = (value) => {
        if (value === undefined || value === null) return '—';
        return Number(value).toFixed(2);
    };

    const formatVolume = (value) => {
        if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
        const num = Number(value);
        if (num >= 10000000) {
            return `${(num / 10000000).toFixed(2)}Cr`;
        }
        if (num >= 100000) {
            return `${(num / 100000).toFixed(2)}L`;
        }
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    };

    // --- Renderers ---

    const renderHeader = () => (
        <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-2 pt-2 pb-0 flex-shrink-0 flex flex-col gap-2">

            {/* Top Row: Close Button Only (Title moved to Tabs or unnecessary) */}
            <div className="flex items-center justify-between">
                {/* Tabs */}
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('Charts')}
                        className={`text-sm font-semibold pb-2 border-b-2 transition ${activeTab === 'Charts' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Charts
                    </button>
                    {hasOptions && (
                        <button
                            onClick={() => setActiveTab('OptionChain')}
                            className={`text-sm font-semibold pb-2 border-b-2 transition ${activeTab === 'OptionChain' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            Option Chain
                        </button>
                    )}
                </div>

                {/* Window Controls */}
                <div className="flex items-center gap-1 mb-1">
                    {activeTab === 'OptionChain' && (
                        <button
                            onClick={() => { refetch(); setLastUpdateTime(new Date()); }}
                            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                    )}
                    {/* Close button (X) handled by parent usually, but good to have here too */}
                    {/* <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition"
                        title="Close"
                    >
                        <X className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button> */}
                </div>
            </div>

            {/* Option Chain Filters - Only show if Option Chain tab is active */}
            {activeTab === 'OptionChain' && (
                <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)] text-xs">Spot:</span>
                        <span className="text-yellow-400 text-sm font-bold">₹{Number(currentPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={strikeCount}
                            onChange={(e) => setStrikeCount(Number(e.target.value))}
                            className="bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-color)] text-xs"
                        >
                            {STRIKE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.value === 0 ? `All (${chainData?.length || 0})` : opt.label}
                                </option>
                            ))}
                        </select>
                        {expiries && expiries.length > 0 && (
                            <select
                                value={selectedExpiry || expiries[0]}
                                onChange={(e) => setSelectedExpiry(e.target.value)}
                                className="bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 rounded border border-[var(--border-color)] text-xs max-w-[100px]"
                            >
                                {expiries.map(exp => <option key={exp} value={exp}>{formatExpiry(exp)}</option>)}
                            </select>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderChart = () => (
        <div className="flex-1 w-full h-full bg-[var(--bg-primary)] overflow-hidden relative flex flex-col">
            <div className="flex-1 overflow-hidden">
                {selectedStock?.instrument_token ? (
                    <StockChart
                        instrument_token={selectedStock.instrument_token}
                        tradingSymbol={selectedStock.tradingSymbol || selectedStock.name}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
                        No Instrument Token for Chart
                    </div>
                )}
            </div>
            {selectedStock?.instrument_token && (
                <div className="px-4 py-3 bg-[var(--bg-card)] border-t border-[var(--border-color)] flex gap-3 z-10 flex-shrink-0">
                    {selectedStock?.segment === 'INDICES' ? (
                        <>
                            <button
                                onClick={() => setActiveTab('OptionChain')}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-center"
                            >
                                CALL
                            </button>
                            <button
                                onClick={() => setActiveTab('OptionChain')}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all text-center"
                            >
                                PUT
                            </button>
                        </>
                    ) : (
                        <>
                            <LockedButtonWrapper featureId="buy" className="flex-1">
                                <button
                                    onClick={() => setSelectedStrike({
                                        strike: null,
                                        type: 'CE',
                                        instrumentToken: selectedStock.instrument_token,
                                        tradingSymbol: selectedStock.tradingSymbol || selectedStock.name,
                                        lot_size: selectedStock.lot_size || selectedStock.lotSize || 1,
                                        expiry: selectedStock.expiry,
                                        initialActionTab: 'Buy'
                                    })}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-center"
                                >
                                    BUY
                                </button>
                            </LockedButtonWrapper>
                            <LockedButtonWrapper featureId="sell" className="flex-1">
                                <button
                                    onClick={() => setSelectedStrike({
                                        strike: null,
                                        type: 'PE',
                                        instrumentToken: selectedStock.instrument_token,
                                        tradingSymbol: selectedStock.tradingSymbol || selectedStock.name,
                                        lot_size: selectedStock.lot_size || selectedStock.lotSize || 1,
                                        expiry: selectedStock.expiry,
                                        initialActionTab: 'Sell'
                                    })}
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all text-center"
                                >
                                    SELL
                                </button>
                            </LockedButtonWrapper>
                        </>
                    )}
                </div>
            )}
        </div>
    );

    const renderOptionChainBody = () => {
        if (loading && !chainData) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <Loader className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-red-400 text-sm mb-4">{error}</p>
                    <button onClick={refetch} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm">Retry</button>
                </div>
            );
        }
        // chainData is empty array = no options exist for this stock (not an error)
        if (chainData && chainData.length === 0 && !loading) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[var(--text-secondary)]">
                    <AlertCircle className="w-6 h-6 mb-2 text-[var(--text-muted)]" />
                    <p className="text-sm">Option chain not available for this stock</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">No expiry dates found</p>
                </div>
            );
        }
        if (!filteredChain || filteredChain.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[var(--text-secondary)]">
                    <p>No Option Data</p>
                </div>
            );
        }

        return (
            <div className="flex-1 overflow-hidden flex flex-col px-2 pt-2 pb-2">
                <div className="w-full max-w-3xl mx-auto flex flex-col flex-1 overflow-hidden bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                    {/* Sticky Header */}
                    <div className="grid grid-cols-5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs font-semibold py-2 flex-shrink-0 sticky top-0 z-10">
                        <div className="text-center text-[var(--text-secondary)]">Call Vol</div>
                        <div className="text-center text-green-400">Call LTP</div>
                        <div className="text-center text-[var(--text-secondary)] border-x border-[var(--border-color)]">Strike</div>
                        <div className="text-center text-red-400">Put LTP</div>
                        <div className="text-center text-[var(--text-secondary)]">Put Vol</div>
                    </div>
                    {/* Scrollable Body */}
                    <div className="overflow-y-auto flex-1">
                        {filteredChain.map(row => {
                            const isATM = row.strike === atmStrike;

                            const callToken = row.call?.instrument_token;
                            const prevCallLtp = callToken ? prevLtpRef.current[callToken] : undefined;
                            const currentCallLtp = row.call?.ltp;
                            let callBlinkClass = "";
                            if (callToken && prevCallLtp !== undefined && currentCallLtp !== prevCallLtp) {
                                callBlinkClass = currentCallLtp > prevCallLtp ? "flash-green-bg" : "flash-red-bg";
                            }
                            if (callToken && currentCallLtp !== undefined) {
                                prevLtpRef.current[callToken] = currentCallLtp;
                            }

                            const putToken = row.put?.instrument_token;
                            const prevPutLtp = putToken ? prevLtpRef.current[putToken] : undefined;
                            const currentPutLtp = row.put?.ltp;
                            let putBlinkClass = "";
                            if (putToken && prevPutLtp !== undefined && currentPutLtp !== prevPutLtp) {
                                putBlinkClass = currentPutLtp > prevPutLtp ? "flash-green-bg" : "flash-red-bg";
                            }
                            if (putToken && currentPutLtp !== undefined) {
                                prevLtpRef.current[putToken] = currentPutLtp;
                            }

                            return (
                                <div key={row.strike} className={`grid grid-cols-5 border-b border-[var(--border-color)] last:border-b-0 text-sm ${isATM ? 'bg-yellow-500/10' : ''}`}>
                                    {/* Call Volume */}
                                    <div className="p-2 text-center text-xs text-[var(--text-muted)] border-r border-[var(--border-color)] flex items-center justify-center">
                                        {formatVolume(row.call?.volume)}
                                    </div>

                                    {/* Call LTP */}
                                    <div
                                        key={`call-${callToken}-${currentCallLtp}`}
                                        className={`p-2 text-center cursor-pointer hover:bg-green-500/10 flex items-center justify-center border-r border-[var(--border-color)] ${callBlinkClass} ${row.call?.ltp ? 'text-green-400' : 'text-[var(--text-muted)]'}`}
                                        onClick={() => row.call?.instrument_token && setSelectedStrike({ 
                                            strike: row.strike, 
                                            type: 'CE', 
                                            instrumentToken: row.call.instrument_token, 
                                            tradingSymbol: row.call.tradingsymbol,
                                            lot_size: row.call.lot_size,
                                            expiry: selectedExpiry || expiries?.[0] 
                                        })}
                                    >
                                        {formatLTP(row.call?.ltp)}
                                    </div>

                                    {/* Strike */}
                                    <div className={`p-2 text-center font-medium border-r border-[var(--border-color)] flex items-center justify-center ${isATM ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
                                        {row.strike}
                                    </div>

                                    {/* Put LTP */}
                                    <div
                                        key={`put-${putToken}-${currentPutLtp}`}
                                        className={`p-2 text-center cursor-pointer hover:bg-red-500/10 flex items-center justify-center border-r border-[var(--border-color)] ${putBlinkClass} ${row.put?.ltp ? 'text-red-400' : 'text-[var(--text-muted)]'}`}
                                        onClick={() => row.put?.instrument_token && setSelectedStrike({ 
                                            strike: row.strike, 
                                            type: 'PE', 
                                            instrumentToken: row.put.instrument_token, 
                                            tradingSymbol: row.put.tradingsymbol,
                                            lot_size: row.put.lot_size,
                                            expiry: selectedExpiry || expiries?.[0] 
                                        })}
                                    >
                                        {formatLTP(row.put?.ltp)}
                                    </div>

                                    {/* Put Volume */}
                                    <div className="p-2 text-center text-xs text-[var(--text-muted)] flex items-center justify-center">
                                        {formatVolume(row.put?.volume)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
            {styleTag}
            {renderHeader()}

            {activeTab === 'Charts' ? renderChart() : renderOptionChainBody()}


            <OptionStrikeBottomWindow
                isOpen={selectedStrike !== null}
                onClose={() => setSelectedStrike(null)}
                optionType={selectedStrike?.type}
                strikePrice={selectedStrike?.strike}
                instrumentToken={selectedStrike?.instrumentToken}
                tradingSymbol={selectedStrike?.tradingSymbol}
                segment={chainSegment}
                underlyingStock={selectedStock}
                spotPrice={currentPrice}
                expiry={selectedStrike?.expiry}
                lot_size_prop={selectedStrike?.lot_size}
                brokerId={brokerId}
                customerId={customerId}
            />
        </div>
    );
};

export default OptionChainFullscreen;
