export const JST_OFFSET = "+09:00";

export function toIso(date: string, time: string): string {
  return `${date}T${time}:00${JST_OFFSET}`;
}

export function epochToJstIso(epochMs: number): string {
  const d = new Date(epochMs + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00${JST_OFFSET}`;
}

export function addMinutesIso(iso: string, minutes: number): string {
  return epochToJstIso(new Date(iso).getTime() + minutes * 60_000);
}

export function jstDate(iso: string): string {
  return epochToJstIso(new Date(iso).getTime()).slice(0, 10);
}

export function jstHhmm(iso: string): string {
  return epochToJstIso(new Date(iso).getTime()).slice(11, 16);
}

export function minutesBetween(fromIso: string, toIso_: string): number {
  return Math.round((new Date(toIso_).getTime() - new Date(fromIso).getTime()) / 60_000);
}

export function dayOffset(iso: string, travelDate: string): number {
  const base = new Date(`${travelDate}T00:00:00${JST_OFFSET}`).getTime();
  const day = new Date(`${jstDate(iso)}T00:00:00${JST_OFFSET}`).getTime();
  return Math.round((day - base) / 86_400_000);
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

export function formatDayBadge(offset: number): string {
  if (offset <= 0) return "";
  if (offset === 1) return "翌";
  return `${offset}日後`;
}
