import { TabGroupColor } from '../../utils/organizeTabs';

export interface ProposedGroup {
    /** Stable React key ('g1', 'g2', …), not shown */
    key: string;
    name: string;
    color: TabGroupColor;
    tabIds: number[];
    enabled: boolean;
}

/**
 * A suggested grouping. Every organizable tab id appears in exactly one of: a group's tabIds,
 * ungroupedTabIds or omittedTabIds.
 */
export interface GroupProposal {
    source: 'ai' | 'site';
    groups: ProposedGroup[];
    /** Considered but not placed in any group */
    ungroupedTabIds: number[];
    /** Not considered at all (didn't fit the model's input) */
    omittedTabIds: number[];
}
