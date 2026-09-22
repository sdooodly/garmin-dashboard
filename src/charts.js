/**
 * Garmin Dashboard — Chart Rendering
 *
 * Creates and updates all Chart.js visualizations.
 */
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler
);

// --- Theme colors ---
const COLORS = {
  accent: '#6366f1',
  accentLight: 'rgba(99,102,241,0.3)',
  green: '#22c55e',
  greenLight: 'rgba(34,197,94,0.2)',
  red: '#ef4444',
  redLight: 'rgba(239,68,68,0.2)',
  orange: '#f59e0b',
  orangeLight: 'rgba(245,158,11,0.2)',
  blue: '#3b82f6',
  blueLight: 'rgba(59,130,246,0.2)',
  pink: '#ec4899',
  pinkLight: 'rgba(236,72,153,0.2)',
  cyan: '#06b6d4',
  cyanLight: 'rgba(6,182,212,0.2)',
  purple: '#a855f7',
  grid: 'rgba(255,255,255,0.06)',
  gridLabel: '#9ca3af',
};

const TYPE_COLORS = [
  COLORS.accent, COLORS.green, COLORS.orange, COLORS.blue,
  COLORS.pink, COLORS.cyan, COLORS.purple, COLORS.red,
  '#84cc16', '#14b8a6', '#f97316', '#8b5cf6',
];

// --- Chart.js global defaults ---
Chart.defaults.color = COLORS.gridLabel;
Chart.defaults.borderColor = COLORS.grid;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#1a1d27';
Chart.defaults.plugins.tooltip.borderColor = '#2a2d3a';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
Chart.defaults.animation.duration = 600;

/** Store chart instances for cleanup */
const chartInstances = {};

/**
 * Destroy an existing chart if it exists, then create a new one.
 */
function createChart(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const chart = new Chart(canvas, config);
  chartInstances[canvasId] = chart;
  return chart;
}

/** Common scale options for time-based X axis */
function timeXScale() {
  return {
    type: 'time',
    time: { unit: 'day', tooltipFormat: 'MMM d, yyyy' },
    grid: { display: false },
    ticks: { maxTicksLimit: 12 },
  };
}

function linearYScale(label = '', beginAtZero = true) {
  return {
    beginAtZero,
    grid: { color: COLORS.grid },
    ticks: { maxTicksLimit: 6 },
    title: { display: !!label, text: label, color: COLORS.gridLabel, font: { size: 11 } },
  };
}

// ====================================
// Activity Charts
// ====================================

/**
 * Activity timeline — distance per day as bars with a trend line.
 */
export function renderActivityTimeline(activities) {
  const dailyMap = new Map();
  for (const a of activities) {
    const key = a.date.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) || 0) + (a.distance || 0));
  }

  const sorted = [...dailyMap.entries()].sort();
  const labels = sorted.map(([d]) => d);
  const values = sorted.map(([, v]) => Math.round(v * 100) / 100);

  // 7-day rolling average
  const rolling = values.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  createChart('chart-activity-timeline', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Distance (km)',
          data: values,
          backgroundColor: COLORS.accentLight,
          borderColor: COLORS.accent,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.8,
        },
        {
          label: '7-day Avg',
          data: rolling,
          type: 'line',
          borderColor: COLORS.orange,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} km`,
          },
        },
      },
      scales: {
        x: timeXScale(),
        y: linearYScale('km'),
      },
    },
  });
}

/**
 * Distance by activity type — doughnut chart.
 */
export function renderDistanceByType(activities) {
  const typeMap = new Map();
  for (const a of activities) {
    if (a.distance) {
      typeMap.set(a.type, (typeMap.get(a.type) || 0) + a.distance);
    }
  }

  const sorted = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([t]) => t);
  const values = sorted.map(([, v]) => Math.round(v * 10) / 10);

  createChart('chart-distance-by-type', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: TYPE_COLORS.slice(0, labels.length),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'right', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)} km` },
        },
      },
    },
  });
}

/**
 * Calories over time — area chart.
 */
export function renderCalories(activities) {
  const dailyMap = new Map();
  for (const a of activities) {
    if (a.calories) {
      const key = a.date.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) || 0) + a.calories);
    }
  }

  const sorted = [...dailyMap.entries()].sort();

  createChart('chart-calories', {
    type: 'line',
    data: {
      labels: sorted.map(([d]) => d),
      datasets: [{
        label: 'Calories',
        data: sorted.map(([, v]) => Math.round(v)),
        borderColor: COLORS.orange,
        backgroundColor: COLORS.orangeLight,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: timeXScale(),
        y: linearYScale('kcal'),
      },
    },
  });
}

/**
 * Heart rate trends — avg and max HR from activities.
 */
