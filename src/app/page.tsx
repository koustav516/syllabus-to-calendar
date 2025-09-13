// src/app/parse/page.tsx
"use client";
import { useState } from "react";
import type { SyllabusEvent } from "../lib/types";

export default function ParsePage() {
    const [text, setText] = useState("");
    const [events, setEvents] = useState<SyllabusEvent[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    async function handleParseText() {
        setLoading(true);
        setError(null);
        setEvents(null);
        try {
            const resp = await fetch("/api/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error ?? "Parsing failed");
            setEvents(data.events);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setError(null);
        setEvents(null);
        setLoading(true);
        try {
            const base64 = await readFileAsDataURL(file);
            const resp = await fetch("/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: file.name,
                    dataBase64: base64,
                }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error ?? "Upload/parse failed");
            setEvents(data.events);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleExportIcs() {
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

    return (
        <div
            style={{
                maxWidth: 980,
                margin: "2rem auto",
                fontFamily: "system-ui",
            }}
        >
            <h1>Syllabus → Calendar</h1>

            <section style={{ marginBottom: 18 }}>
                <h3>Paste syllabus text</h3>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={10}
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
            </section>

            <section style={{ marginBottom: 18 }}>
                <h3>Or upload a file (.txt / .pdf / .docx)</h3>
                <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileChange}
                />
                {fileName && <div>Selected: {fileName}</div>}
            </section>

            {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

            {events && (
                <section>
                    <h3>Parsed events ({events.length})</h3>
                    <button onClick={handleExportIcs}>Export .ics</button>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            marginTop: 10,
                        }}
                    >
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Confidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev) => (
                                <tr key={ev.id}>
                                    <td style={{ padding: 6 }}>{ev.date}</td>
                                    <td style={{ padding: 6 }}>{ev.title}</td>
                                    <td style={{ padding: 6 }}>{ev.type}</td>
                                    <td style={{ padding: 6 }}>
                                        {(ev.confidence ?? 0).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
