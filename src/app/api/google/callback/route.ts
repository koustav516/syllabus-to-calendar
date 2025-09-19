// src/app/api/google/callback/route.ts
import { NextResponse } from "next/server";
import { serialize } from "cookie";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/google/callback`;
const COOKIE_NAME = "gcal_tokens";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) {
            const error = url.searchParams.get("error") ?? "missing_code";
            return NextResponse.json(
                { error: `Missing code in callback: ${error}` },
                { status: 400 }
            );
        }

        // Exchange code for tokens
        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code",
            }),
        });

        const tokenJson = await tokenResp.json();

        if (!tokenResp.ok) {
            console.error("Token exchange failed", tokenJson);
            return NextResponse.json(
                { error: "Token exchange failed", raw: tokenJson },
                { status: 500 }
            );
        }

        // Log tokenJson keys (server-side) for verification (do NOT log secrets in production)
        console.log("Google tokenJson keys:", Object.keys(tokenJson));
        // tokenJson should include access_token, refresh_token (if granted), scope, expires_in, token_type

        // Store the entire token JSON in an httpOnly cookie (dev/demo).
        const cookieValue = JSON.stringify(tokenJson);
        const res = NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL}/?connected=google`
        );
        res.headers.set(
            "Set-Cookie",
            serialize(COOKIE_NAME, cookieValue, {
                httpOnly: true,
                path: "/",
                maxAge: COOKIE_MAX_AGE,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
            })
        );

        return res;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("google callback error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
