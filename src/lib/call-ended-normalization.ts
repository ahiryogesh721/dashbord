type VisitScheduleInput = {
  rawVisitTime?: string | null;
  englishVisitTime?: string | null;
  visitDate?: string | Date | null;
  visitDateTime?: string | Date | null;
  now?: Date;
};

export type NormalizedVisitSchedule = {
  rawText: string | null;
  englishText: string | null;
  visitDate: string | null;
  visitDateTime: string | null;
};

const ARABIC_INDIC_DIGITS: Record<string, string> = {
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
  "\u06F0": "0",
  "\u06F1": "1",
  "\u06F2": "2",
  "\u06F3": "3",
  "\u06F4": "4",
  "\u06F5": "5",
  "\u06F6": "6",
  "\u06F7": "7",
  "\u06F8": "8",
  "\u06F9": "9",
};

const ARABIC_TO_LATIN: Record<string, string> = {
  "\u0627": "a",
  "\u0623": "a",
  "\u0625": "i",
  "\u0622": "aa",
  "\u0628": "b",
  "\u062A": "t",
  "\u062B": "th",
  "\u062C": "j",
  "\u062D": "h",
  "\u062E": "kh",
  "\u062F": "d",
  "\u0630": "dh",
  "\u0631": "r",
  "\u0632": "z",
  "\u0633": "s",
  "\u0634": "sh",
  "\u0635": "s",
  "\u0636": "d",
  "\u0637": "t",
  "\u0638": "z",
  "\u0639": "a",
  "\u063A": "gh",
  "\u0641": "f",
  "\u0642": "q",
  "\u0643": "k",
  "\u0644": "l",
  "\u0645": "m",
  "\u0646": "n",
  "\u0647": "h",
  "\u0629": "h",
  "\u0648": "w",
  "\u064A": "y",
  "\u0649": "a",
  "\u0626": "e",
  "\u0624": "o",
  "\u0621": "",
  " ": " ",
};

const GOAL_ARABIC_TO_ENGLISH: Array<[RegExp, string]> = [
  [/\u0634\u0631\u0627\u0621/g, "buy"],
  [/\u0628\u064A\u0639/g, "sell"],
  [/\u0627\u064A\u062C\u0627\u0631/g, "rent"],
  [/\u0625\u064A\u062C\u0627\u0631/g, "rent"],
  [/\u0627\u0633\u062A\u062B\u0645\u0627\u0631/g, "investment"],
  [/\u0633\u0643\u0646\u064A/g, "residential"],
  [/\u0633\u0643\u0646/g, "residential"],
  [/\u062A\u062C\u0627\u0631\u064A/g, "commercial"],
  [/\u0634\u0642\u0629/g, "apartment"],
  [/\u0641\u064A\u0644\u0627/g, "villa"],
  [/\u062F\u0648\u0628\u0644\u0643\u0633/g, "duplex"],
  [/\u0627\u0633\u062A\u0648\u062F\u064A\u0648/g, "studio"],
  [/\u0623\u0631\u0636/g, "land"],
  [/\u0627\u0631\u0636/g, "land"],
  [/\u0645\u0643\u062A\u0628/g, "office"],
  [/\u0645\u062D\u0644/g, "shop"],
  [/\u063A\u0631\u0641\u0629/g, "room"],
  [/\u063A\u0631\u0641\u062A\u064A\u0646/g, "two-bedroom"],
  [/\u062B\u0644\u0627\u062B/g, "three"],
  [/\u063A\u0631\u0641/g, "rooms"],
];

const VISIT_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u060C/g, ","],
  [/\u0628\u0639\u062F\s*\u063A\u062F/g, "day after tomorrow"],
  [/\u063A\u062F\u0627/g, "tomorrow"],
  [/\u063A\u062F\u064B\u0627/g, "tomorrow"],
  [/\u0628\u0643\u0631\u0629/g, "tomorrow"],
  [/\u0627\u0644\u064A\u0648\u0645/g, "today"],
  [/\u0628\u0639\u062F\s*\u0627\u0644\u0638\u0647\u0631/g, "PM"],
  [/\u0627\u0644\u0638\u0647\u0631/g, "12:00 PM"],
  [/\u0645\u0646\u062A\u0635\u0641\s*\u0627\u0644\u0644\u064A\u0644/g, "12:00 AM"],
  [/\u0635\u0628\u0627\u062D\u064B\u0627/g, "AM"],
  [/\u0635\u0628\u0627\u062D\u0627/g, "AM"],
  [/\u0645\u0633\u0627\u0621\u064B/g, "PM"],
  [/\u0645\u0633\u0627\u0621/g, "PM"],
  [/\u0627\u0644\u0633\u0627\u0639\u0629/g, "at"],
  [/\u0633\u0627\u0639\u0629/g, "at"],
  [/\u0639\u0646\u062F/g, "at"],
  [/\u0641\u064A/g, "at"],
];

