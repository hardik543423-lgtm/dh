import react, { useState, useEffect } from 'react';
import { Layers, PieChart, Users, TrendingUp, User, Bookmark, ClipboardList, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
    { name: 'Watchlist', icon: Bookmark, href: '/watchlist' },
    { name: 'Orders', icon: ClipboardList, href: '/orders' },
    { name: 'Funds', icon: PieChart, href: '/funds' },
    { name: 'Portfolio', icon: Briefcase, href: '/portfolio' },
    { name: 'Profile', icon: User, href: '/profile' },
];

const NavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // The active state should be derived directly from location.pathname for reliable routing
    const NavItem = ({ item }) => {
        // Use location.pathname directly for determining the active state
        const isActive = location.pathname.includes(item.href) && item.href !== '/';
        const IconComponent = item.icon;

        return (
            <button
                onClick={() => {
                    // No need to call setActiveTab, the useEffect in the parent handles this
                    navigate(item.href);
                }}
                className={`
                    flex flex-col lg:flex-row items-center justify-center 
                    cursor-pointer p-2 lg:px-4 lg:py-1 
                    transition duration-200 ease-in-out relative
                    
                    ${isActive
                        ? 'text-blue-500 lg:bg-blue-500/20 rounded-lg'
                        : 'text-[var(--nav-text-inactive)] hover:text-[var(--nav-text-hover)] lg:hover:bg-[var(--bg-hover)]'
                    }
                    
                    ${isActive
                        ? 'lg:border-b-4 lg:border-blue-500'
                        : 'lg:border-b-4 lg:border-transparent'
                    }
                `}
            >
                <IconComponent className="w-5 h-5 mb-1 lg:mb-0" />
                <span className="text-[10px] font-medium lg:text-sm lg:font-medium lg:ml-2">{item.name}</span>
            </button>
        );
    };

    return (
        <>
            {/* Desktop Header/Navigation Bar (Visible at the TOP on large screens) */}
            <header className="hidden lg:flex justify-between items-center px-6 py-2 bg-[var(--bg-nav)] border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-lg">
                        <img src="/image.png" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xl font-bold text-[var(--text-primary)]">{localStorage.getItem('organizationName') || 'DHANLAXMI'}</span>
                </div>
                <nav className="flex space-x-6">
                    {NAV_ITEMS.map(item => (
                        <NavItem key={item.name} item={item} />
                    ))}
                </nav>
            </header>

            {/* Mobile Footer Navigation Bar (Fixed at the BOTTOM on small screens) */}
            <nav
                className="
                    fixed bottom-0 left-0 right-0 z-50
                    bg-[var(--bg-nav)] grid grid-cols-5 px-2 py-1 border-t border-[var(--border-color)]
                    lg:hidden 
                "
            >
                {NAV_ITEMS.map(item => (
                    // Reusing NavItem for mobile layout
                    <NavItem key={item.name} item={item} />
                ))}
            </nav>
        </>
    );
};

export default NavBar;
