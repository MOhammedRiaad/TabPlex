import { describe, expect, it } from 'vitest';
import { groupBySite, siteKey } from '../siteGrouping';
import { OrganizableTab } from '../../../ai/types';

const tabs = (urls: string[]): OrganizableTab[] =>
    urls.map((url, i) => ({ id: 100 + i, windowId: 1, title: `T${i}`, url }));

function expectInvariant(urls: string[]) {
    const list = tabs(urls);
    const proposal = groupBySite(list);
    expect([...proposal.groups.flatMap(g => g.tabIds), ...proposal.ungroupedTabIds].sort()).toEqual(
        list.map(t => t.id).sort()
    );
    return proposal;
}

describe('siteKey', () => {
    it.each([
        ['https://github.com/a', 'github.com'],
        ['https://www.github.com/a', 'github.com'],
        ['https://docs.github.com/b', 'github.com'],
        ['https://news.bbc.co.uk/x', 'bbc.co.uk'],
        ['https://shop.example.com.au/', 'example.com.au'],
        ['http://localhost:3000/a', 'localhost'],
        ['http://192.168.1.1/a', '192.168.1.1'],
        ['http://[::1]:8080/', '[::1]'],
        ['file:///C:/x.pdf', 'Local files'],
        ['not a url', null],
    ])('%s → %s', (url, key) => {
        expect(siteKey(url)).toBe(key);
    });
});

describe('groupBySite', () => {
    it('S1: subdomains group with their site', () => {
        const proposal = expectInvariant([
            'https://github.com/a',
            'https://docs.github.com/b',
            'https://gist.github.com/c',
        ]);
        expect(proposal.groups).toEqual([
            { key: 'g1', name: 'github.com', color: 'blue', tabIds: [100, 101, 102], enabled: true },
        ]);
        expect(proposal).toMatchObject({ source: 'site', ungroupedTabIds: [], omittedTabIds: [] });
    });

    it('S2: two-part suffixes', () => {
        expect(expectInvariant(['https://news.bbc.co.uk/x', 'https://www.bbc.co.uk/y']).groups[0].name).toBe(
            'bbc.co.uk'
        );
    });

    it('S3: no site has two tabs', () => {
        const proposal = expectInvariant(['https://a.com', 'https://b.com', 'https://c.com']);
        expect(proposal.groups).toEqual([]);
        expect(proposal.ungroupedTabIds).toEqual([100, 101, 102]);
    });

    it('S4/S5/S7: localhost, local files and IP addresses', () => {
        expect(expectInvariant(['http://localhost:3000/a', 'http://localhost:5173/b']).groups[0].name).toBe(
            'localhost'
        );
        expect(expectInvariant(['file:///C:/x.pdf', 'file:///C:/y.pdf']).groups[0].name).toBe('Local files');
        expect(expectInvariant(['http://192.168.1.1/a', 'http://192.168.1.1/b']).groups[0].name).toBe('192.168.1.1');
    });

    it('S6: keeps the 8 biggest sites (ties by first position); the rest stay ungrouped', () => {
        const urls = Array.from({ length: 9 }, (_, i) => [`https://s${i}.dev/1`, `https://s${i}.dev/2`]).flat();
        urls.push('https://s4.dev/3'); // s4 is the biggest
        const proposal = expectInvariant(urls);
        expect(proposal.groups.map(g => g.name)).toEqual([
            's4.dev',
            's0.dev',
            's1.dev',
            's2.dev',
            's3.dev',
            's5.dev',
            's6.dev',
            's7.dev',
        ]);
        expect(proposal.ungroupedTabIds).toEqual([116, 117]); // s8.dev
        expect(proposal.groups.map(g => g.color)).toEqual([
            'blue',
            'red',
            'yellow',
            'green',
            'pink',
            'purple',
            'cyan',
            'orange',
        ]);
    });

    it('keeps tab-strip order inside groups and for ungrouped tabs, and skips bad URLs', () => {
        const proposal = expectInvariant([
            'https://a.dev/1',
            'bad url',
            'https://b.dev/1',
            'https://a.dev/2',
            'https://c.dev',
        ]);
        expect(proposal.groups[0].tabIds).toEqual([100, 103]);
        expect(proposal.ungroupedTabIds).toEqual([101, 102, 104]);
    });
});
