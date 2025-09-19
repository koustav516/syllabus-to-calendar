import { NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/google/callback`;

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const SCOPE = ["openid", "email", "profile", CALENDAR_SCOPE].join(" ");

export async function GET() {
    if (!CLIENT_ID || !process.env.NEXT_PUBLIC_BASE_URL) {
        return NextResponse.json(
            {
                error: "Missing GOOGLE_CLIENT_ID or NEXT_PUBLIC_BASE_URL environment variables",
            },
            { status: 500 }
        );
    }

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(url);
}
