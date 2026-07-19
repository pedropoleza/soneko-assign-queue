import { ghlFetch } from "./client";
import type { Appointment } from "@/lib/types";

/** Calendars & appointments (GHL v2). Events are fetched per calendar over a range. */

interface RawCalendar {
  id: string;
  name?: string;
  isActive?: boolean;
}
interface RawEvent {
  id: string;
  calendarId?: string;
  contactId?: string;
  title?: string;
  appointmentStatus?: string;
  startTime?: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  booked: "Novo",
  confirmed: "Confirmado",
  showed: "Compareceu",
  noshow: "No-show",
  cancelled: "Cancelado",
  invalid: "Inválido",
};

export function apptStatusLabel(s?: string): string {
  return STATUS_LABEL[(s ?? "").toLowerCase()] ?? "Novo";
}

export async function getCalendars(locationId: string): Promise<{ id: string; name: string }[]> {
  const data = await ghlFetch<{ calendars?: RawCalendar[] }>("/calendars/", { locationId, query: { locationId } });
  return (data.calendars ?? [])
    .filter((c) => c.isActive !== false)
    .map((c) => ({ id: c.id, name: c.name ?? "Calendário" }));
}

export async function getAppointments(
  locationId: string,
  range: { startMs: number; endMs: number },
): Promise<Appointment[]> {
  const cals = await getCalendars(locationId);
  const out: Appointment[] = [];
  for (const cal of cals) {
    const data = await ghlFetch<{ events?: RawEvent[] }>("/calendars/events", {
      locationId,
      query: { locationId, calendarId: cal.id, startTime: range.startMs, endTime: range.endMs },
    }).catch(() => ({ events: [] as RawEvent[] }));
    for (const e of data.events ?? []) {
      out.push({
        id: e.id,
        calendarId: cal.id,
        calendarName: cal.name,
        contactId: e.contactId,
        title: e.title ?? "Agendamento",
        status: apptStatusLabel(e.appointmentStatus),
        startTime: e.startTime,
      });
    }
  }
  return out;
}
