import React, { useEffect } from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

const TldrawContainer: React.FC = () => {
    const persistenceMode = localStorage.getItem('tabboard_tldraw_persistence') || 'indexeddb';
    const collaborationMode = localStorage.getItem('tabboard_tldraw_mode') || 'offline';

    // Generate a consistent room name - only create once and save it
    let roomName = localStorage.getItem('tabboard_tldraw_room');
    if (!roomName) {
        roomName = `tabboard-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('tabboard_tldraw_room', roomName);
    }

    // Store the room name for persistence key
    const persistenceKey = `tldraw-tabboard-${roomName}`;

    // Online collaboration setup (future enhancement)
    useEffect(() => {
        if (collaborationMode === 'online') {
            console.log(`tldraw collaboration room: ${roomName}`);
            // TODO: Implement WebSocket/WebRTC for real-time collaboration
            // This would require a backend service or using tldraw's built-in multiplayer
        }
    }, [collaborationMode, roomName]);

    // For IndexedDB and LocalStorage persistence, tldraw automatically handles it
    // when you provide a persistenceKey prop
    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
            }}
        >
            <style>{`
                /* Hide tldraw watermark/license message */
                .tlui-license__watermark,
                .tlui-watermark,
                [data-testid="watermark"],
                .tl-watermark,
                .tl-watermark_SEE-LICENSE {
                    display: none !important;
                    visibility: hidden !important;
                }
            `}</style>
            <Tldraw persistenceKey={persistenceMode !== 'memory' ? persistenceKey : undefined} autoFocus />
        </div>
    );
};

export default TldrawContainer;
