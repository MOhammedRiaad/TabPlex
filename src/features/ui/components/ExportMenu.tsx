import React, { useEffect, useRef, useState } from 'react';
import './ExportMenu.css';

export interface ExportMenuItem {
    label: string;
    onSelect: () => void;
}

interface ExportMenuProps {
    /** Accessible name of the button, e.g. "Export task" */
    label: string;
    /** What the button shows */
    children: React.ReactNode;
    items: ExportMenuItem[];
    buttonClassName?: string;
    title?: string;
}

/** A button that opens a small menu of export actions. Esc or a click outside closes it. */
const ExportMenu: React.FC<ExportMenuProps> = ({ label, children, items, buttonClassName, title }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="export-menu" ref={rootRef}>
            <button
                ref={buttonRef}
                type="button"
                className={buttonClassName}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                title={title ?? label}
                onClick={() => setOpen(value => !value)}
            >
                {children}
            </button>
            {open && (
                <ul className="export-menu-list" role="menu" aria-label={label}>
                    {items.map(item => (
                        <li key={item.label} role="none">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setOpen(false);
                                    item.onSelect();
                                }}
                            >
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ExportMenu;
