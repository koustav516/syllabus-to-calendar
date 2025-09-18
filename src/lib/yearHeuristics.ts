// src/lib/yearHeuristics.ts
const MONTHS: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
};

export function inferAcademicFallbackYear(text: string): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const foundMonths: number[] = [];
    const lower = text.toLowerCase();
    for (const [name, num] of Object.entries(MONTHS)) {
        if (lower.includes(name)) foundMonths.push(num);
    }
    if (foundMonths.length === 0) return currentYear;

    foundMonths.sort((a, b) => a - b);
    const mid = Math.floor(foundMonths.length / 2);
    const median =
        foundMonths.length % 2 === 1
            ? foundMonths[mid]
            : Math.round((foundMonths[mid - 1] + foundMonths[mid]) / 2);

    // Heuristics:
    // - If median month is Aug(8) .. Dec(12) -> treat as FALL term.
    //   If now is before August -> choose currentYear, else choose currentYear + 1 (upcoming Fall).
    // - If median month is Jan(1) .. May(5) -> treat as SPRING term.
    //   If now is after August -> choose currentYear + 1 (next year Spring), else currentYear.
    // - Otherwise default to currentYear.
    if (median >= 8 && median <= 12) {
        // fall
        return currentMonth <= 7 ? currentYear : currentYear + 1;
    }
    if (median >= 1 && median <= 5) {
        // spring
        return currentMonth >= 8 ? currentYear + 1 : currentYear;
    }
    return currentYear;
}
