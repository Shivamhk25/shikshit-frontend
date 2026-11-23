const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST = 'Asia/Kolkata';

/** "2026-11-22" as "22 Nov 2026", read from the text so the viewer's time zone cannot shift the day. */
export function formatDate(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

/** The calendar parts of an instant as the school keeps them: India time, whatever the viewer's own zone. */
function istParts(d: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "2026-11-23T09:00:00Z" as "23 Nov 2026, 2:30 pm" in India time. */
export function formatDateTime(iso: string | null): string {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return '—';
  const p = istParts(d);
  const h = Number(p.hour);
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${h % 12 || 12}:${p.minute} ${h < 12 ? 'am' : 'pm'}`;
}

/** An instant as the value of a date-time input ("2026-11-23T14:30"), in India time. */
export function toLocalInput(iso: string | null): string {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return '';
  const p = istParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The date-time input's value read as India time and sent as an instant; null when it is empty or not a date-time. */
export function fromLocalInput(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The present moment as the value of a date-time input. */
export const nowLocalInput = () => toLocalInput(new Date().toISOString());
