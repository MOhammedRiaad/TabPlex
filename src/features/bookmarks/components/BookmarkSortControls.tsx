import React from 'react';
import { SortConfig, SortCriteria } from '../utils/sortUtils';
import '../BookmarkView.css';

interface BookmarkSortControlsProps {
    sortConfig: SortConfig;
    onSortChange: (config: SortConfig) => void;
}

/**
 * BookmarkSortControls Component
 *
 * Provides UI controls for sorting bookmarks by name and date added.
 * Follows modern design patterns with clear visual feedback.
 */
const BookmarkSortControls: React.FC<BookmarkSortControlsProps> = ({ sortConfig, onSortChange }) => {
    const handleCriteriaChange = (criteria: SortCriteria) => {
        onSortChange({
            ...sortConfig,
            criteria,
            // Reset to default order when changing criteria
            order: criteria === 'name' ? 'asc' : 'desc',
        });
    };

    const handleOrderToggle = () => {
        if (sortConfig.criteria === 'default') return;
        onSortChange({
            ...sortConfig,
            order: sortConfig.order === 'asc' ? 'desc' : 'asc',
        });
    };

    const getSortLabel = () => {
        if (sortConfig.criteria === 'default') return 'Default';
        if (sortConfig.criteria === 'name') {
            return sortConfig.order === 'asc' ? 'Name (A-Z)' : 'Name (Z-A)';
        }
        if (sortConfig.criteria === 'dateAdded') {
            return sortConfig.order === 'desc' ? 'Date Added (Newest)' : 'Date Added (Oldest)';
        }
        return 'Default';
    };

    return (
        <div className="bookmark-sort-controls">
            <div className="bookmark-sort-group">
                <label htmlFor="bookmark-sort-criteria" className="bookmark-sort-label">
                    Sort by:
                </label>
                <select
                    id="bookmark-sort-criteria"
                    value={sortConfig.criteria}
                    onChange={e => handleCriteriaChange(e.target.value as SortCriteria)}
                    className="bookmark-sort-select"
                    aria-label="Sort bookmarks by"
                >
                    <option value="default">Default</option>
                    <option value="name">Name</option>
                    <option value="dateAdded">Date Added</option>
                </select>
            </div>

            {sortConfig.criteria !== 'default' && (
                <button
                    onClick={handleOrderToggle}
                    className="bookmark-sort-order-btn"
                    title={`Sort ${sortConfig.order === 'asc' ? 'descending' : 'ascending'}`}
                    aria-label={`Sort ${sortConfig.order === 'asc' ? 'descending' : 'ascending'}`}
                    type="button"
                >
                    {sortConfig.order === 'asc' ? (
                        <span aria-hidden="true">⬆️</span>
                    ) : (
                        <span aria-hidden="true">⬇️</span>
                    )}
                </button>
            )}

            <div className="bookmark-sort-indicator" aria-live="polite" aria-atomic="true">
                {sortConfig.criteria !== 'default' && (
                    <span className="bookmark-sort-badge" title={`Currently sorted by: ${getSortLabel()}`}>
                        {getSortLabel()}
                    </span>
                )}
            </div>
        </div>
    );
};

export default BookmarkSortControls;
