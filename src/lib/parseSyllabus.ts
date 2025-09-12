import * as chrono from "chrono-node";
import { ParsedResult } from "chrono-node";
import { v4 as uuidv4 } from "uuid";
import type { SyllabusEvent } from "./types";

/**
 * Parse all dates from a text line using chrono-node.
 */
function parseDatesFromLine(line: string, referenceDate?: Date): Date[] {
    const results: ParsedResult[] = chrono.parse(
        line,
        referenceDate ?? new Date()
    );
    if (!results || results.length === 0) return [];
    return results.map((r: ParsedResult) => r.start.date());
}

/**
 * Simple heuristic classifier
 */
function classifyLine(line: string): {
    type: SyllabusEvent["type"];
    confidence: number;
} {
    const lower = line.toLowerCase();
    if (/\b(homework|hw|assignment|due)\b/.test(lower))
        return { type: "assignment", confidence: 0.9 };
    if (/\b(read|reading|chapter|readings?)\b/.test(lower))
        return { type: "reading", confidence: 0.9 };
    if (/\b(midterm|final|exam|quiz)\b/.test(lower))
        return { type: "exam", confidence: 0.95 };
    if (/\b(lecture|class|topic)\b/.test(lower))
        return { type: "lecture", confidence: 0.7 };
    return { type: "other", confidence: 0.4 };
}

export function parseSyllabusText(
    text: string,
    fallbackYear?: number
): SyllabusEvent[] {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const events: SyllabusEvent[] = [];
    const referenceDate = fallbackYear
        ? new Date(`${fallbackYear}-01-01`)
        : new Date();

    for (const line of lines) {
        const dates = parseDatesFromLine(line, referenceDate);
        if (dates.length === 0) continue;

        for (const dt of dates) {
            const isoDate = dt.toISOString().slice(0, 10);
            const title = line.replace(/\s{2,}/g, " ").slice(0, 140);
            const classification = classifyLine(line);

            events.push({
                id: uuidv4(),
                title,
                date: isoDate,
                time: undefined,
                durationMinutes: 60,
                type: classification.type,
                description: line,
                sourceLine: line,
                confidence: classification.confidence,
            });
        }
    }

    return events;
}
