// src/app/api/export-ics/route.ts
import { NextResponse } from "next/server";
import { createEvents, EventAttributes } from "ics";
import type { SyllabusEvent } from "../../../lib/types";

/**
 * Map our SyllabusEvent shape to ics.EventAttributes
 */
function mapSyllabusEventToIcs(ev: SyllabusEvent): EventAttributes {
    // Parse date "YYYY-MM-DD" into numbers
    const parts = ev.date.split("-").map((s) => Number(s));
    const [y, m, d] = parts;
    // default start time 09:00 if not provided
    let hour = 9;
    let minute = 0;

    if (typeof ev.time === "string") {
        const tm = ev.time.trim();
        // accept HH:MM or H:MM formats (24h)
        const match = tm.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
            hour = Number(match[1]);
            minute = Number(match[2]);
        }
    }

    const start = [y, m, d, hour, minute] as const;

    const duration = ev.durationMinutes
        ? { minutes: ev.durationMinutes }
        : { hours: 1 };

    const attrs: EventAttributes = {
        title: ev.title ?? "Syllabus Event",
        description: ev.description ?? "",
        start: Array.from(start) as [number, number, number, number, number],
        duration,
    };

    return attrs;
}

function createIcsString(events: EventAttributes[]): Promise<string> {
    return new Promise((resolve, reject) => {
        // The 'ics' package exposes multiple overloads. Its typings are loose,
        // so we declare the exact callback shape we want here.
        type IcsCallback = (err?: Error, value?: string) => void;

        // Narrow the createEvents function to the exact signature we need,
        // using `unknown` as a safe intermediary (no `any`).
        const createEventsTyped = createEvents as unknown as (
            events: EventAttributes[],
            cb: IcsCallback
        ) => void;

        createEventsTyped(events, (err?: Error, value?: string) => {
            if (err) return reject(err);
            resolve(value ?? "");
        });
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const candidate = body?.events;

        if (!Array.isArray(candidate)) {
            return NextResponse.json(
                { error: "Missing events array" },
                { status: 400 }
            );
        }

        // Validate/map each event into EventAttributes
        const icsEvents: EventAttributes[] = candidate.map((c: unknown) => {
            // runtime guard: check required fields exist
            if (typeof c !== "object" || c === null) {
                throw new Error("Invalid event object in events array");
            }
            const ev = c as SyllabusEvent;

            if (typeof ev.date !== "string" || typeof ev.title !== "string") {
                throw new Error(
                    "Each event must have at least a date (YYYY-MM-DD) and title"
                );
            }

            return mapSyllabusEventToIcs(ev);
        });

        const ics = await createIcsString(icsEvents);

        return new NextResponse(ics, {
            status: 200,
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition":
                    "attachment; filename=syllabus-events.ics",
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("app/api/export-ics error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
