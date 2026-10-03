import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import './QuickLinks.css';
import { getFaviconUrl } from '../../../utils/favicon';

/** Favicon, or a globe when there is none (non-web URL) or it fails to load */
const LinkIcon: React.FC<{ url?: string }> = ({ url }) => {
    const [failed, setFailed] = useState(false);
    const src = getFaviconUrl(url, 64);
    if (!src || failed) return <span className="link-default-icon">🌐</span>;
    return <img src={src} alt="" onError={() => setFailed(true)} />;
};

const QuickLinks: React.FC = () => {
    const { bookmarks, fetchBookmarks } = useBoardStore();

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    // Filter out folders and get top 6 items
    const quickLinks = bookmarks
        .filter(b => b.url) // Only items with URLs
        .slice(0, 6);

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
                            <LinkIcon url={link.url} />
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
