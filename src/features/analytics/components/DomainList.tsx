import React from 'react';
import { DomainStat } from '../../../types';
import '../AnalyticsDashboard.css';

interface DomainListProps {
    mostVisitedDomains: DomainStat[];
}

const DomainList: React.FC<DomainListProps> = ({ mostVisitedDomains }) => {
    return (
        <div className="analytics-section">
            <h3>🌍 Most Visited Domains</h3>
            <div className="domains-list">
                {mostVisitedDomains.length > 0 ? (
                    mostVisitedDomains.map((domain, index) => (
                        <div key={domain.domain} className="domain-item">
                            <span className="domain-rank">#{index + 1}</span>
                            <span className="domain-name">{domain.domain}</span>
                            <div className="domain-bar-container">
                                <div className="domain-bar" style={{ width: `${domain.percentage}%` }} />
                            </div>
                            <span className="domain-count">{domain.count}</span>
                        </div>
                    ))
                ) : (
                    <p className="no-data">No domain data available</p>
                )}
            </div>
        </div>
    );
};

export default DomainList;
