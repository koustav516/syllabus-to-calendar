// src/app/api/parse/route.ts
import { NextResponse } from "next/server";
import { parseSyllabusText } from "../../../lib/parseSyllabus";
import type { SyllabusEvent } from "../../../lib/types";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        const fallbackYear =
            typeof body?.fallbackYear === "number"
                ? body.fallbackYear
                : undefined;

        if (!text) {
            return NextResponse.json(
                { error: 'Missing "text" in request body.' },
                { status: 400 }
            );
        }

        const events: SyllabusEvent[] = parseSyllabusText(text, fallbackYear);
        return NextResponse.json({ events }, { status: 200 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("app/api/parse error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
