// src/app/api/upload/route.ts
import { NextResponse } from "next/server";
import { extractTextFromFile } from "../../../lib/extractTextFromFile";
import { parseSyllabusText } from "../../../lib/parseSyllabus";
import type { SyllabusEvent } from "../../../lib/types";

export async function POST(request: Request) {
    try {
        const payload = await request.json().catch(() => ({}));
        const filename =
            typeof payload?.filename === "string" ? payload.filename : "";
        const dataBase64 =
            typeof payload?.dataBase64 === "string" ? payload.dataBase64 : "";
        const fallbackYear =
            typeof payload?.fallbackYear === "number"
                ? payload.fallbackYear
                : undefined;

        if (!filename || !dataBase64) {
            return NextResponse.json(
                { error: "Request must include filename and dataBase64" },
                { status: 400 }
            );
        }

        // Remove data URL prefix if present: "data:*/*;base64,AAAA..."
        const commaIndex = dataBase64.indexOf(",");
        const rawBase64 =
            commaIndex >= 0 ? dataBase64.slice(commaIndex + 1) : dataBase64;

        // Decode base64 → Buffer
        const buffer = Buffer.from(rawBase64, "base64");

        // Extract text (handles .txt, .pdf, .docx)
        const text = await extractTextFromFile(buffer, filename);

        // Parse into events
        const events: SyllabusEvent[] = parseSyllabusText(text, fallbackYear);

        return NextResponse.json({ events }, { status: 200 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("app/api/upload error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
