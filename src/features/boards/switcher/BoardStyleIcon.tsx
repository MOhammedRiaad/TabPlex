import React from 'react';
import { BoardStyle } from './boardStyle';

// Same drawings as the picker in onboarding.html
const PATHS: Record<BoardStyle, React.ReactNode> = {
    tabs: (
        <>
            <path d="M1.5 13.5h13" />
            <path d="M2.5 13.5V6.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v7" />
            <path d="M7.5 8.5h5a1 1 0 0 1 1 1v4" />
        </>
    ),
    accordion: (
        <>
            <rect x="1.5" y="2.5" width="2.5" height="11" rx="1" />
            <rect x="5.5" y="2.5" width="6" height="11" rx="1" />
            <rect x="13" y="2.5" width="1.5" height="11" rx=".7" />
        </>
    ),
    bookshelf: (
        <>
            <path d="M1.5 14.5h13" />
            <rect x="2" y="4" width="2.5" height="10.5" rx=".5" />
            <rect x="5" y="2.5" width="2.5" height="12" rx=".5" />
            <path d="m9 14.5 1.6-10.7 2.4.4-1.6 10.3" />
        </>
    ),
    carousel: (
        <>
            <rect x="4" y="3" width="8" height="10" rx="1.5" />
            <path d="M1.5 5v6M14.5 5v6" />
        </>
    ),
    dock: (
        <>
            <rect x="1.5" y="2" width="13" height="12" rx="2" />
            <path d="M5.5 2v12" />
            <path d="M3.5 5v.01M3.5 8v.01M3.5 11v.01" />
        </>
    ),
    overview: (
        <>
            <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
            <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
            <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
            <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
        </>
    ),
    dropdown: (
        <>
            <rect x="1.5" y="3.5" width="13" height="4" rx="1" />
            <path d="m10.5 5 1 1 1-1" />
            <path d="M3 10.5h8M3 13h6" />
        </>
    ),
};

const BoardStyleIcon: React.FC<{ style: BoardStyle; size?: number }> = ({ style, size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        {PATHS[style]}
    </svg>
);

export default BoardStyleIcon;
