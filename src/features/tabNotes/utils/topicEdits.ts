// Review edits (spec §9) over the "combined" view: pure functions on Topic[] and the points they reference. No React,
// no store, no chrome APIs, no model. Every function returns new arrays and objects; inputs are never mutated. A
// bullet's sources are always sourcesOf(pointIds, points): nothing here stores a source number.
import { KeyPoint, NoteSource, Topic, TopicBullet, TopicConflict } from '../types';
import { cleanPointText } from './aiPoints';
import { cleanHeadingText, cleanTopicHeading, sourcesOf, withDistinctHeadings } from './groupTopics';

/** Where a bullet of a shared topic moves: the id of another shared topic, or 'own' (its points' source sections) */
export type MoveTarget = string | 'own';

const copyBullet = (bullet: TopicBullet): TopicBullet => ({ ...bullet, pointIds: [...bullet.pointIds] });
const copyConflict = (conflict: TopicConflict): TopicConflict => ({ ...conflict, pointIds: [...conflict.pointIds] });
const copyTopic = (topic: Topic): Topic => ({
    ...topic,
    bullets: topic.bullets.map(copyBullet),
    conflicts: topic.conflicts.map(copyConflict),
});

const pointsById = (points: KeyPoint[]): Map<string, KeyPoint> => new Map(points.map(point => [point.id, point]));

/** Bullets a bullet becomes when its points go to their own sections: itself for one point, else one per point */
function piecesOf(bullet: TopicBullet, byId: Map<string, KeyPoint>): TopicBullet[] {
    if (bullet.pointIds.length === 1) return [copyBullet(bullet)];
    return bullet.pointIds.map(id => ({
        id: '',
        text: byId.get(id)?.text ?? bullet.text,
        pointIds: [id],
        origin: 'point',
        edited: false,
    }));
}

/** Bullets grouped by the source of their points (every piece has one source) */
function bulletsBySource(bullets: TopicBullet[], points: KeyPoint[]): Map<number, TopicBullet[]> {
    const groups = new Map<number, TopicBullet[]>();
    for (const bullet of bullets) {
        const ref = sourcesOf(bullet.pointIds, points)[0];
        if (ref === undefined) continue;
        groups.set(ref, [...(groups.get(ref) ?? []), bullet]);
    }
    return groups;
}

/** The sources of all bullets of a topic, sorted */
function sourcesOfTopic(topic: Topic, points: KeyPoint[]): number[] {
    return [...new Set(topic.bullets.flatMap(bullet => sourcesOf(bullet.pointIds, points)))].sort((a, b) => a - b);
}

/** Heading of a new source section: the source's title (cleaned like every heading), or "Topic <ref>" */
function sectionHeading(ref: number, sources: NoteSource[]): string {
    return cleanTopicHeading(sources.find(source => source.ref === ref)?.title ?? '', ref);
}

/**
 * A topic after some of its bullets (and conflicts) left. Its 'ai' label stays only while an 'ai' bullet remains, when
 * an 'ai' bullet left (spec §9, remove source); otherwise it becomes 'words'.
 */
function withBullets(topic: Topic, bullets: TopicBullet[], conflicts: TopicConflict[], aiLeft: boolean): Topic {
    const aiRemains = bullets.some(bullet => bullet.origin === 'ai');
    const combinedBy = aiLeft && topic.combinedBy === 'ai' ? (aiRemains ? 'ai' : 'words') : topic.combinedBy;
    return { ...topic, bullets, conflicts, combinedBy };
}

/** Adds bullets to the source section of each ref, creating the section (appended) where there is none */
function addToSections(topics: Topic[], groups: Map<number, TopicBullet[]>, sources: NoteSource[]): Topic[] {
    const out = topics.map(copyTopic);
    for (const [ref, bullets] of groups) {
        const section = out.find(topic => topic.kind === 'source' && topic.sourceRef === ref);
        if (section) {
            section.bullets.push(...bullets.map(copyBullet));
            continue;
        }
        out.push({
            id: '',
            heading: sectionHeading(ref, sources),
            kind: 'source',
            sourceRef: ref,
            combinedBy: null,
            bullets: bullets.map(copyBullet),
            conflicts: [],
        });
    }
    return out;
}

