import React, { useState, useEffect } from 'react';
import '../TodayView.css';

const TodayHeader: React.FC = () => {
    const [userName, setUserName] = useState<string>('');
    const today = new Date();
    const hour = today.getHours();

    let greeting = 'Good Morning';
    if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
    else if (hour >= 17) greeting = 'Good Evening';

    useEffect(() => {
        const fetchUserName = async () => {
            try {
                // Try to get Chrome user info via background script
                const response = await chrome.runtime.sendMessage({ type: 'GET_USER_INFO' });
                if (response?.email) {
                    const name = response.email.split('@')[0];
                    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                    setUserName(displayName);
                    return;
                }
            } catch (e) {
                console.log('Background message failed:', e);
            }

            // Fallback: Try direct API call
            try {
                if (chrome?.identity?.getProfileUserInfo) {
                    chrome.identity.getProfileUserInfo(
                        { accountStatus: 'ANY' as chrome.identity.AccountStatus },
                        userInfo => {
                            if (chrome.runtime.lastError) {
                                console.log('Identity API error:', chrome.runtime.lastError);
                                return;
                            }
                            if (userInfo?.email) {
                                const name = userInfo.email.split('@')[0];
                                const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                                setUserName(displayName);
                            }
                        }
                    );
                }
            } catch (e) {
                console.log('Direct identity call failed:', e);
            }
        };

        fetchUserName();
    }, []); // Empty dependency - only run once on mount

    return (
        <div className="today-header">
            <div className="header-content">
                <h2 className="greeting">
                    {greeting}
                    {userName ? `, ${userName}` : ''}
                </h2>
                <div className="today-date">
                    {today.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </div>
            </div>
        </div>
    );
};

export default TodayHeader;
