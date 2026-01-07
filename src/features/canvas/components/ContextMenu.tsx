import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

export interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onBringToFront?: () => void;
    onSendToBack?: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    hasSelection?: boolean;
    hasClipboard?: boolean;
    canGroup?: boolean;
    canUngroup?: boolean;
    onExportSelection?: () => void;
    onCopyImage?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    x,
    y,
    onClose,
    onCut,
    onCopy,
    onPaste,
    onDuplicate,
    onDelete,
    onBringToFront,
    onSendToBack,
    onGroup,
    onUngroup,
    hasSelection = false,
    hasClipboard = false,
    canGroup = false,
    canUngroup = false,
    onExportSelection,
    onCopyImage,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleAction = (action?: () => void) => {
        if (action) {
            action();
        }
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            {hasSelection && (
                <>
                    <button className="context-menu-item" onClick={() => handleAction(onCut)} disabled={!onCut}>
                        <span className="context-menu-icon">✂️</span>
                        <span className="context-menu-label">Cut</span>
                        <span className="context-menu-shortcut">Ctrl+X</span>
                    </button>
                    <button className="context-menu-item" onClick={() => handleAction(onCopy)} disabled={!onCopy}>
                        <span className="context-menu-icon">📋</span>
                        <span className="context-menu-label">Copy</span>
                        <span className="context-menu-shortcut">Ctrl+C</span>
                    </button>
                </>
            )}

            {hasClipboard && (
                <button className="context-menu-item" onClick={() => handleAction(onPaste)} disabled={!onPaste}>
                    <span className="context-menu-icon">📄</span>
                    <span className="context-menu-label">Paste</span>
                    <span className="context-menu-shortcut">Ctrl+V</span>
                </button>
            )}

            {(hasSelection || hasClipboard) && <div className="context-menu-separator" />}

            {hasSelection && (
                <>
                    <button
                        className="context-menu-item"
                        onClick={() => handleAction(onDuplicate)}
                        disabled={!onDuplicate}
                    >
                        <span className="context-menu-icon">📑</span>
                        <span className="context-menu-label">Duplicate</span>
                        <span className="context-menu-shortcut">Ctrl+D</span>
                    </button>
                    <button
                        className="context-menu-item danger"
                        onClick={() => handleAction(onDelete)}
                        disabled={!onDelete}
                    >
                        <span className="context-menu-icon">🗑️</span>
                        <span className="context-menu-label">Delete</span>
                        <span className="context-menu-shortcut">Del</span>
                    </button>

                    <div className="context-menu-separator" />

                    <button
                        className="context-menu-item"
                        onClick={() => handleAction(onBringToFront)}
                        disabled={!onBringToFront}
                    >
                        <span className="context-menu-icon">⬆️</span>
                        <span className="context-menu-label">Bring to Front</span>
                        <span className="context-menu-shortcut">Ctrl+]</span>
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => handleAction(onSendToBack)}
                        disabled={!onSendToBack}
                    >
                        <span className="context-menu-icon">⬇️</span>
                        <span className="context-menu-label">Send to Back</span>
                        <span className="context-menu-shortcut">Ctrl+[</span>
                    </button>

                    <div className="context-menu-separator" />

                    <button
                        className="context-menu-item"
                        onClick={() => handleAction(onExportSelection)}
                        disabled={!onExportSelection}
                    >
                        <span className="context-menu-icon">📤</span>
                        <span className="context-menu-label">Export Selection</span>
                    </button>
                    <button
                        className="context-menu-item"
                        onClick={() => handleAction(onCopyImage)}
                        disabled={!onCopyImage}
                    >
                        <span className="context-menu-icon">🖼️</span>
                        <span className="context-menu-label">Copy as Image</span>
                    </button>

                    {(canGroup || canUngroup) && <div className="context-menu-separator" />}

                    {canGroup && (
                        <button className="context-menu-item" onClick={() => handleAction(onGroup)} disabled={!onGroup}>
                            <span className="context-menu-icon">📦</span>
                            <span className="context-menu-label">Group</span>
                            <span className="context-menu-shortcut">Ctrl+G</span>
                        </button>
                    )}
                    {canUngroup && (
                        <button
                            className="context-menu-item"
                            onClick={() => handleAction(onUngroup)}
                            disabled={!onUngroup}
                        >
                            <span className="context-menu-icon">📂</span>
                            <span className="context-menu-label">Ungroup</span>
                            <span className="context-menu-shortcut">Ctrl+Shift+G</span>
                        </button>
                    )}
                </>
            )}
        </div>
    );
};
