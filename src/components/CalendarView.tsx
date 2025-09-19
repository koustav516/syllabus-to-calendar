"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import {
    EventApi,
    EventInput,
    EventClickArg,
    DateSelectArg,
} from "@fullcalendar/core";

import { useCallback, useMemo, useState } from "react";
import type { SyllabusEvent } from "../lib/types";
import EventEditor from "./EventEditor";

export type CalendarViewProps = {
    events: SyllabusEvent[];
    onEventsChange: (events: SyllabusEvent[]) => void;
    initialDate?: string;
};

export default function CalendarView({
    events,
    onEventsChange,
    initialDate,
}: CalendarViewProps) {
    const [editingEvent, setEditingEvent] = useState<SyllabusEvent | null>(
        null
    );

    const fcEvents = useMemo<EventInput[]>(
        () =>
            events.map((ev) => {
                const start = ev.time ? `${ev.date}T${ev.time}` : ev.date;
                return {
                    id: ev.id,
                    title: ev.title,
                    start,
                    allDay: !ev.time,
                };
            }),
        [events]
    );

    const handleEventDropOrResize = useCallback(
        (eventApi: EventApi) => {
            const id = eventApi.id;
            const updated = events.map((ev) => {
                if (ev.id !== id) return ev;
                const newStart = eventApi.start;
                if (!newStart) return ev;
                const yyyy = newStart.getFullYear();
                const mm = String(newStart.getMonth() + 1).padStart(2, "0");
                const dd = String(newStart.getDate()).padStart(2, "0");
                const isoDate = `${yyyy}-${mm}-${dd}`;
                const hasTime = !eventApi.allDay;
                const time = hasTime
                    ? `${String(newStart.getHours()).padStart(2, "0")}:${String(
                          newStart.getMinutes()
                      ).padStart(2, "0")}`
                    : undefined;
                return { ...ev, date: isoDate, time };
            });
            onEventsChange(updated);
        },
        [events, onEventsChange]
    );

    // Event click => open editor
    function handleEventClick(clickInfo: EventClickArg) {
        const id = clickInfo.event.id;
        const found = events.find((e) => e.id === id) ?? null;
        if (found) setEditingEvent(found);
    }

    // Add a new event on date select
    function handleDateSelect(selectInfo: DateSelectArg) {
        const dateStr = selectInfo.startStr
            ? selectInfo.startStr.slice(0, 10)
            : null;
        if (!dateStr) return;
        const newEvent: SyllabusEvent = {
            id: cryptoRandomId(),
            title: "New Event",
            date: dateStr,
            time: undefined,
            durationMinutes: 60,
            type: "other",
            description: "",
            sourceLine: "",
            confidence: 1,
        };
        onEventsChange([...events, newEvent]);
        setEditingEvent(newEvent);
    }

    function handleEditorSave(updated: SyllabusEvent) {
        const next = events.map((ev) => (ev.id === updated.id ? updated : ev));
        onEventsChange(next);
        setEditingEvent(null);
    }

    function handleEditorDelete(id: string) {
        const next = events.filter((ev) => ev.id !== id);
        onEventsChange(next);
        setEditingEvent(null);
    }

    return (
        <div>
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                initialDate={initialDate}
                headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                events={fcEvents}
                editable={true}
                selectable={true}
                selectMirror={true}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDrop={(info) => handleEventDropOrResize(info.event)}
                eventResize={(info) => handleEventDropOrResize(info.event)}
                height="auto"
            />

            <div style={{ marginTop: 12 }}>
                <small>
                    Click a date to add an event. Click an event to edit.
                </small>
            </div>

            <EventEditor
                event={editingEvent}
                onClose={() => setEditingEvent(null)}
                onSave={handleEditorSave}
                onDelete={handleEditorDelete}
            />
        </div>
    );
}

function cryptoRandomId(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }
    return "id-" + Math.random().toString(36).slice(2, 9);
}
