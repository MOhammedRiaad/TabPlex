import React, { useEffect } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import './QuickLinks.css';

const QuickLinks: React.FC = () => {
    const { bookmarks, fetchBookmarks } = useBoardStore();

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    // Filter out folders and get top 6 items
    const quickLinks = bookmarks
        .filter(b => b.url) // Only items with URLs
        .slice(0, 6);

    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch {
            return '';
        }
    };

    return (
        <div className="quick-links-card">
            <h3 className="section-title">Most Used Links</h3>
            <div className="links-grid">
                {quickLinks.map(link => (
                    <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="quick-link-item"
                        title={link.title}
                    >
                        <div className="link-icon">
                            <img
                                src={getFaviconUrl(link.url || '')}
                                alt=""
                                onError={e => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                        <span className="link-title">{link.title}</span>
                    </a>
                ))}
                {quickLinks.length === 0 && <div className="empty-links">No bookmarks found</div>}
            </div>
        </div>
    );
};

export default QuickLinks;
