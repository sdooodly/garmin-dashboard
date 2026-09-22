/**
 * Garmin Activities CSV Parser
 *
 * Parses the CSV export from Garmin Connect's Activities page.
 * Handles various column naming conventions Garmin has used over time.
 */
import Papa from 'papaparse';

/** Mapping of normalized field names → possible CSV column headers */
const COLUMN_ALIASES = {
  date: ['date', 'start time', 'starttime', 'activity date', 'begin timestamp'],
  type: ['activity type', 'activitytype', 'type', 'sport'],
  title: ['title', 'activity name', 'name', 'activityname'],
  distance: ['distance', 'distance (km)', 'distance (mi)', 'total distance'],
  duration: ['time', 'duration', 'elapsed time', 'moving time', 'total time', 'elapsed duration'],
  calories: ['calories', 'total calories', 'cal', 'kcal'],
  avgHR: ['avg hr', 'average heart rate', 'avg heart rate', 'avghr', 'average hr', 'avg hr (bpm)'],
  maxHR: ['max hr', 'max heart rate', 'maxhr', 'max hr (bpm)'],
  avgPace: ['avg pace', 'average pace', 'avg speed', 'average speed', 'avgpace', 'avg pace (min/km)'],
  avgSpeed: ['avg speed', 'average speed', 'avg speed (km/h)', 'avgspeed'],
  elevGain: ['elev gain', 'elevation gain', 'total ascent', 'ascent', 'elev gain (m)'],
  elevLoss: ['elev loss', 'elevation loss', 'total descent', 'descent', 'elev loss (m)'],
  avgCadence: ['avg run cadence', 'avg cadence', 'average cadence', 'avg bike cadence'],
  steps: ['steps', 'total steps'],
  aerobicTE: ['aerobic te', 'training effect aerobic', 'aerobic training effect'],
  anaerobicTE: ['anaerobic te', 'training effect anaerobic', 'anaerobic training effect'],
  avgStrideLength: ['avg stride length', 'average stride length'],
  bestPace: ['best pace', 'best speed', 'max speed', 'max pace'],
  movingTime: ['moving time', 'moving duration'],
};

/**
 * Find the actual column name in the CSV headers that matches an alias.
 * @param {string[]} headers - The CSV headers
 * @param {string} field - The normalized field name
 * @returns {string|null} The matching header or null
 */
function resolveColumn(headers, field) {
  const aliases = COLUMN_ALIASES[field] || [field];
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lowerHeaders.indexOf(alias.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/**
 * Parse a Garmin duration string into total seconds.
 * Handles formats: "HH:MM:SS", "MM:SS", "H:MM:SS", plain seconds
 */
function parseDuration(val) {
  if (!val || val === '--') return 0;
  const str = String(val).trim();

  // Already a number (seconds or minutes)
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/**
 * Parse a pace string like "5:30" into decimal minutes.
 */
function parsePace(val) {
  if (!val || val === '--') return null;
  const str = String(val).trim();
  const parts = str.split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Parse a numeric value, returning null for missing/invalid.
 */
function parseNum(val) {
  if (val === undefined || val === null || val === '' || val === '--') return null;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Parse a date string from Garmin CSV into a Date object.
 * Garmin uses several formats depending on locale and export version.
 */
function parseDate(val) {
  if (!val) return null;
  const str = String(val).trim();

  // Try native parsing first
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    const [a, b, c] = parts.map(Number);
    // If first part > 12, assume DD/MM/YYYY
    if (a > 12) return new Date(c, b - 1, a);
    // Otherwise MM/DD/YYYY
    return new Date(c, a - 1, b);
  }

  return null;
}

/**
 * Detect if distance values are in miles (based on column header or large avg paces).
 */
function detectMiles(headers) {
  const lower = headers.map((h) => h.toLowerCase());
  return lower.some((h) => h.includes('(mi)') || h.includes('miles'));
}

/**
 * Parse the Garmin Activities CSV file.
 * @param {string} csvText - Raw CSV text
 * @returns {{ activities: object[], activityTypes: string[] }}
 */
export function parseActivitiesCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (!result.data || result.data.length === 0) {
    throw new Error('No activity data found in the CSV file.');
  }

  const headers = result.meta.fields || [];
  const isMiles = detectMiles(headers);
  const milesToKm = 1.60934;

  // Resolve columns
  const cols = {};
  for (const field of Object.keys(COLUMN_ALIASES)) {
    cols[field] = resolveColumn(headers, field);
  }

  const activityTypesSet = new Set();

  const activities = result.data
    .map((row) => {
      const date = parseDate(cols.date ? row[cols.date] : null);
      if (!date) return null;

      let distance = parseNum(cols.distance ? row[cols.distance] : null);
      if (distance !== null && isMiles) distance *= milesToKm;

      const type = cols.type ? String(row[cols.type] || '').trim() : 'Unknown';
      if (type) activityTypesSet.add(type);

      return {
        date,
        type,
        title: cols.title ? String(row[cols.title] || '').trim() : type,
        distance, // km
        duration: parseDuration(cols.duration ? row[cols.duration] : null), // seconds
        calories: parseNum(cols.calories ? row[cols.calories] : null),
        avgHR: parseNum(cols.avgHR ? row[cols.avgHR] : null),
        maxHR: parseNum(cols.maxHR ? row[cols.maxHR] : null),
        avgPace: parsePace(cols.avgPace ? row[cols.avgPace] : null),
        avgSpeed: parseNum(cols.avgSpeed ? row[cols.avgSpeed] : null),
        elevGain: parseNum(cols.elevGain ? row[cols.elevGain] : null),
        elevLoss: parseNum(cols.elevLoss ? row[cols.elevLoss] : null),
        avgCadence: parseNum(cols.avgCadence ? row[cols.avgCadence] : null),
        steps: parseNum(cols.steps ? row[cols.steps] : null),
        aerobicTE: parseNum(cols.aerobicTE ? row[cols.aerobicTE] : null),
        anaerobicTE: parseNum(cols.anaerobicTE ? row[cols.anaerobicTE] : null),
        movingTime: parseDuration(cols.movingTime ? row[cols.movingTime] : null),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

  return {
    activities,
    activityTypes: [...activityTypesSet].sort(),
  };
}