const ARABIC_MONTHS_TO_ENGLISH: Array<[RegExp, string]> = [
  [/\u064A\u0646\u0627\u064A\u0631/g, "January"],
  [/\u0641\u0628\u0631\u0627\u064A\u0631/g, "February"],
  [/\u0645\u0627\u0631\u0633/g, "March"],
  [/\u0627\u0628\u0631\u064A\u0644/g, "April"],
  [/\u0623\u0628\u0631\u064A\u0644/g, "April"],
  [/\u0645\u0627\u064A\u0648/g, "May"],
  [/\u064A\u0648\u0646\u064A\u0648/g, "June"],
  [/\u064A\u0648\u0644\u064A\u0648/g, "July"],
  [/\u0627\u063A\u0633\u0637\u0633/g, "August"],
  [/\u0623\u063A\u0633\u0637\u0633/g, "August"],
  [/\u0633\u0628\u062A\u0645\u0628\u0631/g, "September"],
  [/\u0627\u0643\u062A\u0648\u0628\u0631/g, "October"],
  [/\u0623\u0643\u062A\u0648\u0628\u0631/g, "October"],
  [/\u0646\u0648\u0641\u0645\u0628\u0631/g, "November"],
  [/\u062F\u064A\u0633\u0645\u0628\u0631/g, "December"],
];

const MONTH_INDEX = new Map<string, number>([
  ["january", 1],
  ["february", 2],
  ["march", 3],
  ["april", 4],
  ["may", 5],
  ["june", 6],
  ["july", 7],
  ["august", 8],
  ["september", 9],
  ["october", 10],
  ["november", 11],
  ["december", 12],
]);

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned : null;
}

function containsArabicScript(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function toAsciiDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => ARABIC_INDIC_DIGITS[digit] ?? digit);
}

function removeArabicDiacritics(value: string): string {
  return value.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => (token.length === 1 ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1).toLowerCase()))
    .join(" ");
}

