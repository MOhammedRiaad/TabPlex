import React, { useEffect } from 'react';
import '../BookmarkView.css';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    duration?: number;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 3000, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className={`bookmark-toast bookmark-toast-${type}`}>
            <span className="bookmark-toast-message">{message}</span>
            <button className="bookmark-toast-close" onClick={onClose} aria-label="Close">
                ×
            </button>
        </div>
    );
};

export default Toast;
