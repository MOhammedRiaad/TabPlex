import { KeyPoint, NoteSource } from '../../../types';

// The quick view of the four pages in e2e/pages/ (dns-caching, dns-ttl, negative-caching, sourdough-bread), as the
// extractors produce them. Generated once from the real readPage, cleanPage and extractPointsQuick; static data.
export const E2E_SOURCES: NoteSource[] = [
    {
        ref: 1,
        tabId: 0,
        windowId: 1,
        title: 'DNS caching explained',
        url: 'https://dns-guide.test/dns-caching',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 2,
        tabId: 0,
        windowId: 1,
        title: 'How TTL values control DNS caching',
        url: 'https://ttl-guide.test/dns-ttl',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 3,
        tabId: 0,
        windowId: 1,
        title: 'Caching missing names',
        url: 'https://resolver-notes.test/negative-caching',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 4,
        tabId: 0,
        windowId: 1,
        title: 'Sourdough bread at home',
        url: 'https://kitchen.test/sourdough-bread',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
];

export const E2E_POINTS: KeyPoint[] = [
    {
        id: 'p1-1',
        sourceRef: 1,
        text: 'DNS caching keeps the answers a resolver has already received so that a repeated lookup for the same name does not need another round trip across the internet. Caching happens in several places at once: the browser, the operating system, the home router and the recursive resolver run by an internet provider.',
        topicHint: '',
    },
    {
        id: 'p1-2',
        sourceRef: 1,
        text: 'When a resolver receives an answer, it stores the record in memory together with the time it arrived. The next client that asks for the same name gets the stored answer at once, which makes most page loads start faster.',
        topicHint: 'Where answers are stored',
    },
    {
        id: 'p1-3',
        sourceRef: 1,
        text: 'An uncached lookup can take tens of milliseconds, and a single web page may need dozens of lookups for its images, scripts and fonts. Caching removes most of that waiting.',
        topicHint: 'Why caching matters',
    },
    {
        id: 'p2-1',
        sourceRef: 2,
        text: 'Every DNS record carries a time to live, usually shortened to TTL, measured in seconds. A resolver may keep the record for that long, and it must ask the authoritative server again once the time has passed.',
        topicHint: '',
    },
    {
        id: 'p2-2',
        sourceRef: 2,
        text: 'A record with a TTL of 3600 seconds can be reused for one hour before the resolver contacts the authoritative server again. Short values such as 300 seconds let an owner change a website address quickly, but they cause more lookups overall.',
        topicHint: 'Choosing a TTL',
    },
    {
        id: 'p2-3',
        sourceRef: 2,
        text: 'Long TTL values reduce traffic and make pages load faster for visitors. Short TTL values make changes visible sooner, which matters during a server move or an outage.',
        topicHint: 'Trade-offs',
    },
    {
        id: 'p3-1',
        sourceRef: 3,
        text: 'Without it, every typing mistake or misconfigured domain would send a new question to the authoritative server each time someone asked for that name.',
        topicHint: '',
    },
    {
        id: 'p3-2',
        sourceRef: 3,
        text: "The authoritative server tells the resolver how long to keep a negative answer. That period is taken from the zone's SOA record, and resolvers usually cap it at a few hours so that a newly created name becomes visible soon.",
        topicHint: 'How long a miss is kept',
    },
    {
        id: 'p3-3',
        sourceRef: 3,
        text: 'Negative answers are common for mail servers and for software that checks many optional names. Keeping them for a short time saves a large number of questions, while still letting a new name appear quickly after it is created.',
        topicHint: 'Why it helps',
    },
    {
        id: 'p4-1',
        sourceRef: 4,
        text: 'Sourdough bread needs only flour, water, salt and a live starter. Mix the flour and water first, rest the dough for thirty minutes, and then add the salt and the starter before the first set of folds.',
        topicHint: '',
    },
    {
        id: 'p4-2',
        sourceRef: 4,
        text: 'During the bulk fermentation the dough rises at room temperature for four to six hours. Give it a fold every half hour for the first two hours, so the gluten builds structure without any kneading.',
        topicHint: 'Bulk fermentation',
    },
    {
        id: 'p4-3',
        sourceRef: 4,
        text: 'Bake the loaf in a hot covered pot for twenty minutes, then remove the lid and bake until the crust is deep brown. Let the bread cool on a rack for at least an hour before slicing it.',
        topicHint: 'Baking',
    },
];
