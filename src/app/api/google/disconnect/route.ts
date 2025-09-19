// src/app/api/google/disconnect/route.ts
import { NextResponse } from "next/server";
import { serialize } from "cookie";

const COOKIE_NAME = "gcal_tokens";

export async function POST() {
    const res = NextResponse.json({ success: true });
    res.headers.set(
        "Set-Cookie",
        serialize(COOKIE_NAME, "", {
            httpOnly: true,
            path: "/",
            maxAge: 0,
            expires: new Date(0),
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        })
    );
    return res;
}
