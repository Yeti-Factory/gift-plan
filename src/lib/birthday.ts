export const BIRTHDAY_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function isBirthday(value: unknown): value is string {
  if (typeof value !== "string" || !/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value))
    return false;
  const [month, day] = value.split("-").map(Number);
  return day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function birthdayFromParts(day: string, month: string): string | null {
  if (!day || !month) return null;
  const value = `${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isBirthday(value) ? value : null;
}

export function formatBirthday(value: unknown): string | null {
  if (!isBirthday(value)) return null;
  const [month, day] = value.split("-").map(Number);
  return `${day === 1 ? "1er" : day} ${BIRTHDAY_MONTHS[month - 1]}`;
}