/** Gives every topic a new id (t1..tN) and every bullet a new id (b1..bM over the whole view, in output order) */
function renumber(topics: Topic[]): Topic[] {
    let bulletNumber = 0;
    return topics.map((topic, index) => {
        const copy = copyTopic(topic);
        return {
            ...copy,
            id: `t${index + 1}`,
            bullets: copy.bullets.map(bullet => ({ ...bullet, id: `b${++bulletNumber}` })),
        };
    });
}

/**
 * The shared cleanup every action ends with: empty topics and bullets without points go, source sections of one ref
 * become one section, bullets are in the §7.8 order (most sources, lowest ref, earliest point), topics are shared
 * first (most sources, lowest ref, most bullets), then source sections by ref. Ids are renumbered and headings made
 * distinct. Idempotent.
 */
export function normalizeTopics(topics: Topic[], points: KeyPoint[]): Topic[] {
    const order = new Map(points.map((point, index) => [point.id, index]));
    const sections = new Map<number, Topic>();
    const kept: Topic[] = [];
    for (const topic of topics) {
        const bullets = topic.bullets.filter(bullet => bullet.pointIds.length > 0).map(copyBullet);
        if (bullets.length === 0) continue;
        if (topic.kind === 'source' && topic.sourceRef !== undefined) {
            const section = sections.get(topic.sourceRef);
            if (section) {
                section.bullets.push(...bullets);
                section.conflicts.push(...topic.conflicts.map(copyConflict));
                continue;
            }
        }
        const copy: Topic = { ...copyTopic(topic), bullets };
        if (topic.kind === 'source' && topic.sourceRef !== undefined) sections.set(topic.sourceRef, copy);
        kept.push(copy);
    }

    // Bullet order (§7.8): sort keys computed once per bullet
    const rankOf = (bullet: TopicBullet) => {
        const refs = sourcesOf(bullet.pointIds, points);
        const first = Math.min(...bullet.pointIds.map(id => order.get(id) ?? Number.MAX_SAFE_INTEGER));
        return { count: refs.length, lowest: refs[0] ?? Number.MAX_SAFE_INTEGER, first };
    };
    for (const topic of kept) {
        const ranked = new Map(topic.bullets.map(bullet => [bullet, rankOf(bullet)]));
        topic.bullets.sort((a, b) => {
            const x = ranked.get(a);
            const y = ranked.get(b);
            if (!x || !y) return 0;
            return y.count - x.count || x.lowest - y.lowest || x.first - y.first;
        });
    }

    // Topic order (§7.8): shared topics by sources, then source sections by ref
    const rankOfTopic = new Map(
        kept.map(topic => {
            if (topic.kind === 'source') {
                return [topic, { shared: 1, count: 0, lowest: topic.sourceRef ?? Number.MAX_SAFE_INTEGER, bullets: 0 }];
            }
            const refs = sourcesOfTopic(topic, points);
            return [
                topic,
                {
                    shared: 0,
                    count: refs.length,
                    lowest: refs[0] ?? Number.MAX_SAFE_INTEGER,
                    bullets: topic.bullets.length,
                },
            ];
        })
    );
    kept.sort((a, b) => {
        const x = rankOfTopic.get(a);
        const y = rankOfTopic.get(b);
        if (!x || !y) return 0;
        return x.shared - y.shared || y.count - x.count || x.lowest - y.lowest || y.bullets - x.bullets;
    });
    return withDistinctHeadings(renumber(kept));
}

/**
 * A shared topic whose points come from one source is that source's section (spec §7.3 step 9, §9): its bullets move
 * into the section (created if missing) and its conflicts go, since a conflict needs two sources. Then normalizeTopics.
 */
function settle(topics: Topic[], points: KeyPoint[], sources: NoteSource[]): Topic[] {
    const kept: Topic[] = [];
    const movedBullets = new Map<number, TopicBullet[]>();
    for (const topic of topics) {
        const refs = topic.kind === 'shared' ? sourcesOfTopic(topic, points) : [];
        if (refs.length !== 1) {
            kept.push(topic);
            continue;
        }
        movedBullets.set(refs[0], [...(movedBullets.get(refs[0]) ?? []), ...topic.bullets]);
    }
    return normalizeTopics(addToSections(kept, movedBullets, sources), points);
}

/**
 * The heading of one topic set to `heading`, cleaned. A heading that cleans to '' keeps the old one. Duplicates get
 * " (2)". Ids are kept: nothing about the structure changed.
 */