function transliterateArabic(value: string): string {
  const normalized = toAsciiDigits(removeArabicDiacritics(value));
  let output = "";

  for (const char of normalized) {
    if (ARABIC_TO_LATIN[char] !== undefined) {
      output += ARABIC_TO_LATIN[char];
      continue;
    }

    output += char;
  }

  return output
    .replace(/['"`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b[a-z]\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVisitTextToEnglish(value: string): string {
  let normalized = toAsciiDigits(removeArabicDiacritics(value));

  for (const [pattern, replacement] of ARABIC_MONTHS_TO_ENGLISH) {
    normalized = normalized.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of VISIT_TEXT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/\s+/g, " ")
    .replace(/\bat\s+at\b/gi, "at")
    .replace(/\bPM\s+PM\b/gi, "PM")
    .replace(/\bAM\s+AM\b/gi, "AM")
    .trim();
}

function formatDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function dateOnlyFromDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDateInput(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dateOnlyFromDate(value);
  }

  const cleaned = cleanText(toAsciiDigits(value));
  if (!cleaned) return null;

  const yearFirst = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirst) {
    return formatDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }

  const dayMonthYear = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dayMonthYear) {
    const first = Number(dayMonthYear[1]);
    const second = Number(dayMonthYear[2]);
    const rawYear = Number(dayMonthYear[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    return formatDate(year, month, day);
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : dateOnlyFromDate(parsed);
}

function parseDateTimeInput(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(toAsciiDigits(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function datePartsFromNow(now: Date, plusDays: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + plusDays));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function parseDateFromVisitText(value: string, now: Date): string | null {
  const normalized = value.toLowerCase();

  if (normalized.includes("day after tomorrow")) {
    const parts = datePartsFromNow(now, 2);
    return formatDate(parts.year, parts.month, parts.day);
  }

  if (normalized.includes("tomorrow")) {
    const parts = datePartsFromNow(now, 1);
    return formatDate(parts.year, parts.month, parts.day);
  }

  if (normalized.includes("today")) {
    const parts = datePartsFromNow(now, 0);
    return formatDate(parts.year, parts.month, parts.day);
  }

  const yearFirst = normalized.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (yearFirst) {
    return formatDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }

  const dayMonthYear = normalized.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dayMonthYear) {
    const first = Number(dayMonthYear[1]);
    const second = Number(dayMonthYear[2]);
    const rawYear = Number(dayMonthYear[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    return formatDate(year, month, day);
  }

  const dayMonthText = normalized.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
  );
  if (dayMonthText) {
    const month = MONTH_INDEX.get(dayMonthText[2].toLowerCase()) ?? null;
    return month ? formatDate(Number(dayMonthText[3]), month, Number(dayMonthText[1])) : null;
  }

  const monthDayText = normalized.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i,
  );
  if (monthDayText) {
    const month = MONTH_INDEX.get(monthDayText[1].toLowerCase()) ?? null;
    return month ? formatDate(Number(monthDayText[3]), month, Number(monthDayText[2])) : null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : dateOnlyFromDate(parsed);
}

function parseTimeFromVisitText(value: string): { hour: number; minute: number } | null {
  const withMeridiem = value.match(/\b(?:at\s*)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (withMeridiem) {
    const hourValue = Number(withMeridiem[1]);
    const minuteValue = Number(withMeridiem[2] ?? "0");
    if (!Number.isInteger(hourValue) || hourValue < 1 || hourValue > 12) return null;

    const meridiem = withMeridiem[3].toLowerCase();
    const hour = meridiem === "pm" ? (hourValue % 12) + 12 : hourValue % 12;
    return { hour, minute: minuteValue };
  }

  const twentyFourHour = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) {
    return { hour: Number(twentyFourHour[1]), minute: Number(twentyFourHour[2]) };
  }

  const atHour = value.match(/\bat\s+([01]?\d|2[0-3])\b/i);
  if (atHour) {
    return { hour: Number(atHour[1]), minute: 0 };
  }

  return null;
}

function buildDateTimeIso(date: string, hour: number, minute: number): string | null {
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeGoalText(value: string): string {
  let normalized = toAsciiDigits(removeArabicDiacritics(value));

  for (const [pattern, replacement] of GOAL_ARABIC_TO_ENGLISH) {
    normalized = normalized.replace(pattern, replacement);
  }

  if (containsArabicScript(normalized)) {
    normalized = transliterateArabic(normalized);
  }

  return normalized
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

function normalizeNameText(value: string): string {
  const normalized = containsArabicScript(value)
    ? transliterateArabic(toAsciiDigits(removeArabicDiacritics(value)))
    : toAsciiDigits(value);

  return titleCase(
    normalized
      .replace(/[^\p{L}\p{N}\s'.-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function normalizeCustomerNameToEnglish(input: {
  customerName?: string | null;
  customerNameEnglish?: string | null;
}): string | null {
  const preferred = cleanText(input.customerNameEnglish);
  if (preferred) return cleanText(normalizeNameText(preferred));

  const source = cleanText(input.customerName);
  if (!source) return null;
  return cleanText(normalizeNameText(source));
}

export function normalizeGoalToEnglish(input: {
  goal?: string | null;
  goalEnglish?: string | null;
}): string | null {
  const preferred = cleanText(input.goalEnglish);
  if (preferred) return cleanText(normalizeGoalText(preferred));

  const source = cleanText(input.goal);
  if (!source) return null;
  return cleanText(normalizeGoalText(source));
}

export function normalizeVisitSchedule(input: VisitScheduleInput): NormalizedVisitSchedule {
  const now = input.now ?? new Date();
  const rawText = cleanText(input.rawVisitTime);

  const englishSource = cleanText(input.englishVisitTime) ?? rawText;
  const englishText = englishSource ? normalizeVisitTextToEnglish(englishSource) : null;

  const explicitDateTime = parseDateTimeInput(input.visitDateTime);
  const explicitDate = parseDateInput(input.visitDate);

  let visitDateTime = explicitDateTime;
  let visitDate = explicitDateTime ? explicitDateTime.slice(0, 10) : explicitDate;

  if (!visitDate && englishText) {
    visitDate = parseDateFromVisitText(englishText, now);
  }

  if (!visitDateTime && visitDate && englishText) {
    const time = parseTimeFromVisitText(englishText);
    if (time) {
      visitDateTime = buildDateTimeIso(visitDate, time.hour, time.minute);
    }
  }

  if (!visitDateTime && englishText) {
    visitDateTime = parseDateTimeInput(englishText);
    if (visitDateTime && !visitDate) {
      visitDate = visitDateTime.slice(0, 10);
    }
  }

  if (!visitDate && visitDateTime) {
    visitDate = visitDateTime.slice(0, 10);
  }

  return {
    rawText,
    englishText,
    visitDate,
    visitDateTime,
  };
}
