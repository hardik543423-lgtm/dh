import React from 'react';
import { Search } from 'lucide-react';

/**
 * A reusable component for filtering the watchlist.
 * @param {string} searchTerm - The current value of the search input.
 * @param {function} setSearchTerm - The function to update the search term state.
 */
function SearchBar({ searchTerm, setSearchTerm }) {
    return (
        <div className="relative flex-1">
            <input
                type="text"
                placeholder="Search & add"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2.5 pl-3 pr-4 bg-transparent text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-blue-500 transition border border-[var(--border-color)] placeholder-[var(--text-secondary)] text-sm"
                autoFocus
            />
        </div>
    );
}

export default SearchBar;