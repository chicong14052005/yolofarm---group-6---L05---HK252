const TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

export function normalizeYoloFarmTimestamp(value: string): string {
  if (!value) return value;

  return value
    .trim()
    .replace(' ', 'T')
    .replace(TIMEZONE_SUFFIX_RE, '');
}

export function parseYoloFarmTime(value: string): Date {
  const normalized = normalizeYoloFarmTimestamp(value);
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(value);
}

export function getYoloFarmTimeMs(value: string): number {
  const parsed = parseYoloFarmTime(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

export function formatLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getLocalDateKey(value: string): string {
  const parsed = parseYoloFarmTime(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatLocalDateKey(parsed);
}

export function isSameLocalDate(value: string, dateKey: string): boolean {
  return getLocalDateKey(value) === dateKey;
}

export function minutesSinceStartOfDay(value: string): number {
  const parsed = parseYoloFarmTime(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getHours() * 60 + parsed.getMinutes() + parsed.getSeconds() / 60;
}

export function formatMinuteLabel(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)));
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}
