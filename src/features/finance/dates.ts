const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function civilDate(value: string) {
  if (!isCivilDate(value)) throw new Error("Data civil inválida.");
  return new Date(`${value}T00:00:00.000Z`);
}

export function civilDateInterval(value: string) {
  const start = civilDate(value);
  const endExclusive = new Date(start);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return { start, endExclusive };
}

export function isMembershipValidOnCivilDate(
  membership: {
    joinedAt: string | Date;
    revokedAt: string | Date | null;
  },
  value: string,
) {
  if (!isCivilDate(value)) return false;

  const { start, endExclusive } = civilDateInterval(value);
  const joinedAt =
    membership.joinedAt instanceof Date
      ? membership.joinedAt
      : new Date(membership.joinedAt);
  const revokedAt =
    membership.revokedAt instanceof Date
      ? membership.revokedAt
      : membership.revokedAt
        ? new Date(membership.revokedAt)
        : null;

  return joinedAt < endExclusive && (revokedAt === null || revokedAt > start);
}

export function todayInTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function monthRangeInTimezone(timeZone: string) {
  const today = todayInTimezone(timeZone);
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, 1));
  const end = new Date(Date.UTC(year!, month!, 1));
  return { start, end };
}

export function formatCivilDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
