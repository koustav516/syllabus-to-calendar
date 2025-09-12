export type EventType = "assignment" | "reading" | "exam" | "lecture" | "other";

export interface SyllabusEvent {
    id: string; // uuid or simple unique id
    title: string;
    date: string; // ISO date yyyy-mm-dd
    time?: string; // optional time HH:MM (24h)
    durationMinutes?: number; // optional
    type?: EventType;
    description?: string;
    sourceLine?: string; // original text snippet
    confidence?: number; // 0..1 parsed confidence
}
