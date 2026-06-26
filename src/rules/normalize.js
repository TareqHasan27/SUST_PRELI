const BANGLA_DIGITS = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9"
};

export function convertBanglaDigits(text = "") {
  return String(text).replace(/[০-৯]/g, (digit) => BANGLA_DIGITS[digit] ?? digit);
}

export function hasBanglaScript(text = "") {
  return /[\u0980-\u09FF]/.test(String(text));
}

export function detectLanguage(ticket = {}) {
  const complaint = ticket.complaint || "";
  if (ticket.language === "bn") return "bn";
  if (ticket.language === "mixed") return "mixed";
  if (hasBanglaScript(complaint)) return "bn";

  const lower = String(complaint).toLowerCase();
  const banglishSignals = [
    "ami", "amar", "apnar", "apni", "bhul", "vul", "taka", "korechi", "korchi",
    "pathaisi", "pathiyechi", "ashe nai", "ase nai", "kete gese", "ferot", "chaiche"
  ];
  if (banglishSignals.some((signal) => lower.includes(signal))) return "mixed";

  return "en";
}

export function normalizePhone(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";
  let digits = convertBanglaDigits(raw).replace(/[^0-9+]/g, "");

  if (digits.startsWith("+880")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("880")) digits = "0" + digits.slice(3);

  return digits.replace(/[^0-9]/g, "");
}

export function extractPhoneCandidates(text = "") {
  const normalized = convertBanglaDigits(String(text));
  const candidates = normalized.match(/(?:\+?8801|01)[0-9\s\-]{8,13}/g) || [];
  return [...new Set(candidates.map(normalizePhone).filter(Boolean))];
}

export function extractAmounts(text = "") {
  const normalized = convertBanglaDigits(String(text));
  const matches = normalized.match(/(?:৳\s*)?\d+(?:\.\d+)?\s*(?:taka|tk|bdt|টাকা|৳)?/gi) || [];
  const amounts = [];

  for (const match of matches) {
    const number = match.match(/\d+(?:\.\d+)?/);
    if (number) amounts.push(Number(number[0]));
  }

  return [...new Set(amounts.filter((n) => Number.isFinite(n)))];
}

export function extractHourHints(text = "") {
  const normalized = convertBanglaDigits(String(text).toLowerCase());
  const hints = [];

  const hourMatches = [...normalized.matchAll(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/g)];
  for (const match of hourMatches) {
    let hour = Number(match[1]);
    const period = match[2];
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    hints.push({ type: "hour", hour });
  }

  if (/(morning|সকাল|sokal|shokal)/i.test(normalized)) {
    hints.push({ type: "range", startHour: 5, endHour: 12 });
  }
  if (/(afternoon|দুপুর|bikel|বিকাল)/i.test(normalized)) {
    hints.push({ type: "range", startHour: 12, endHour: 17 });
  }
  if (/(evening|রাত|night|rate|raate)/i.test(normalized)) {
    hints.push({ type: "range", startHour: 17, endHour: 23 });
  }

  return hints;
}

export function normalizeTicket(ticket = {}) {
  const originalComplaint = ticket.complaint || "";
  const digitNormalized = convertBanglaDigits(originalComplaint);
  const lower = digitNormalized.toLowerCase();
  const language = detectLanguage(ticket);

  return {
    originalComplaint,
    digitNormalizedComplaint: digitNormalized,
    lowerComplaint: lower,
    language,
    hasBangla: hasBanglaScript(originalComplaint),
    amounts: extractAmounts(originalComplaint),
    phones: extractPhoneCandidates(originalComplaint),
    hourHints: extractHourHints(originalComplaint),
    transaction_history: Array.isArray(ticket.transaction_history) ? ticket.transaction_history : []
  };
}
