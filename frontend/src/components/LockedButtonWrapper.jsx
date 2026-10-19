import React from 'react';
import { Lock } from 'lucide-react';
import { usePermissions } from '../contexts/PermissionsContext';

/**
 * LockedButtonWrapper
 * @param {string} featureId - The ID of the feature to check (e.g., 'buy', 'sell')
 * @param {React.ReactNode} children - The actual button component
 * @param {string} className - Optional container styling
 */
export default function LockedButtonWrapper({ featureId, children, className = "" }) {
    const { isLocked } = usePermissions();
    const locked = isLocked(featureId);

    if (!locked) return <>{children}</>;

    // If locked, render the button but disabled with a lock icon overlay
    return (
        <div className={`relative group cursor-not-allowed ${className}`}>
            {/* The actual button, but disabled and semi-transparent */}
            <div className="opacity-40 grayscale pointer-events-none select-none">
                {children}
            </div>

            {/* Lock Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 dark:bg-black/80 p-1.5 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 animate-in zoom-in duration-300">
                    <Lock size={14} className="text-red-500 fill-red-500/10" />
                </div>
            </div>

            {/* Tooltip on hover */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl border border-white/10">
                This feature is locked by your broker
            </div>
        </div>
    );
}
