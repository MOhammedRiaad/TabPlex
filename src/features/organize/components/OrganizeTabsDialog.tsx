import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAiSettings } from '../../ai/hooks/useAiSettings';
import { useModelAvailability } from '../../ai/hooks/useModelAvailability';
import ModelStatus from '../../ai/components/ModelStatus';
import { aiErrorMessage, isAiError } from '../../ai/utils/promptApi';
import { shortUrlForAi } from '../../ai/utils/tabText';
import { getFaviconUrl } from '../../../utils/favicon';
import { GROUP_NAME_MAX, MIN_TABS_PER_GROUP } from '../../../utils/organizeTabs';
import { OrganizableTab } from '../../ai/types';
import { ProposedGroup } from '../types';
import { useOrganizeActions, useOrganizeStore } from '../store/organizeStore';
import './OrganizeTabsDialog.css';

/** Tab-group colours as dots */
const DOT: Record<string, string> = {
    grey: '#6b7280',
    blue: '#3b82f6',
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    pink: '#ec4899',
    purple: '#a855f7',
    cyan: '#06b6d4',
    orange: '#f97316',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const Favicon: React.FC<{ tab: OrganizableTab }> = ({ tab }) => {
    const [failed, setFailed] = useState(false);
    const src = tab.favicon || getFaviconUrl(tab.url, 16);
    if (!src || failed)
        return (
            <span className="organize-favicon" aria-hidden="true">
                🌐
            </span>
        );
    return <img className="organize-favicon" src={src} alt="" onError={() => setFailed(true)} />;
};

const GroupCard: React.FC<{
    group: ProposedGroup;
    tabsById: Record<number, OrganizableTab>;
    defaultOpen: boolean;
    autoFocus: boolean;
}> = ({ group, tabsById, defaultOpen, autoFocus }) => {
    const { toggleGroup, renameGroup, cycleColor, removeTab } = useOrganizeActions();
    const [open, setOpen] = useState(defaultOpen);
    const tooSmall = group.tabIds.length < MIN_TABS_PER_GROUP;
    const label = group.name || 'this group';

    return (
        <div className={`organize-group${group.enabled ? '' : ' is-disabled'}`}>
            <div className="organize-group-head">
                <input
                    type="checkbox"
                    checked={group.enabled}
                    disabled={tooSmall}
                    onChange={() => toggleGroup(group.key)}
                    aria-label={`Create group ${label}`}
                />
                <button
                    type="button"
                    className="organize-color"
                    style={{ background: DOT[group.color] }}
                    onClick={() => cycleColor(group.key)}
                    aria-label={`Colour: ${group.color}. Change colour`}
                />
                <input
                    type="text"
                    className="organize-name"
                    value={group.name}
                    maxLength={GROUP_NAME_MAX}
                    onChange={e => renameGroup(group.key, e.target.value)}
                    aria-label="Group name"
                    autoFocus={autoFocus}
                />
                <button type="button" className="organize-count" onClick={() => setOpen(v => !v)} aria-expanded={open}>
                    {plural(group.tabIds.length, 'tab')} {open ? '▾' : '▸'}
                </button>
            </div>
            {tooSmall && <p className="organize-warning">Needs at least 2 tabs</p>}
            {open && (
                <ul className="organize-tabs">
                    {group.tabIds.map(id => {
                        const tab = tabsById[id];
                        if (!tab) return null;
                        return (
                            <li key={id}>
                                <Favicon tab={tab} />
                                <span className="organize-tab-title" title={tab.url}>
                                    {tab.title}
                                </span>
                                <span className="organize-tab-url">{shortUrlForAi(tab.url)}</span>
                                <button
                                    type="button"
                                    className="organize-remove"
                                    onClick={() => removeTab(group.key, id)}
                                    aria-label={`Remove ${tab.title} from ${label}`}
                                >
                                    ×
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

/** "Organize tabs": preview suggested groups, create them, undo or save them. Rendered once, in App. */
const OrganizeTabsDialog: React.FC = () => {
    const navigate = useNavigate();
    const { settings } = useAiSettings();
    const { availability } = useModelAvailability();
    const state = useOrganizeStore();
    const actions = useOrganizeActions();
    const titleRef = useRef<HTMLHeadingElement>(null);
    const { phase, proposal, tabs } = state;

    // Keep the store's environment current: the click handler reads it synchronously
    useEffect(() => {
        actions.setEnvironment({ aiEnabled: settings.tabGrouping, availability });
    }, [actions, settings.tabGrouping, availability]);

    useEffect(() => {
        if (phase === 'loading' || phase === 'error' || phase === 'done') titleRef.current?.focus();
    }, [phase]);

    useEffect(() => {
        if (phase === 'closed') return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && phase !== 'applying') actions.close();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [phase, actions]);

    if (phase === 'closed') return null;

    const tabsById = Object.fromEntries(tabs.map(t => [t.id, t]));
    const aiUsable = availability === 'available' || availability === 'downloadable' || availability === 'downloading';
    const enabledCount = proposal?.groups.filter(g => g.enabled && g.tabIds.length >= MIN_TABS_PER_GROUP).length ?? 0;
    const proposalTabCount = proposal
        ? proposal.groups.reduce((n, g) => n + g.tabIds.length, 0) + proposal.ungroupedTabIds.length
        : 0;
    // Backdrop click closes only where nothing would be lost
    const onBackdrop = () => {
        if (phase === 'loading' || phase === 'error') actions.close();
    };

    let title = 'Organize tabs';
    if (phase === 'preview' || phase === 'applying') title = `Organize ${plural(proposalTabCount, 'tab')}`;
    if (phase === 'done') title = 'Organized';

    return (
        <div className="organize-overlay" onClick={onBackdrop}>
            <div
                className="organize-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="organize-dialog-title"
                onClick={e => e.stopPropagation()}
            >
                <div className="organize-header">
                    <h2 id="organize-dialog-title" ref={titleRef} tabIndex={-1}>
                        {title}
                    </h2>
                    {proposal && (phase === 'preview' || phase === 'applying') && (
                        <span className="organize-source-badge">
                            {proposal.source === 'ai' ? '✨ Suggested by on-device AI' : 'Grouped by site'}
                        </span>
                    )}
                </div>

                <div className="organize-body">
                    {phase === 'loading' && (
                        <>
                            <p className="organize-loading">
                                {state.loadingStep === 'reading' && 'Looking at your tabs…'}
                                {state.loadingStep === 'downloading' && 'Getting the on-device AI ready…'}
                                {state.loadingStep === 'thinking' &&
                                    `Sorting ${plural(state.tabs.length, 'tab')} on your computer…`}
                            </p>
                            {state.downloadProgress !== null && (
                                <ModelStatus availability={availability} progress={state.downloadProgress} />
                            )}
                        </>
                    )}

                    {phase === 'error' && <p className="organize-error">⚠ {aiErrorMessage(state.error)}</p>}

                    {(phase === 'preview' || phase === 'applying') && proposal && (
                        <fieldset className="organize-fieldset" disabled={phase === 'applying'}>
                            {proposal.groups.length === 0 && (
                                <p className="organize-note">
                                    No two tabs share a site. Try with AI, or open more tabs.
                                </p>
                            )}
                            {proposal.groups.map((group, i) => (
                                <GroupCard
                                    key={group.key}
                                    group={group}
                                    tabsById={tabsById}
                                    defaultOpen={proposal.groups.length <= 4}
                                    autoFocus={i === 0}
                                />
                            ))}
                            {proposal.ungroupedTabIds.length > 0 && (
                                <details className="organize-ungrouped">
                                    <summary>Not grouped ({proposal.ungroupedTabIds.length})</summary>
                                    <ul className="organize-tabs">
                                        {proposal.ungroupedTabIds.map(id =>
                                            tabsById[id] ? (
                                                <li key={id}>
                                                    <Favicon tab={tabsById[id]} />
                                                    <span className="organize-tab-title">{tabsById[id].title}</span>
                                                </li>
                                            ) : null
                                        )}
                                    </ul>
                                </details>
                            )}
                            {proposal.omittedTabIds.length > 0 && (
                                <p className="organize-note">
                                    ⓘ {plural(proposal.omittedTabIds.length, 'tab')} on the right weren&apos;t included
                                    (too many for the on-device AI).
                                </p>
                            )}
                            <label className="organize-toggle">
                                <input
                                    type="checkbox"
                                    checked={state.collapseAfter}
                                    onChange={e => actions.setCollapseAfter(e.target.checked)}
                                />
                                Collapse groups after creating
                            </label>
                        </fieldset>
                    )}

                    {phase === 'done' && (
                        <>
                            {state.created.length > 0 ? (
                                <p className="organize-summary">
                                    ✓ Created {plural(state.created.length, 'group')} with{' '}
                                    {plural(
                                        state.created.reduce((n, g) => n + g.tabIds.length, 0),
                                        'tab'
                                    )}
                                    .
                                </p>
                            ) : (
                                <p className="organize-summary">No groups were created: the tabs closed or moved.</p>
                            )}
                            <ul className="organize-created">
                                {state.created.map(g => (
                                    <li key={g.groupId}>
                                        <span className="organize-dot" style={{ background: DOT[g.color] }} />
                                        {g.title} ({g.tabIds.length})
                                    </li>
                                ))}
                            </ul>
                            {state.skippedTabIds.length > 0 && (
                                <p className="organize-note">
                                    ⚠ {plural(state.skippedTabIds.length, 'tab')}{' '}
                                    {state.skippedTabIds.length === 1 ? 'was' : 'were'} skipped because{' '}
                                    {state.skippedTabIds.length === 1 ? 'it' : 'they'} closed or moved.
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className="organize-actions">
                    {phase === 'loading' && (
                        <button type="button" className="organize-btn" onClick={actions.cancel}>
                            Cancel
                        </button>
                    )}

                    {phase === 'error' && (
                        <>
                            <button type="button" className="organize-link" onClick={actions.useSiteGrouping}>
                                Group by site instead
                            </button>
                            <button type="button" className="organize-btn" onClick={actions.close}>
                                Close
                            </button>
                            {(isAiError(state.error, 'timeout') ||
                                isAiError(state.error, 'bad-output') ||
                                isAiError(state.error, 'download-failed')) && (
                                <button type="button" className="organize-btn-primary" onClick={actions.retryWithAi}>
                                    Try again
                                </button>
                            )}
                        </>
                    )}

                    {(phase === 'preview' || phase === 'applying') && proposal && (
                        <>
                            {proposal.source === 'ai' ? (
                                <>
                                    <button
                                        type="button"
                                        className="organize-link"
                                        onClick={actions.retryWithAi}
                                        disabled={phase === 'applying'}
                                    >
                                        Try again
                                    </button>
                                    <button
                                        type="button"
                                        className="organize-link"
                                        onClick={actions.useSiteGrouping}
                                        disabled={phase === 'applying'}
                                    >
                                        Group by site instead
                                    </button>
                                </>
                            ) : (
                                aiUsable && (
                                    <button
                                        type="button"
                                        className="organize-link"
                                        onClick={actions.retryWithAi}
                                        disabled={phase === 'applying'}
                                    >
                                        Try with AI
                                    </button>
                                )
                            )}
                            <button
                                type="button"
                                className="organize-btn organize-push-right"
                                onClick={actions.close}
                                disabled={phase === 'applying'}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="organize-btn-primary"
                                onClick={() => actions.apply()}
                                disabled={phase === 'applying' || enabledCount === 0}
                            >
                                {phase === 'applying'
                                    ? 'Creating…'
                                    : enabledCount === 0
                                      ? 'Create groups'
                                      : `Create ${plural(enabledCount, 'group')}`}
                            </button>
                        </>
                    )}

                    {phase === 'done' && (
                        <>
                            {state.created.length > 0 && (
                                <>
                                    <button type="button" className="organize-btn" onClick={() => actions.undo()}>
                                        Undo
                                    </button>
                                    {state.savedToBoards ? (
                                        <button
                                            type="button"
                                            className="organize-btn"
                                            onClick={() => {
                                                actions.close();
                                                navigate('/boards');
                                            }}
                                        >
                                            Open Boards
                                        </button>
                                    ) : (
                                        <button type="button" className="organize-btn" onClick={actions.saveToBoards}>
                                            Save to Boards
                                        </button>
                                    )}
                                </>
                            )}
                            <button
                                type="button"
                                className="organize-btn-primary organize-push-right"
                                onClick={actions.close}
                            >
                                Done
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrganizeTabsDialog;
