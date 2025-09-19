// src/app/api/google/insert/route.ts
import { NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";
import { parse } from "cookie";
import type { SyllabusEvent } from "../../../../lib/types";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

type InsertRequest = { events: SyllabusEvent[] };

async function getOAuthClientFromCookie(req: Request) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookies = parse(cookieHeader || "");
    if (!cookies.gcal_tokens) return null;

    const tokenJson = JSON.parse(cookies.gcal_tokens) as {
        access_token: string;
        refresh_token?: string;
        expiry_date?: number;
    };

    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    oAuth2Client.setCredentials({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        expiry_date: tokenJson.expiry_date,
    });

    return oAuth2Client;
}

export async function POST(request: Request) {
    try {
        const oAuth2Client = await getOAuthClientFromCookie(request);
        if (!oAuth2Client) {
            return NextResponse.json(
                { error: "Not authenticated to Google" },
                { status: 401 }
            );
        }

        const body = (await request.json().catch(() => ({}))) as InsertRequest;
        if (!Array.isArray(body.events)) {
            return NextResponse.json(
                { error: "Missing events array" },
                { status: 400 }
            );
        }

        const calendar = google.calendar({
            version: "v3",
            auth: oAuth2Client,
        });

        const results: Array<{
            status: "ok" | "error";
            item?: calendar_v3.Schema$Event;
            error?: string;
        }> = [];

        for (const ev of body.events) {
            const eventResource: calendar_v3.Schema$Event = {
                summary: ev.title,
                description: ev.description ?? ev.sourceLine ?? "",
                status: "confirmed",
            };

            if (ev.time) {
                const startDateTime = `${ev.date}T${ev.time}:00`;
                eventResource.start = { dateTime: startDateTime };

                const durationMinutes = ev.durationMinutes ?? 60;
                const dt = new Date(startDateTime);
                const end = new Date(dt.getTime() + durationMinutes * 60000);
                eventResource.end = {
                    dateTime: end.toISOString().slice(0, 19),
                };
            } else {
                eventResource.start = { date: ev.date };
                eventResource.end = { date: ev.date };
            }

            try {
                const insertResp = await calendar.events.insert({
                    calendarId: "primary",
                    requestBody: eventResource,
                });
                results.push({ status: "ok", item: insertResp.data });
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);
                results.push({ status: "error", error: message });
            }
        }

        return NextResponse.json({ results }, { status: 200 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("google/insert error", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