export function renameTopic(topics: Topic[], topicId: string, heading: string): Topic[] {
    const clean = cleanHeadingText(heading);
    const renamed = topics.map(topic => {
        const copy = copyTopic(topic);
        return clean !== '' && topic.id === topicId ? { ...copy, heading: clean } : copy;
    });
    return withDistinctHeadings(renamed);
}

/**
 * Text of one bullet, cleaned like a point (cleanPointText). Sources stay as they are; the bullet is `edited`. Ids are
 * kept, so the row the user is editing keeps its id. Text that cleans to nothing changes nothing.
 */
export function editBullet(topics: Topic[], bulletId: string, text: string): Topic[] {
    const clean = cleanPointText(text);
    return topics.map(topic => {
        const copy = copyTopic(topic);
        return {
            ...copy,
            bullets: copy.bullets.map(item =>
                clean !== '' && item.id === bulletId ? { ...item, text: clean, edited: true } : item
            ),
        };
    });
}

/**
 * Removes a bullet from this view only: its points stay in the draft and nothing else changes, except that a topic left
 * with no bullets goes, and a shared topic whose bullets now come from one source becomes that source's section.
 */
export function removeBullet(topics: Topic[], bulletId: string, points: KeyPoint[], sources: NoteSource[]): Topic[] {
    const out = topics.map(topic => {
        const removed = topic.bullets.find(bullet => bullet.id === bulletId);
        const bullets = topic.bullets.filter(bullet => bullet.id !== bulletId).map(copyBullet);
        return withBullets(topic, bullets, topic.conflicts.map(copyConflict), removed?.origin === 'ai');
    });
    return settle(out, points, sources);
}

/** Removes one conflict of a topic (index into Topic.conflicts). Other conflicts are kept; ids are kept. */
export function removeConflict(topics: Topic[], topicId: string, index: number): Topic[] {
    return topics.map(topic => {
        const copy = copyTopic(topic);
        return topic.id === topicId ? { ...copy, conflicts: copy.conflicts.filter((_, i) => i !== index) } : copy;
    });
}

/**
 * Moves a bullet of a shared topic to another shared topic (appended; the topic's bullet order applies), or to 'own':
 * the bullet splits into one bullet per point (a single-point bullet moves as it is), each into its source's section.
 * A conflict of the bullet's topic that loses a point is dropped, as in removeSource. Shared topics left with no bullets
 * go, and one whose points now come from one source becomes that source's section. Unknown ids change nothing.
 */
export function moveBullet(
    topics: Topic[],
    bulletId: string,
    target: MoveTarget,
    points: KeyPoint[],
    sources: NoteSource[]
): Topic[] {
    const from = topics.find(topic => topic.kind === 'shared' && topic.bullets.some(bullet => bullet.id === bulletId));
    const bullet = from?.bullets.find(item => item.id === bulletId);
    if (!from || !bullet) return renumber(topics);
    const destination =
        target === 'own'
            ? undefined
            : topics.find(topic => topic.id === target && topic.kind === 'shared' && topic !== from);
    if (target !== 'own' && !destination) return renumber(topics);

    const movedIds = new Set(bullet.pointIds);
    const out = topics.map(topic => {
        if (topic === from) {
            const bullets = topic.bullets.filter(item => item.id !== bulletId).map(copyBullet);
            const conflicts = topic.conflicts.filter(conflict => !conflict.pointIds.some(id => movedIds.has(id)));
            return withBullets(topic, bullets, conflicts.map(copyConflict), bullet.origin === 'ai');
        }
        if (topic === destination) {
            const copy = copyTopic(topic);
            return { ...copy, bullets: [...copy.bullets, copyBullet(bullet)] };
        }
        return copyTopic(topic);
    });
    if (target !== 'own') return settle(out, points, sources);
    const pieces = bulletsBySource(piecesOf(bullet, pointsById(points)), points);
    return settle(addToSections(out, pieces, sources), points, sources);
}

/**
 * The topics a bullet may move to: the other shared topics. [] when the bullet is not in a shared topic, since only the
 * bullets of shared topics have a Move to control.
 */
export function moveTargets(topics: Topic[], bulletId: string): Topic[] {
    const from = topics.find(topic => topic.bullets.some(bullet => bullet.id === bulletId));
    if (!from || from.kind !== 'shared') return [];
    return topics.filter(topic => topic.kind === 'shared' && topic.id !== from.id);
}

