import { AI_MAX_TITLE_CHARS } from '../constants';

/** "stripe.com/pricing": host without www + path, never the query string or fragment (they can hold tokens) */
export function shortUrlForAi(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '');
        return `${host}${url.pathname === '/' ? '' : url.pathname}`;
    } catch {
        return rawUrl;
    }
}

export function clampTitle(title: string, max = AI_MAX_TITLE_CHARS): string {
    const clean = title.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** "Stripe pricing (stripe.com/pricing)": the one way every AI feature describes a tab */
export function describeTabForAi(tab: { title: string; url: string }): string {
    return `${clampTitle(tab.title || tab.url)} (${shortUrlForAi(tab.url)})`;
}
