// The site a URL belongs to, for grouping and matching tabs by site. No DOM: usable in the background too.

/** Two-part public suffixes common enough to matter. Not exhaustive by design. */
const TWO_PART_SUFFIXES = new Set([
    'co.uk',
    'org.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'net.au',
    'org.au',
    'co.nz',
    'co.jp',
    'ne.jp',
    'com.br',
    'com.mx',
    'com.tr',
    'com.eg',
    'co.in',
    'co.za',
    'com.sg',
    'com.cn',
    'com.hk',
    'co.kr',
]);

/** "docs.github.com" → "github.com"; "news.bbc.co.uk" → "bbc.co.uk"; IPs and "localhost" stay as they are */
export function siteKey(rawUrl: string): string | null {
    let host: string;
    try {
        const url = new URL(rawUrl);
        if (url.protocol === 'file:') return 'Local files';
        host = url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
    if (!host) return null;
    if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return host;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    return TWO_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}