/** The sources of a bullet: sourcesOf(its pointIds, points). The only source of attribution. */
export function bulletSources(bullet: TopicBullet, points: KeyPoint[]): number[] {
    return sourcesOf(bullet.pointIds, points);
}

/**
 * Dissolves a shared topic: every bullet becomes its points, each back in its source's section (a single-point bullet
 * moves as it is). Its conflicts are dropped. No effect on source sections or unknown ids.
 */
export function separateBySource(topics: Topic[], topicId: string, points: KeyPoint[], sources: NoteSource[]): Topic[] {
    const topic = topics.find(item => item.id === topicId);
    if (!topic || topic.kind !== 'shared') return renumber(topics);
    const byId = pointsById(points);
    const pieces = topic.bullets.flatMap(bullet => piecesOf(bullet, byId));
    const rest = topics.filter(item => item !== topic).map(copyTopic);
    return settle(addToSections(rest, bulletsBySource(pieces, points), sources), points, sources);
}

/**
 * Takes the points in `gone` out of every topic (the rules of removeSource). `points` are the draft's points before the
 * removal. Shared topics left with one source become that source's section.
 */
function withoutPoints(topics: Topic[], gone: Set<string>, points: KeyPoint[], sources: NoteSource[]): Topic[] {
    const byId = pointsById(points);
    const textOf = (id: string, fallback: string) => byId.get(id)?.text ?? fallback;
    const out = topics.map(topic => {
        let aiLeft = false;
        const bullets: TopicBullet[] = [];
        for (const bullet of topic.bullets) {
            const remaining = bullet.pointIds.filter(id => !gone.has(id));
            if (remaining.length === bullet.pointIds.length) {
                bullets.push(copyBullet(bullet));
                continue;
            }
            if (bullet.origin === 'ai') aiLeft = true;
            if (remaining.length === 0) continue;
            if (bullet.origin === 'ai' && !bullet.edited) {
                for (const id of remaining) {
                    bullets.push({
                        id: '',
                        text: textOf(id, bullet.text),
                        pointIds: [id],
                        origin: 'point',
                        edited: false,
                    });
                }
                continue;
            }
            const takesNext = bullet.origin === 'point' && !bullet.edited && gone.has(bullet.pointIds[0]);
            const text = takesNext ? textOf(remaining[0], bullet.text) : bullet.text;
            bullets.push({ ...copyBullet(bullet), pointIds: remaining, text });
        }
        const conflicts = topic.conflicts
            .filter(conflict => !conflict.pointIds.some(id => gone.has(id)))
            .map(copyConflict);
        return withBullets(topic, bullets, conflicts, aiLeft);
    });
    return settle(out, points, sources);
}

/**
 * Removes a source from every topic (spec §9). Its points leave every bullet and conflict; a bullet with no points left
 * goes. An unedited 'ai' bullet that lost a point becomes one 'point' bullet per remaining point (its wording may come
 * from the removed page); an edited one keeps its text and loses the id. A 'point' bullet whose lead point left takes
 * the next remaining point's text and ids, unless it is edited (then its text stays). Conflicts that lose a point are
 * dropped. `points` are the draft's points before the removal. Shared topics left with one source become that source's
 * section.
 */
export function removeSource(topics: Topic[], ref: number, points: KeyPoint[], sources: NoteSource[]): Topic[] {
    const gone = new Set(points.filter(point => point.sourceRef === ref).map(point => point.id));
    return withoutPoints(topics, gone, points, sources);
}

/**
 * Removes one point from every topic, with the rules of removeSource (a bullet of one point goes; an unedited 'ai'
 * bullet that lost a point becomes its remaining points' texts). Used when a point is removed in the By tab view, so the
 * Combined view loses it without regrouping. `points` are the draft's points before the removal.
 */
export function removePoint(topics: Topic[], pointId: string, points: KeyPoint[], sources: NoteSource[]): Topic[] {
    return withoutPoints(topics, new Set([pointId]), points, sources);
}

/**
 * Removes a topic from this view only (the topic's ✕): its bullets and conflicts go, its points stay in the draft. Other
 * topics are unchanged, apart from the shared cleanup of settle. Unknown ids change nothing but the renumbering.
 */
export function removeTopic(topics: Topic[], topicId: string, points: KeyPoint[], sources: NoteSource[]): Topic[] {
    const rest = topics.filter(topic => topic.id !== topicId).map(copyTopic);
    return settle(rest, points, sources);
}
