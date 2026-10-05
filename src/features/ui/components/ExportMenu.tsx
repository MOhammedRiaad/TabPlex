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

/** Time the pointer has to move from the button into the menu before it closes */
const HOVER_CLOSE_DELAY = 200;

/** A button that opens a small menu of export actions on hover or click. Esc or a click outside closes it. */
const ExportMenu: React.FC<ExportMenuProps> = ({ label, children, items, buttonClassName, title }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    // Opened by the pointer: a click then keeps it open instead of toggling it shut
    const openedByHover = useRef(false);

    const cancelClose = () => clearTimeout(closeTimer.current);
    useEffect(() => cancelClose, []);

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
        <div
            className="export-menu"
            ref={rootRef}
            onMouseEnter={() => {
                cancelClose();
                if (!open) openedByHover.current = true;
                setOpen(true);
            }}
            onMouseLeave={() => {
                cancelClose();
                closeTimer.current = setTimeout(() => {
                    openedByHover.current = false;
                    setOpen(false);
                }, HOVER_CLOSE_DELAY);
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                className={buttonClassName}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                title={title ?? label}
                onClick={() => {
                    if (open && openedByHover.current) openedByHover.current = false;
                    else setOpen(value => !value);
                }}
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
