// src/app/api/google/status/route.ts
import { NextResponse } from "next/server";
import { parse } from "cookie";

interface TokenJson {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    [k: string]: unknown;
}

interface StatusResponse {
    connected: boolean;
    hasRefresh?: boolean;
    scope?: string | null;
}

export async function GET(request: Request) {
    try {
        const cookies = parse(request.headers.get("cookie") ?? "");
        if (!cookies.gcal_tokens) {
            return NextResponse.json<StatusResponse>({ connected: false });
        }

        let tokenJson: TokenJson;
        try {
            tokenJson = JSON.parse(cookies.gcal_tokens) as TokenJson;
        } catch (err) {
            console.error("Failed to parse gcal_tokens cookie", err);
            return NextResponse.json<StatusResponse>({ connected: false });
        }

        const scope = tokenJson.scope ?? null;
        const hasRefresh = !!tokenJson.refresh_token;
        const connected = !!tokenJson.access_token;

        return NextResponse.json<StatusResponse>({
            connected,
            hasRefresh,
            scope,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("/api/google/status error:", message);
        return NextResponse.json<StatusResponse>({ connected: false });
    }
}
