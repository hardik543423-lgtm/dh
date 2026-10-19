import React, { useState } from 'react';
import { motion } from 'framer-motion';
import OpenOrder from './Open Order/OpenOrder.jsx';
import ClosedOrder from './Close Order/CloseOrder.jsx';
import HoldOrder from './Holding/HoldOrder.jsx';
import OvernightOrder from './Overnight Orders/OvernightOrder.jsx';

const Orders = () => {
    const [activeTab, setActiveTab] = useState('open');
    const [activeFilter, setActiveFilter] = useState('All');

    const tabs = [
        { id: 'open', label: 'OPEN' },
        { id: 'closed', label: 'CLOSED' },
        { id: 'holding', label: 'HOLDINGS' },
        { id: 'overnight', label: 'OVERNIGHT' }
    ];

    const filterOptions = ['All', 'Today', ' 7 Days', '30 Days'];

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden text-[var(--text-primary)]">
            {/* HEADER */}
            <div className="px-5 pt-6 pb-2">
                <h1 className="text-2xl font-black tracking-tight mb-4">Orders</h1>
                
                {/* TABS CONTROLS */}
                <div className="flex pb-4 overflow-x-hidden no-scrollbar relative w-full border-b border-[var(--border-color)]">
                    {tabs.map((tab) => {
                        // Comment out OVERNIGHT tab as requested
                        if (tab.id === 'overnight') return null;

                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 relative px-4 py-2 text-xs font-black transition-all duration-300 whitespace-nowrap text-center flex justify-center
                                    ${isActive 
                                        ? 'text-[#3b82f6]' 
                                        : 'text-[var(--text-muted)] hover:text-white'}`}
                            >
                                <div className="flex items-center justify-center gap-1.5 z-10 relative w-full text-center">
                                    {tab.label}
                                </div>
                                
                                {/* Animated Bottom Border */}
                                {isActive && (
                                    <motion.div
                                        layoutId="ordersTabIndicator"
                                        className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#3b82f6] z-20"
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* FILTER BAR */}
                <div className="flex ml-1 gap-2 pt-5 overflow-x-hidden no-scrollbar">
                    {filterOptions.map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap border
                                ${activeFilter === filter 
                                    ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/40' 
                                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[#3b82f6]/30'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                <div className="p-4">
                    {activeTab === 'open' && <OpenOrder filter={activeFilter} />}
                    {activeTab === 'closed' && <ClosedOrder filter={activeFilter} />}
                    {activeTab === 'holding' && <HoldOrder filter={activeFilter} />}
                    {activeTab === 'overnight' && <OvernightOrder filter={activeFilter} />}
                </div>
            </div>
        </div>
    );
};

export default Orders;
