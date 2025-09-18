import { NextResponse } from "next/server";
import { extractTextFromFile } from "../../../lib/extractTextFromFile";
import type { SyllabusEvent } from "../../../lib/types";

/**
 * LLM-based syllabus parser route.
 * Accepts JSON: { filename: string, dataBase64: string, fallbackYear?: number }
 * Returns JSON: { events: SyllabusEvent[] } or { error: string, raw?: string }
 *
 * Requires process.env.OPENAI_API_KEY to be set.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

type LlmRequest = {
    filename: string;
    dataBase64: string;
    fallbackYear?: number;
};

export async function POST(request: Request) {
    try {
        if (!OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "OpenAI API key not configured (set OPENAI_API_KEY)" },
                { status: 500 }
            );
        }

        const payload = (await request
            .json()
            .catch(() => ({}))) as Partial<LlmRequest>;
        const filename =
            typeof payload.filename === "string" ? payload.filename : "";
        const dataBase64 =
            typeof payload.dataBase64 === "string" ? payload.dataBase64 : "";
        const fallbackYear =
            typeof payload.fallbackYear === "number"
                ? payload.fallbackYear
                : undefined;

        if (!filename || !dataBase64) {
            return NextResponse.json(
                { error: "Request must include filename and dataBase64" },
                { status: 400 }
            );
        }

        // decode base64 (strip data: prefix if present)
        const commaIndex = dataBase64.indexOf(",");
        const rawBase64 =
            commaIndex >= 0 ? dataBase64.slice(commaIndex + 1) : dataBase64;
        const buffer = Buffer.from(rawBase64, "base64");

        // debug log (temporary) — put this right after `const payload = ...`
        console.log("llm-parse payload keys:", Object.keys(payload));
        console.log("filename:", filename);
        console.log(
            "dataBase64 (first 120 chars):",
            typeof dataBase64 === "string"
                ? dataBase64.slice(0, 120)
                : typeof dataBase64
        );
        console.log(
            "dataBase64 length:",
            typeof dataBase64 === "string" ? dataBase64.length : "n/a"
        );

        // extract plain text from file
        const text = await extractTextFromFile(buffer, filename);

        // build prompt and call LLM
        const prompt = buildPromptForSyllabusParsing(text, fallbackYear);

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // change to model you have access to if needed
                messages: [
                    {
                        role: "system",
                        content:
                            "You are an assistant that extracts calendar events from course syllabi.",
                    },
                    { role: "user", content: prompt },
                ],
                temperature: 0.0,
                max_tokens: 1600,
            }),
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            return NextResponse.json(
                { error: "LLM request failed", raw: errorText },
                { status: 502 }
            );
        }

        const body = await resp.json().catch(() => ({}));
        const assistantText =
            typeof body?.choices?.[0]?.message?.content === "string"
                ? body.choices[0].message.content
                : undefined;

        if (!assistantText) {
            return NextResponse.json(
                { error: "Empty LLM response", raw: JSON.stringify(body) },
                { status: 500 }
            );
        }

        // LLM should return strictly valid JSON array. Attempt parse.
        let events: SyllabusEvent[] = [];
        try {
            // Some LLMs add whitespace/newlines — trim first
            const trimmed = assistantText.trim();
            events = JSON.parse(trimmed) as SyllabusEvent[];
            // Minimal runtime validation: ensure date + title fields exist
            if (!Array.isArray(events))
                throw new Error("Parsed JSON is not an array");
            for (const ev of events) {
                if (
                    typeof ev.date !== "string" ||
                    typeof ev.title !== "string"
                ) {
                    throw new Error(
                        "Each event must have a 'date' (YYYY-MM-DD) and 'title' string"
                    );
                }
            }
        } catch (err) {
            // Return the raw assistant text for debugging when parse fails.
            const message = err instanceof Error ? err.message : String(err);
            return NextResponse.json(
                {
                    error: "Failed to parse JSON returned by LLM: " + message,
                    raw: assistantText,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({ events }, { status: 200 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("llm-parse error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Build prompt that instructs the LLM to return exact JSON matching SyllabusEvent[] */
function buildPromptForSyllabusParsing(
    text: string,
    fallbackYear?: number
): string {
    const yearHint = fallbackYear
        ? ` Assume year ${fallbackYear} for dates lacking a year.`
        : "";
    // limit text size to avoid token overflows; keep large slice
    const snippet = text.length > 23000 ? text.slice(0, 23000) : text;
    return `
You will be given the plain text of an academic syllabus. Extract calendar-relevant items (lectures, readings with due dates, assignments, quizzes, midterms/finals, and other dated events) and RETURN ONLY a JSON array that exactly matches this TypeScript type (no commentary, no code fences):

export type EventType = "assignment" | "reading" | "exam" | "lecture" | "other";
export interface SyllabusEvent {
  id: string;           // short unique id such as "e1","e2"...
  title: string;
  date: string;         // ISO yyyy-mm-dd
  time?: string;        // optional "HH:MM" (24h)
  durationMinutes?: number;
  type?: EventType;
  description?: string;
  sourceLine?: string;  // original text line from the syllabus
  confidence?: number;  // 0..1
}

${yearHint}

Rules:
- Return strictly valid JSON ONLY. Do not include any explanatory text.
- Include an item for every explicit calendar date or clear date range. If a range (e.g., "April 3-4") appears, you may output a single event with the start date and indicate the range in description.
- Put the original sentence/line in "sourceLine".
- Confidence: 0.9+ for explicit dates/types; 0.4-0.7 for inferred or ambiguous items.
- Use short generated ids like "e1", "e2", ...

Syllabus text (begin):
---
${snippet}
---
Return the JSON array now.
`.trim();
}
