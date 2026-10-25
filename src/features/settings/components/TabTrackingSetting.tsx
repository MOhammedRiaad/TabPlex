import React from 'react';
import { useTrackAllTabs } from '../hooks/useTrackAllTabs';

/** Record every page the browser opens into the Inbox (off for new installs) */
const TabTrackingSetting: React.FC = () => {
    const { enabled, update } = useTrackAllTabs();

    return (
        <div className="setting-item">
            <div className="setting-info">
                <h4>Record every page I open</h4>
                <p>
                    When on, TabPlex adds each page you open to your Inbox so you can find it later. When off, it only
                    follows the tabs you have already put on a board or in a task. Closed tabs are removed after 30
                    days, and at most 2,000 are kept. Everything stays on this device.
                </p>
            </div>
            <div className="setting-control">
                <input
                    type="checkbox"
                    className="setting-checkbox"
                    aria-label="Record every page I open"
                    checked={enabled}
                    onChange={e => update(e.target.checked)}
                />
            </div>
        </div>
    );
};

export default TabTrackingSetting;
