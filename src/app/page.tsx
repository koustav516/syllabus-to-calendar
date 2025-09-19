// src/app/parse/page.tsx
"use client";
import { useEffect, useState } from "react";
import type { SyllabusEvent } from "../lib/types";
import CalendarView from "../components/CalendarView";
import { inferAcademicFallbackYear } from "../lib/yearHeuristics";

interface InsertResult {
    status: "ok" | "error";
    item?: { htmlLink?: string };
    error?: string;
}

export default function ParsePage() {
    const [text, setText] = useState<string>("");
    const [events, setEvents] = useState<SyllabusEvent[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = loading

    // fetch google connection status
    async function fetchGoogleStatus(): Promise<void> {
        try {
            const resp = await fetch("/api/google/status");
            if (!resp.ok) {
                setIsConnected(false);
                return;
            }
            const data = (await resp.json()) as { connected?: boolean };
            setIsConnected(Boolean(data?.connected));
        } catch (err) {
            console.error("Failed to fetch google status", err);
            setIsConnected(false);
        }
    }

    useEffect(() => {
        fetchGoogleStatus();

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get("connected") === "google") {
                // remove the query param and re-check status shortly after callback
                window.history.replaceState(
                    {},
                    document.title,
                    window.location.pathname
                );
                setTimeout(() => fetchGoogleStatus(), 300);
            }
        } catch {
            /* ignore on server */
        }
    }, []);

    async function handleParseText(): Promise<void> {
        setLoading(true);
        setError(null);
        setEvents(null);
        try {
            const fallbackYear = inferAcademicFallbackYear(text);
            const resp = await fetch("/api/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, fallbackYear }),
            });
            const data = (await resp.json()) as {
                events?: SyllabusEvent[];
                error?: string;
            };
            if (!resp.ok) throw new Error(data.error ?? "Parsing failed");
            setEvents(data.events ?? []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleFileChange(
        e: React.ChangeEvent<HTMLInputElement>
    ): Promise<void> {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setError(null);
        setEvents(null);
        setLoading(true);
        try {
            const base64 = await readFileAsDataURL(file);
            const fallbackYear = inferAcademicFallbackYear(text);
            const resp = await fetch("/api/llm-parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: file.name,
                    dataBase64: base64,
                    fallbackYear,
                }),
            });
            const data = (await resp.json()) as {
                events?: SyllabusEvent[];
                error?: string;
            };
            if (!resp.ok) throw new Error(data.error ?? "Upload/parse failed");
            setEvents(data.events ?? []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleExportIcs(): Promise<void> {
        if (!events || events.length === 0) return alert("No events to export");
        const resp = await fetch("/api/export-ics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events }),
        });
        if (!resp.ok) {
            const txt = await resp.text();
            return alert("Export failed: " + txt);
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "syllabus-events.ics";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // Redirect user to Google OAuth flow
    function handleConnectGoogle(): void {
        window.location.href = "/api/google/auth";
    }

    // Disconnect - clears cookie (server route)
    async function handleDisconnectGoogle(): Promise<void> {
        try {
            const resp = await fetch("/api/google/disconnect", {
                method: "POST",
            });
            if (!resp.ok) {
                const txt = await resp.text();
                console.error("Disconnect failed", txt);
                alert("Disconnect failed");
                return;
            }
            await fetchGoogleStatus();
            alert("Disconnected from Google");
        } catch (err) {
            console.error("Disconnect error", err);
            alert("Disconnect failed");
        }
    }

    // Send events to Google Calendar
    async function handleSyncToGoogle(): Promise<void> {
        if (!events || events.length === 0) {
            return alert("No events to sync");
        }
        const resp = await fetch("/api/google/insert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events }),
        });
        const data = (await resp.json()) as {
            results?: InsertResult[];
            error?: string;
        };
        if (!resp.ok) {
            console.error("Google insert error", data);
            alert("Sync failed: " + (data.error ?? "unknown"));
            return;
        }
        const results = data.results ?? [];
        const firstLink = results.find(
            (r) => r.status === "ok" && r.item?.htmlLink
        )?.item?.htmlLink;
        if (firstLink) window.open(firstLink, "_blank");
        alert("Events synced to Google Calendar!");
    }

    return (
        <div
            style={{
                maxWidth: 1100,
                margin: "2rem auto",
                fontFamily: "system-ui",
            }}
        >
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                }}
            >
                <h1 style={{ margin: 0 }}>Syllabus → Calendar</h1>
                <div>
                    {isConnected === null ? (
                        <button disabled>Checking Google…</button>
                    ) : isConnected ? (
                        <>
                            <button
                                onClick={handleSyncToGoogle}
                                disabled={!events || events.length === 0}
                                style={{ marginRight: 8 }}
                            >
                                Sync to Google
                            </button>
                            <button onClick={handleDisconnectGoogle}>
                                Disconnect Google
                            </button>
                        </>
                    ) : (
                        <button onClick={handleConnectGoogle}>
                            Connect Google
                        </button>
                    )}
                </div>
            </header>

            <div style={{ display: "grid", gap: 16 }}>
                <div
                    style={{
                        padding: 12,
                        border: "1px solid #eee",
                        borderRadius: 8,
                    }}
                >
                    <h3>Paste syllabus text</h3>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            padding: 10,
                        }}
                    />
                    <div style={{ marginTop: 8 }}>
                        <button onClick={handleParseText} disabled={loading}>
                            {loading ? "Parsing…" : "Parse Text"}
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        padding: 12,
                        border: "1px solid #eee",
                        borderRadius: 8,
                    }}
                >
                    <h3>Or upload a file (.txt / .pdf / .docx)</h3>
                    <input
                        type="file"
                        accept=".txt,.pdf,.docx"
                        onChange={handleFileChange}
                    />
                    {fileName && <div>Selected: {fileName}</div>}
                </div>
            </div>

            {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

            {events && (
                <section style={{ marginTop: 20 }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <h2>Events ({events.length})</h2>
                        <div>
                            <button
                                onClick={() => setEvents(null)}
                                style={{ marginRight: 8 }}
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleExportIcs}
                                style={{ marginRight: 8 }}
                            >
                                Export .ics
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <CalendarView
                            key={events.length}
                            events={events}
                            onEventsChange={setEvents}
                            initialDate={events[0]?.date}
                        />
                    </div>
                </section>
            )}
        </div>
    );
}

function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
            if (typeof fr.result === "string") resolve(fr.result);
            else reject(new Error("Unexpected FileReader result type"));
        };
        fr.onerror = () => reject(new Error("Failed to read file"));
        fr.readAsDataURL(file);
    });
}