export function renderHeartRate(activities) {
  const withHR = activities.filter((a) => a.avgHR);

  createChart('chart-heart-rate', {
    type: 'line',
    data: {
      labels: withHR.map((a) => a.date.toISOString().slice(0, 10)),
      datasets: [
        {
          label: 'Avg HR',
          data: withHR.map((a) => a.avgHR),
          borderColor: COLORS.red,
          backgroundColor: COLORS.redLight,
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Max HR',
          data: withHR.map((a) => a.maxHR),
          borderColor: COLORS.pink,
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
      },
      scales: {
        x: timeXScale(),
        y: linearYScale('bpm', false),
      },
    },
  });
}

/**
 * Weekly training volume — stacked bar by type.
 */
export function renderWeeklyVolume(activities) {
  // Group by ISO week
  const weekMap = new Map();
  const types = new Set();

  for (const a of activities) {
    const d = a.date;
    // Get Monday of the week
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const weekKey = monday.toISOString().slice(0, 10);

    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const weekData = weekMap.get(weekKey);
    const mins = (a.duration || 0) / 60;
    weekData.set(a.type, (weekData.get(a.type) || 0) + mins);
    types.add(a.type);
  }

  const sortedWeeks = [...weekMap.keys()].sort();
  const typeArr = [...types];

  const datasets = typeArr.map((type, i) => ({
    label: type,
    data: sortedWeeks.map((w) => Math.round(weekMap.get(w)?.get(type) || 0)),
    backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length],
    borderRadius: 3,
    barPercentage: 0.7,
  }));

  createChart('chart-weekly-volume', {
    type: 'bar',
    data: { labels: sortedWeeks, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} min` },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 12, font: { size: 10 } } },
        y: { stacked: true, ...linearYScale('minutes') },
      },
    },
  });
}

/**
 * Pace / speed progression — for running activities.
 */
export function renderPaceProgression(activities) {
  const runTypes = ['running', 'trail running', 'treadmill running', 'track running'];
  const runs = activities.filter(
    (a) => runTypes.some((t) => a.type.toLowerCase().includes(t)) && a.avgPace
  );

  if (runs.length === 0) {
    // Fallback to all activities with speed data
    const withSpeed = activities.filter((a) => a.avgSpeed);
    if (withSpeed.length === 0) return;

    createChart('chart-pace', {
      type: 'line',
      data: {
        labels: withSpeed.map((a) => a.date.toISOString().slice(0, 10)),
        datasets: [{
          label: 'Avg Speed (km/h)',
          data: withSpeed.map((a) => a.avgSpeed),
          borderColor: COLORS.cyan,
          backgroundColor: COLORS.cyanLight,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: timeXScale(),
          y: linearYScale('km/h'),
        },
      },
    });
    return;
  }

  // Rolling average for pace
  const paces = runs.map((a) => a.avgPace);
  const rolling = paces.map((_, i) => {
    const start = Math.max(0, i - 4);
    const slice = paces.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  createChart('chart-pace', {
    type: 'line',
    data: {
      labels: runs.map((a) => a.date.toISOString().slice(0, 10)),
      datasets: [
        {
          label: 'Pace (min/km)',
          data: paces,
          borderColor: COLORS.green,
          backgroundColor: COLORS.greenLight,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.2,
          fill: true,
        },
        {
          label: '5-run Avg',
          data: rolling,
          borderColor: COLORS.accent,
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const mins = Math.floor(ctx.parsed.y);
              const secs = Math.round((ctx.parsed.y - mins) * 60);
              return `${ctx.dataset.label}: ${mins}:${String(secs).padStart(2, '0')} /km`;
            },
          },
        },
      },
      scales: {
        x: timeXScale(),
        y: {
          ...linearYScale('min/km', false),
          reverse: true, // Lower pace = faster = better, show at top
        },
      },
    },
  });
}

/**
 * Activity by day of week — bar chart.
 */
export function renderDayOfWeek(activities) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = new Array(7).fill(0);
  const durations = new Array(7).fill(0);

  for (const a of activities) {
    const dow = a.date.getDay();
    counts[dow]++;
    durations[dow] += (a.duration || 0) / 60;
  }

  createChart('chart-day-of-week', {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Activities',
          data: counts,
          backgroundColor: COLORS.accentLight,
          borderColor: COLORS.accent,
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Minutes',
          data: durations.map((d) => Math.round(d)),
          type: 'line',
          borderColor: COLORS.orange,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: COLORS.orange,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { ...linearYScale('Count'), position: 'left' },
        y1: { ...linearYScale('Minutes'), position: 'right', grid: { display: false } },
      },
    },
  });
}

/**
 * Monthly distance totals — bar chart.
 */
export function renderMonthlyTotals(activities) {
  const monthMap = new Map();
  for (const a of activities) {
    const key = a.date.toISOString().slice(0, 7); // YYYY-MM
    monthMap.set(key, (monthMap.get(key) || 0) + (a.distance || 0));
  }

  const sorted = [...monthMap.entries()].sort();

  createChart('chart-monthly', {
    type: 'bar',
    data: {
      labels: sorted.map(([m]) => m),
      datasets: [{
        label: 'Distance (km)',
        data: sorted.map(([, v]) => Math.round(v * 10) / 10),
        backgroundColor: sorted.map((_, i) => TYPE_COLORS[i % TYPE_COLORS.length] + '99'),
        borderColor: sorted.map((_, i) => TYPE_COLORS[i % TYPE_COLORS.length]),
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: linearYScale('km'),
      },
    },
  });
}

// ====================================
// Health Charts
// ====================================

/**
 * Daily steps bar chart.
 */
export function renderSteps(stepsData) {
  if (!stepsData || stepsData.length === 0) return;
  document.getElementById('card-steps')?.removeAttribute('hidden');

  const labels = stepsData.map((d) => d.date.toISOString().slice(0, 10));
  const values = stepsData.map((d) => d.steps || 0);
  const goals = stepsData.map((d) => d.goal);

  const datasets = [
    {
      label: 'Steps',
      data: values,
      backgroundColor: values.map((v, i) =>
        goals[i] && v >= goals[i] ? COLORS.greenLight : COLORS.blueLight
      ),
      borderColor: values.map((v, i) =>
        goals[i] && v >= goals[i] ? COLORS.green : COLORS.blue
      ),
      borderWidth: 1,
      borderRadius: 3,
    },
  ];

  if (goals.some((g) => g !== null)) {
    datasets.push({
      label: 'Goal',
      data: goals,
      type: 'line',
      borderColor: COLORS.orange,
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 0,
      fill: false,
    });
  }

  createChart('chart-steps', {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: goals.some((g) => g !== null), position: 'top', labels: { boxWidth: 12 } },
      },
      scales: {
        x: timeXScale(),
        y: linearYScale('Steps'),
      },
    },
  });
}

/**
 * Sleep duration stacked bar chart.
 */
export function renderSleep(sleepData) {
  if (!sleepData || sleepData.length === 0) return;
  document.getElementById('card-sleep')?.removeAttribute('hidden');

  const labels = sleepData.map((d) => d.date.toISOString().slice(0, 10));

  const datasets = [];

  if (sleepData.some((d) => d.deep !== null)) {
    datasets.push({
      label: 'Deep',
      data: sleepData.map((d) => d.deep || 0),
      backgroundColor: '#6366f1cc',
      borderRadius: 2,
    });
  }
  if (sleepData.some((d) => d.light !== null)) {
    datasets.push({
      label: 'Light',
      data: sleepData.map((d) => d.light || 0),
      backgroundColor: '#818cf8aa',
      borderRadius: 2,
    });
  }
  if (sleepData.some((d) => d.rem !== null)) {
    datasets.push({
      label: 'REM',
      data: sleepData.map((d) => d.rem || 0),
      backgroundColor: '#06b6d4aa',
      borderRadius: 2,
    });
  }

  // Fallback: just show total if no breakdown
  if (datasets.length === 0) {
    datasets.push({
      label: 'Total Sleep',
      data: sleepData.map((d) => d.total || 0),
      backgroundColor: COLORS.accentLight,
      borderColor: COLORS.accent,
      borderWidth: 1,
      borderRadius: 4,
    });
  }

  createChart('chart-sleep', {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 10, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const h = Math.floor(ctx.parsed.y);
              const m = Math.round((ctx.parsed.y - h) * 60);
              return `${ctx.dataset.label}: ${h}h ${m}m`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true, ...timeXScale() },
        y: {
          stacked: true,
          ...linearYScale('Hours'),
          ticks: {
            callback: (v) => `${v}h`,
          },
        },
      },
    },
  });
}

/**
 * Stress level line chart.
 */
export function renderStress(stressData) {
  if (!stressData || stressData.length === 0) return;
  document.getElementById('card-stress')?.removeAttribute('hidden');

  const labels = stressData.map((d) => d.date.toISOString().slice(0, 10));

  createChart('chart-stress', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Stress Level',
        data: stressData.map((d) => d.overall || 0),
        borderColor: COLORS.red,
        backgroundColor: COLORS.redLight,
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: timeXScale(),
        y: {
          ...linearYScale('Stress'),
          max: 100,
        },
      },
    },
  });
}

/**
 * Render all activity charts.
 */
export function renderAllActivityCharts(activities) {
  renderActivityTimeline(activities);
  renderDistanceByType(activities);
  renderCalories(activities);
  renderHeartRate(activities);
  renderWeeklyVolume(activities);
  renderPaceProgression(activities);
  renderDayOfWeek(activities);
  renderMonthlyTotals(activities);
}

/**
 * Render all health charts.
 */
export function renderAllHealthCharts({ steps, heartRate, sleep, stress }) {
  if (steps) renderSteps(steps);
  if (sleep) renderSleep(sleep);
  if (stress) renderStress(stress);
  // heartRate from health export could augment activity HR chart in future
}

/**
 * Destroy all charts (for cleanup on re-upload).
 */
export function destroyAllCharts() {
  for (const [id, chart] of Object.entries(chartInstances)) {
    chart.destroy();
    delete chartInstances[id];
  }
}
