/**
 * Utility to detect mismatches between a date range string and a record type.
 * Supports both ISO format (2026-03-01 to 2026-03-29) and
 * natural language format (March 1, 2026 to March 29, 2026).
 */

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseNaturalDate(text: string): Date | null {
  // Match "March 1, 2026" or "Mar 1 2026" or "1 March 2026"
  const patterns = [
    // "March 1, 2026" or "March 1 2026"
    /([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i,
    // "1 March 2026"
    /(\d{1,2})\s+([a-z]+)\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let monthStr: string, dayStr: string, yearStr: string;

      if (/^\d/.test(match[1])) {
        // "1 March 2026" format
        dayStr = match[1];
        monthStr = match[2];
        yearStr = match[3];
      } else {
        // "March 1, 2026" format
        monthStr = match[1];
        dayStr = match[2];
        yearStr = match[3];
      }

      const month = MONTH_NAMES[monthStr.toLowerCase()];
      if (month !== undefined) {
        return new Date(Number(yearStr), month, Number(dayStr));
      }
    }
  }

  return null;
}

export function parseDateRange(dateRange: string): { start: Date | null; end: Date | null; days: number } {
  const cleaned = dateRange.replace(/\s+/g, ' ').trim();

  // Split by "to", " - ", " – ", " — "
  const separatorMatch = cleaned.match(/^(.+?)\s+(?:to|-|–|—)\s+(.+)$/i);
  if (!separatorMatch) return { start: null, end: null, days: 0 };

  const startStr = separatorMatch[1].trim();
  const endStr = separatorMatch[2].trim();

  // Try ISO format first (2026-03-01)
  let start = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(startStr)
    ? new Date(startStr.replace(/\//g, '-'))
    : parseNaturalDate(startStr);

  let end = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(endStr)
    ? new Date(endStr.replace(/\//g, '-'))
    : parseNaturalDate(endStr);

  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { start: null, end: null, days: 0 };
  }

  const diffMs = Math.abs(end.getTime() - start.getTime());
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1; // inclusive
  return { start, end, days };
}

export function detectDateRangeType(days: number): 'daily' | 'weekly' | 'monthly' | null {
  if (days <= 0) return null;
  if (days === 1) return 'daily';
  if (days >= 2 && days <= 10) return 'weekly';
  if (days >= 11) return 'monthly';
  return null;
}

export function getRecordTypeLabel(type: string): string {
  switch (type) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    default: return type;
  }
}

export type MismatchInfo = {
  days: number;
  detectedType: string;
  selectedType: string;
  message: string;
};

export function checkDateRangeMismatch(
  dateRange: string,
  recordType: 'daily' | 'weekly' | 'monthly'
): MismatchInfo | null {
  if (!dateRange) return null;
  const { days } = parseDateRange(dateRange);
  if (days <= 0) return null;
  const detectedType = detectDateRangeType(days);
  if (!detectedType) return null;
  if (detectedType === recordType) return null;

  return {
    days,
    detectedType,
    selectedType: recordType,
    message: `The date range spans ${days} day${days !== 1 ? 's' : ''}, which looks like a ${getRecordTypeLabel(detectedType)} record, but it was submitted as "${getRecordTypeLabel(recordType)}".`,
  };
}
