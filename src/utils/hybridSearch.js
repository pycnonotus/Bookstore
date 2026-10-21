import catalog from '../data/books.json' with {type: 'json'};
import {parsePriceConstraints, matchesPrice, explicitTopics} from './searchConstraints.js';

export const TEXT_THRESHOLD = 0.5;
export const COVER_THRESHOLD = 0.25;
const ignored = new Set('a an the i me my you it its is are can could please find show suggest recommend recommendations want need looking for some something any book books read reading about on of and or to in with that this like more cover picture image photo front looks cost by'.split(' '));
const canonical = {
    maths: 'math',
    mathematics: 'math',
    mathematical: 'math',
    js: 'javascript',
    libs: 'library',
    libraries: 'library',
    flowers: 'flower',
    floral: 'flower',
    blooms: 'flower',
    bloom: 'flower',
    poppy: 'flower',
    recipes: 'recipe',
    beginners: 'beginner',
    introductory: 'beginner',
    basic: 'beginner',
    kids: 'children',
    kid: 'children',
    veggies: 'vegetable',
    vegetables: 'vegetable',
    coding: 'programming',
    paintings: 'painting',
    sculptures: 'sculpture',
    bust: 'sculpture',
    css3: 'css',
    html5: 'html'
};

export function searchTokens(text) {
    return [...new Set(text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(word => word.length > 1 && !ignored.has(word) && !/^\d+$/.test(word)).map(word => canonical[word] || word))];
}

export function searchDocument(book) {
    // Specific metadata comes before the description to avoid repeated boilerplate.
    return `${book.name}. ${book.auth}. Topic: ${book.topic}. Subjects: ${(book.subjects || []).join(', ')}. ${(book.aliases || []).join(', ')}. ${book.readingLevel === 'unspecified' ? '' : book.readingLevel || ''}. ${book.description}`;
}

function oneEdit(left, right) {
    if (Math.abs(left.length - right.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < left.length && j < right.length) {
        if (left[i] === right[j]) {
            i++;
            j++;
            continue;
        }
        if (++edits > 1) return false;
        if (left.length >= right.length) i++;
        if (right.length >= left.length) j++;
    }
    return edits + (i < left.length || j < right.length ? 1 : 0) <= 1;
}

export function hybridBookMatches(query, semanticMatches = [], {
    kind = 'text',
    limit = Infinity,
    books = catalog
} = {}) {
    const constraints = parsePriceConstraints(query);
    if (constraints.invalid) return [];
    const topics = kind === 'cover' ? [] : explicitTopics(constraints.freeText);
    let terms = searchTokens(constraints.freeText);
    const level = terms.includes('beginner') ? 'beginner' : terms.includes('advanced') ? 'advanced' : terms.includes('children') ? 'children' : null;
    terms = terms.filter(term => !['beginner', 'advanced', 'children'].includes(term));
    const source = books.filter(book => matchesPrice(book.price, constraints) && (!topics.length || topics.includes(book.topic)) && (!level || book.readingLevel === level));
    const dense = new Map(semanticMatches.filter(match => Number.isFinite(match.score) && match.score <= 1.000001 && match.score >= (kind === 'cover' ? COVER_THRESHOLD : TEXT_THRESHOLD)).map(match => [match.id, Math.min(1, match.score)]));
    const lexicon = new Set(books.flatMap(book => searchTokens(`${book.name} ${(book.subjects || []).join(' ')} ${(book.aliases || []).join(' ')} ${book.topic} ${kind === 'cover' ? book.coverDescription || '' : ''}`)));
    terms = terms.map(term => !lexicon.has(term) && term.length >= 5 ? [...lexicon].find(word => oneEdit(term, word)) || term : term);
    const rows = source.map(book => {
        const fields = kind === 'cover'
            ? [[(book.coverDescription || '').replace(/"[^"]*"/g, '').replace(/\b(?:white|black|gold|golden)\s+(?:(?:serif|sans-serif|bold|small|large)\s+)*(?:typography|text|lettering)/gi, 'lettering'), 6]]
            : [[book.name, 7], [book.auth, 6], [(book.subjects || []).join(' '), 5], [(book.aliases || []).join(' '), 4], [book.topic, 4], [book.description, 1]];
        const sets = fields.map(([text, weight]) => [new Set(searchTokens(text)), weight]);
        const hitTerms = terms.filter(term => sets.some(([set]) => set.has(term)));
        const coverage = terms.length ? hitTerms.length / terms.length : 0;
        const lexical = terms.reduce((score, term) => score + Math.max(0, ...sets.map(([set, weight]) => set.has(term) ? weight : 0)), 0) * coverage;
        const normalized = constraints.freeText.trim().toLowerCase();
        const exact = normalized.length > 2 && (book.name.toLowerCase() === normalized || book.auth.toLowerCase() === normalized);
        const facetOnly = terms.length === 0 && (level || constraints.min !== null || constraints.max !== null);
        const eligible = exact || facetOnly || (coverage >= 0.5 && lexical > 0) || dense.has(book.id);
        const reason = kind === 'cover' ? coverage >= 0.5 ? 'Matches cover description' : 'Visually related cover'
            : exact ? 'Exact title or author' : topics.length && hitTerms.every(term => ['math', 'programming', 'cooking', 'art'].includes(term)) ? `Topic: ${book.topic}`
                : coverage >= 0.5 ? 'Matches your search' : 'Related by meaning';
        return {book, lexical, exact, eligible, reason, similarity: dense.get(book.id) ?? null};
    }).filter(row => row.eligible);
    const lexicalRanks = new Map(rows.filter(row => row.lexical > 0 || row.exact).sort((a, b) => Number(b.exact) - Number(a.exact) || b.lexical - a.lexical).map((row, i) => [row.book.id, i + 1]));
    const denseRanks = new Map(rows.filter(row => row.similarity !== null).sort((a, b) => b.similarity - a.similarity).map((row, i) => [row.book.id, i + 1]));
    // Reciprocal rank fusion combines rankings without pretending their scores are probabilities.
    return rows.map(row => ({
        ...row,
        score: (row.exact ? 1 : 0) + (lexicalRanks.has(row.book.id) ? 1 / (60 + lexicalRanks.get(row.book.id)) : 0) + (denseRanks.has(row.book.id) ? 1 / (60 + denseRanks.get(row.book.id)) : 0)
    }))
        .sort((a, b) => b.score - a.score || b.lexical - a.lexical || a.book.name.localeCompare(b.book.name)).slice(0, limit);
}

export function filterShelfGroups(groups, selectedTopics, matches) {
    const ranks = matches === null ? null : new Map(matches.map((row, index) => [row.book.id, index]));
    return groups.filter(group => selectedTopics.length === 0 || selectedTopics.includes(group.topic))
        .map(group => ({
            ...group,
            books: ranks ? group.books.filter(book => ranks.has(book.id)).sort((a, b) => ranks.get(a.id) - ranks.get(b.id)) : group.books
        }))
        .filter(group => group.books.length > 0);
}
