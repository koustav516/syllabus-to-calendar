// src/components/EventEditor.tsx
"use client";
import { useEffect, useState } from "react";
import type { SyllabusEvent } from "../lib/types";

export type EditorProps = {
    event: SyllabusEvent | null;
    onClose: () => void;
    onSave: (updated: SyllabusEvent) => void;
    onDelete?: (id: string) => void;
};

export default function EventEditor({
    event,
    onClose,
    onSave,
    onDelete,
}: EditorProps) {
    const [form, setForm] = useState<SyllabusEvent | null>(event);

    useEffect(() => setForm(event), [event]);

    if (!form) return null;

    function update<K extends keyof SyllabusEvent>(
        key: K,
        value: SyllabusEvent[K]
    ) {
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    }

    return (
        <div style={overlayStyle}>
            <div
                style={modalStyle}
                role="dialog"
                aria-modal="true"
                aria-label="Edit event"
            >
                <h3 style={{ marginTop: 0 }}>Edit event</h3>

                <label style={labelStyle}>
                    Title
                    <input
                        value={form.title}
                        onChange={(e) => update("title", e.target.value)}
                        style={inputStyle}
                    />
                </label>

                <label style={labelStyle}>
                    Date (YYYY-MM-DD)
                    <input
                        value={form.date}
                        onChange={(e) => update("date", e.target.value)}
                        style={inputStyle}
                        placeholder="2024-09-01"
                    />
                </label>

                <label style={labelStyle}>
                    Time (HH:MM) — optional
                    <input
                        value={form.time ?? ""}
                        onChange={(e) =>
                            update("time", e.target.value || undefined)
                        }
                        style={inputStyle}
                        placeholder="09:00"
                    />
                </label>

                <label style={labelStyle}>
                    Type
                    <select
                        value={form.type ?? "other"}
                        onChange={(e) =>
                            update(
                                "type",
                                e.target.value as SyllabusEvent["type"]
                            )
                        }
                        style={inputStyle}
                    >
                        <option value="assignment">assignment</option>
                        <option value="reading">reading</option>
                        <option value="exam">exam</option>
                        <option value="lecture">lecture</option>
                        <option value="other">other</option>
                    </select>
                </label>

                <label style={labelStyle}>
                    Confidence
                    <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={(form.confidence ?? 0).toString()}
                        onChange={(e) =>
                            update("confidence", Number(e.target.value))
                        }
                        style={inputStyle}
                    />
                </label>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                        onClick={() => {
                            if (form) onSave(form);
                        }}
                        style={buttonPrimary}
                    >
                        Save
                    </button>
                    <button onClick={onClose} style={button}>
                        Cancel
                    </button>
                    {onDelete && (
                        <button
                            onClick={() => {
                                if (form) onDelete(form.id);
                            }}
                            style={{
                                ...button,
                                background: "#ffdddd",
                                color: "#800",
                            }}
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* Simple inline styles to avoid CSS setup — replace with Tailwind / CSS modules if you want. */
const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
    background: "white",
    padding: 16,
    borderRadius: 8,
    width: 520,
    maxWidth: "95%",
    boxShadow: "0 6px 24px rgba(0,0,0,0.2)",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    marginTop: 8,
    fontSize: 13,
};
const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 8,
    marginTop: 6,
    borderRadius: 6,
    border: "1px solid #ddd",
};
const button: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#f6f6f6",
};
const buttonPrimary: React.CSSProperties = {
    ...button,
    background: "#1f6feb",
    color: "white",
    border: 0,
};
