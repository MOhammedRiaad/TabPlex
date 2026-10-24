// Fixture corpus for groupTopics (spec §7.3, §16): seven pages read in tab-strip order.
// Refs 1, 3 and 5 are DNS caching pages; 2 is about CPU caches, 4 is a recipe, 6 and 7 are React useEffect pages.
// Points are what the quick view and the model produce: one sentence each, with a topic hint. Pages 3 and 5 repeat a
// sentence almost word for word (a duplicate); pages 1 and 5 give different TTLs for the same record type (a conflict);
// pages 3 and 5 agree on 3600 seconds.
import { KeyPoint, NoteSource } from '../../../types';

export const DNS_REFS = [1, 3, 5] as const;
export const CPU_REF = 2;
export const RECIPE_REF = 4;
export const REACT_REFS = [6, 7] as const;

export const CORPUS_SOURCES: NoteSource[] = [
    {
        ref: 1,
        tabId: 101,
        windowId: 1,
        title: 'DNS caching explained',
        url: 'https://dns.example/caching-explained',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 2,
        tabId: 102,
        windowId: 1,
        title: 'CPU cache hierarchy',
        url: 'https://cpu.example/cache-hierarchy',
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 3,
        tabId: 103,
        windowId: 1,
        title: 'Caching DNS answers and TTL',
        url: 'https://netnotes.example/dns-ttl?utm=feed',
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 4,
        tabId: 104,
        windowId: 2,
        title: 'Easy sourdough bread',
        url: 'https://kitchen.example/sourdough',
        mode: 'ai',
        truncated: true,
        notEnglish: false,
    },
    {
        ref: 5,
        tabId: 105,
        windowId: 2,
        title: 'How DNS resolver caches work',
        url: 'https://resolver.example/how-caching-works',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 6,
        tabId: 106,
        windowId: 2,
        title: 'useEffect in depth',
        url: 'https://react.example/use-effect',
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 7,
        tabId: 107,
        windowId: 2,
        title: 'Effects and cleanup in React',
        url: 'https://frontend.example/react-effects',
        mode: 'quick',
        truncated: false,
        notEnglish: false,
    },
];

const point = (sourceRef: number, n: number, text: string, topicHint: string): KeyPoint => ({
    id: `p${sourceRef}-${n}`,
    sourceRef,
    text,
    topicHint,
});

export const CORPUS_POINTS: KeyPoint[] = [
    // 1: DNS caching explained
    point(
        1,
        1,
        'A DNS resolver keeps each answer it receives in a local cache so that repeat lookups do not travel across the network.',
        'DNS caching'
    ),
    point(
        1,
        2,
        'The default TTL on most DNS records is 300 seconds, so cached answers expire after five minutes.',
        'TTL'
    ),
    point(
        1,
        3,
        'Negative answers, such as NXDOMAIN, are cached as well, for a shorter period set by the zone SOA record.',
        'Negative caching'
    ),
    point(
        1,
        4,
        'Browsers and operating systems keep their own small DNS caches on top of the resolver cache.',
        'Browser DNS cache'
    ),

    // 2: CPU cache hierarchy
    point(
        2,
        1,
        'A CPU cache is a small, fast memory placed close to the core, holding copies of recently used data from main memory.',
        'CPU caches'
    ),
    point(
        2,
        2,
        'L1 caches are the smallest and fastest, usually split into separate instruction and data caches for each core.',
        'Cache levels'
    ),
    point(2, 3, 'Cache lines move between the levels in fixed blocks of 64 bytes.', 'Cache lines'),
    point(
        2,
        4,
        'With a write-back cache, a changed line is held until it is evicted, while the MESI protocol keeps other cores coherent.',
        'Coherence'
    ),

    // 3: Caching DNS answers and TTL
    point(3, 1, 'The resolver caches every answer it receives, so repeat lookups skip the network.', 'DNS caching'),
    point(
        3,
        2,
        'TTL is the number of seconds a cached DNS answer stays valid before the resolver must refresh it.',
        'TTL'
    ),
    point(3, 3, 'Long TTL values such as 3600 seconds cut query load but delay changes to records.', 'TTL'),
    point(
        3,
        4,
        'Operators lower the TTL a day before a server move, so the new address spreads quickly.',
        'TTL changes'
    ),

    // 4: Easy sourdough bread
    point(4, 1, 'Mix 500 grams of flour with 350 millilitres of warm water and a spoon of salt.', 'Ingredients'),
    point(4, 2, 'Knead the dough for ten minutes until it is smooth and springs back when pressed.', 'Kneading'),
    point(4, 3, 'Let the dough rise in a warm place for about two hours, or until it has doubled in size.', 'Proving'),
    point(4, 4, 'Bake the loaf in a hot oven at 230 degrees for 35 minutes, until the crust is deep brown.', 'Baking'),

    // 5: How DNS resolver caches work
    point(5, 1, 'The resolver caches every answer it receives, so repeated lookups skip the network.', 'DNS caching'),
    point(5, 2, 'The default TTL on most DNS records is 3600 seconds, so cached answers expire after an hour.', 'TTL'),
    point(
        5,
        3,
        'Negative answers are cached too, but only for as long as the zone SOA record allows.',
        'Negative caching'
    ),
    point(
        5,
        4,
        'The resolver keeps a cached answer until its TTL runs out, then asks the authoritative server again.',
        'DNS caching'
    ),

    // 6: useEffect in depth
    point(6, 1, 'useEffect runs your code after React has rendered the component and updated the DOM.', 'useEffect'),
    point(6, 2, 'Return a cleanup function from the effect to undo subscriptions before the next run.', 'Cleanup'),
    point(
        6,
        3,
        'The dependency array tells React when to run the effect again: when one of the listed values changes.',
        'Dependency array'
    ),
    point(
        6,
        4,
        'Effects that run on every render are rarely needed; prefer event handlers for user actions.',
        'useEffect'
    ),

    // 7: Effects and cleanup in React
    point(
        7,
        1,
        'An effect runs after the component renders, and React calls it again when its dependencies change.',
        'useEffect'
    ),
    point(7, 2, 'Clean up subscriptions and timers in the cleanup function that the effect returns.', 'Cleanup'),
    point(7, 3, 'An empty dependency array makes the effect run once, after the first render.', 'Dependency array'),
    point(
        7,
        4,
        'Fetching data in an effect needs a guard against stale responses when the component unmounts.',
        'Data fetching'
    ),
];
