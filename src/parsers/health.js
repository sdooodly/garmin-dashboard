/**
 * Garmin Health Data CSV Parsers
 *
 * Parses CSV exports for Steps, Heart Rate, Sleep, and Stress
 * from Garmin Connect's Health & Performance Reports.
 */
import Papa from 'papaparse';

/**
 * Generic CSV parse helper.
 */
function parseCsv(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (!result.data || result.data.length === 0) {
    throw new Error('No data found in the CSV file.');
  }
  return result;
}

function parseNum(val) {
  if (val === undefined || val === null || val === '' || val === '--') return null;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  const parts = str.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    const [a, b, c] = parts.map(Number);
    if (a > 12) return new Date(c, b - 1, a);
    return new Date(c, a - 1, b);
  }
  return null;
}

/**
 * Find a column header that contains the search term (case-insensitive).
 */
function findCol(headers, ...searchTerms) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const term of searchTerms) {
    const idx = lower.findIndex((h) => h.includes(term.toLowerCase()));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/**
 * Parse Steps CSV.
 * Expected columns: Date, Total Steps (or Steps, Daily Steps)
 */
export function parseStepsCSV(csvText) {
  const { data, meta } = parseCsv(csvText);
  const headers = meta.fields || [];

  const dateCol = findCol(headers, 'date', 'day', 'time');
  const stepsCol = findCol(headers, 'total steps', 'steps', 'daily steps', 'step count');
  const goalCol = findCol(headers, 'goal', 'step goal', 'daily goal');

  if (!dateCol || !stepsCol) {
    throw new Error('Could not find date and steps columns in the CSV.');
  }

  return data
    .map((row) => ({
      date: parseDate(row[dateCol]),
      steps: parseNum(row[stepsCol]),
      goal: goalCol ? parseNum(row[goalCol]) : null,
    }))
    .filter((d) => d.date !== null)
    .sort((a, b) => a.date - b.date);
}

/**
 * Parse Heart Rate CSV.
 * Expected columns: Date, Resting HR, Low HR, High HR (or similar)
 */
export function parseHeartRateCSV(csvText) {
  const { data, meta } = parseCsv(csvText);
  const headers = meta.fields || [];

  const dateCol = findCol(headers, 'date', 'day', 'time');
  const restingCol = findCol(headers, 'resting', 'resting hr', 'resting heart rate', 'rhr');
  const lowCol = findCol(headers, 'low', 'min hr', 'minimum', 'low hr');
  const highCol = findCol(headers, 'high', 'max hr', 'maximum', 'high hr');
  const avgCol = findCol(headers, 'avg', 'average', 'avg hr', 'average hr');

  if (!dateCol) {
    throw new Error('Could not find date column in heart rate CSV.');
  }

  return data
    .map((row) => ({
      date: parseDate(row[dateCol]),
      resting: restingCol ? parseNum(row[restingCol]) : null,
      low: lowCol ? parseNum(row[lowCol]) : null,
      high: highCol ? parseNum(row[highCol]) : null,
      avg: avgCol ? parseNum(row[avgCol]) : null,
    }))
    .filter((d) => d.date !== null)
    .sort((a, b) => a.date - b.date);
}

/**
 * Parse Sleep CSV.
 * Expected columns: Date, Total Sleep Time (or Duration), Deep, Light, REM, Awake
 */
export function parseSleepCSV(csvText) {
  const { data, meta } = parseCsv(csvText);
  const headers = meta.fields || [];

  const dateCol = findCol(headers, 'date', 'day', 'calendar date');
  const totalCol = findCol(headers, 'total sleep', 'duration', 'sleep time', 'sleep duration', 'total');
  const deepCol = findCol(headers, 'deep', 'deep sleep');
  const lightCol = findCol(headers, 'light', 'light sleep');
  const remCol = findCol(headers, 'rem', 'rem sleep');
  const awakeCol = findCol(headers, 'awake', 'awake time');
  const scoreCol = findCol(headers, 'score', 'sleep score', 'quality');

  if (!dateCol) {
    throw new Error('Could not find date column in sleep CSV.');
  }

  return data
    .map((row) => {
      /** Parse sleep duration — could be decimal hours, "HH:MM", or minutes */
      const parseSleepVal = (val) => {
        if (!val || val === '--') return null;
        const str = String(val).trim();
        // HH:MM format
        if (str.includes(':')) {
          const [h, m] = str.split(':').map(Number);
          return h + m / 60; // hours
        }
        const n = parseFloat(str.replace(/,/g, ''));
        if (isNaN(n)) return null;
        // If > 24, likely minutes
        return n > 24 ? n / 60 : n;
      };

      return {
        date: parseDate(row[dateCol]),
        total: totalCol ? parseSleepVal(row[totalCol]) : null, // hours
        deep: deepCol ? parseSleepVal(row[deepCol]) : null,
        light: lightCol ? parseSleepVal(row[lightCol]) : null,
        rem: remCol ? parseSleepVal(row[remCol]) : null,
        awake: awakeCol ? parseSleepVal(row[awakeCol]) : null,
        score: scoreCol ? parseNum(row[scoreCol]) : null,
      };
    })
    .filter((d) => d.date !== null)
    .sort((a, b) => a.date - b.date);
}

/**
 * Parse Stress CSV.
 * Expected columns: Date, Overall Stress, Rest Stress, Low Stress, etc.
 */
export function parseStressCSV(csvText) {
  const { data, meta } = parseCsv(csvText);
  const headers = meta.fields || [];

  const dateCol = findCol(headers, 'date', 'day', 'calendar date');
  const overallCol = findCol(headers, 'overall', 'avg stress', 'stress', 'average stress', 'stress level');
  const highCol = findCol(headers, 'high', 'high stress');
  const medCol = findCol(headers, 'medium', 'med stress', 'medium stress');
  const lowCol = findCol(headers, 'low', 'low stress');
  const restCol = findCol(headers, 'rest', 'rest stress');

  if (!dateCol) {
    throw new Error('Could not find date column in stress CSV.');
  }

  return data
    .map((row) => ({
      date: parseDate(row[dateCol]),
      overall: overallCol ? parseNum(row[overallCol]) : null,
      high: highCol ? parseNum(row[highCol]) : null,
      medium: medCol ? parseNum(row[medCol]) : null,
      low: lowCol ? parseNum(row[lowCol]) : null,
      rest: restCol ? parseNum(row[restCol]) : null,
    }))
    .filter((d) => d.date !== null)
    .sort((a, b) => a.date - b.date);
}
