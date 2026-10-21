const amount = String.raw`\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:\$|usd\b|dollars?\b)?`;

export function parsePriceConstraints(text) {
    const normalized = text.toLowerCase().replace(/\bore\s+more\b/g, 'or more');
    const constraints = [];

    function collect(pattern, make) {
        for (const match of normalized.matchAll(new RegExp(pattern, 'g'))) {
            constraints.push({start: match.index, end: match.index + match[0].length, ...make(match)});
        }
    }

    collect(String.raw`\b(?:between|from)\s*${amount}\s*(?:and|to|[-–])\s*${amount}`, m => ({
        min: +m[1],
        max: +m[2],
        minInclusive: true,
        maxInclusive: true,
        priority: 2
    }));
    collect(String.raw`${amount}\s*(?:[-–]|\bto\b)\s*${amount}`, m => ({
        min: +m[1],
        max: +m[2],
        minInclusive: true,
        maxInclusive: true,
        priority: 2
    }));
    collect(String.raw`\b(?:at least|no less than|not (?:under|below)|minimum(?: of)?|min)\s*${amount}`, m => ({
        min: +m[1],
        minInclusive: true
    }));
    collect(String.raw`\b(?:over|above|more than|greater than)\s*${amount}`, m => ({min: +m[1], minInclusive: false}));
    collect(String.raw`${amount}\s*(?:or more|and (?:above|up)|or higher|minimum)\b`, m => ({
        min: +m[1],
        minInclusive: true
    }));
    collect(String.raw`\b(?:no more than|not (?:over|above)|up to|at most|maximum(?: of)?|max|budget(?: of)?)\s*${amount}`, m => ({
        max: +m[1],
        maxInclusive: true
    }));
    collect(String.raw`\b(?:under|below|less than|cheaper than)\s*${amount}`, m => ({max: +m[1], maxInclusive: false}));
    collect(String.raw`${amount}\s*(?:or less|or fewer|and (?:under|below)|or lower|maximum)\b`, m => ({
        max: +m[1],
        maxInclusive: true
    }));
    // Discard contained matches, e.g. "more than" within "no more than".
    const valid = constraints.filter(row => !constraints.some(other => other !== row && other.start <= row.start && other.end >= row.end && (other.start < row.start || other.end > row.end)));
    const price = {min: null, max: null, minInclusive: true, maxInclusive: true};
    for (const row of valid.sort((a, b) => a.start - b.start)) {
        if (row.min !== undefined) {
            price.min = row.min;
            price.minInclusive = row.minInclusive;
        }
        if (row.max !== undefined) {
            price.max = row.max;
            price.maxInclusive = row.maxInclusive;
        }
    }
    const reset = normalized.lastIndexOf('any price');
    if (reset >= 0 && !valid.some(row => row.start > reset)) {
        price.min = null;
        price.max = null;
    }
    const characters = [...normalized];
    for (const row of valid) characters.fill(' ', row.start, row.end);
    const freeText = characters.join('').replace(/\b(cost|costs|price|priced|budget|dollars|usd|cheaper|ore|more|any price)\b/g, ' ');
    const description = price.min !== null && price.max !== null ? `from $${price.min.toFixed(2)} to $${price.max.toFixed(2)}`
        : price.min !== null ? `${price.minInclusive ? 'at least' : 'over'} $${price.min.toFixed(2)}`
            : price.max !== null ? `${price.maxInclusive ? 'up to' : 'under'} $${price.max.toFixed(2)}` : '';
    return {
        ...price,
        freeText,
        description,
        invalid: price.min !== null && price.max !== null && (price.min > price.max || (price.min === price.max && (!price.minInclusive || !price.maxInclusive)))
    };
}

export function matchesPrice(value, price) {
    if (price.invalid) return false;
    return (price.min === null || (price.minInclusive ? value >= price.min : value > price.min))
        && (price.max === null || (price.maxInclusive ? value <= price.max : value < price.max));
}

export function explicitTopics(text) {
    const topics = {
        math: /\b(math|maths|mathematics|algebra|calculus|statistics|trigonometry)\b/i,
        programming: /\b(programming|coding|javascript|js|jquery|react|html|css|vue|angular|htmx)\b/i,
        cooking: /\b(cooking|cookbooks?|recipes?|baking|cuisine|food)\b/i,
        art: /\b(art|painting|sculpture|portraits?)\b/i
    };
    return Object.entries(topics).filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
}
