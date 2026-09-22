/**
 * Garmin Dashboard — Insights Engine
 *
 * Computes summary stats and generates human-readable insights
 * from activity and health data.
 */

/**
 * Format seconds into "Xh Ym" or "Xm Ys".
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Format a number with commas.
 */
function fmt(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Compute summary statistics from activities.
 */
export function computeStats(activities, healthData = {}) {
  const stats = {
    totalActivities: activities.length,
    totalDistance: 0,
    totalDuration: 0,
    totalCalories: 0,
    avgHR: null,
    avgSteps: null,
  };

  let hrSum = 0;
  let hrCount = 0;

  for (const a of activities) {
    stats.totalDistance += a.distance || 0;
    stats.totalDuration += a.duration || 0;
    stats.totalCalories += a.calories || 0;
    if (a.avgHR) {
      hrSum += a.avgHR;
      hrCount++;
    }
  }

  stats.avgHR = hrCount > 0 ? Math.round(hrSum / hrCount) : null;

  // Average daily steps from health data
  if (healthData.steps && healthData.steps.length > 0) {
    const stepsArr = healthData.steps.filter((d) => d.steps !== null);
    if (stepsArr.length > 0) {
      stats.avgSteps = Math.round(
        stepsArr.reduce((sum, d) => sum + d.steps, 0) / stepsArr.length
      );
    }
  }

  return stats;
}

/**
 * Update the stat card DOM elements.
 */
export function updateStatCards(stats) {
  const el = (id) => document.getElementById(id);

  el('stat-total-activities').textContent = fmt(stats.totalActivities);
  el('stat-total-distance').textContent = fmt(stats.totalDistance, 1);
  el('stat-total-time').textContent = formatDuration(stats.totalDuration);
  el('stat-total-calories').textContent = fmt(stats.totalCalories);
  el('stat-avg-hr').textContent = stats.avgHR ? `${stats.avgHR} bpm` : '—';
  el('stat-avg-steps').textContent = stats.avgSteps ? fmt(stats.avgSteps) : '—';
}

/**
 * Generate human-readable insights from the data.
 * Returns an array of { icon, text, type } objects.
 */
export function generateInsights(activities, healthData = {}) {
  const insights = [];

  if (activities.length === 0) return insights;

  // --- Best / longest activity ---
  const longestDist = activities.reduce(
    (best, a) => (a.distance || 0) > (best.distance || 0) ? a : best,
    activities[0]
  );
  if (longestDist.distance) {
    insights.push({
      icon: '🏆',
      text: `Your longest activity was <strong>${longestDist.title || longestDist.type}</strong> on ${longestDist.date.toLocaleDateString()} — ${fmt(longestDist.distance, 2)} km.`,
      type: 'highlight',
    });
  }

  // --- Most active day of week ---
  const dayCounts = new Array(7).fill(0);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const a of activities) dayCounts[a.date.getDay()]++;
  const bestDay = dayCounts.indexOf(Math.max(...dayCounts));
  insights.push({
    icon: '📅',
    text: `<strong>${dayNames[bestDay]}</strong> is your most active day with ${dayCounts[bestDay]} activities.`,
    type: 'neutral',
  });

  // --- Favorite activity type ---
  const typeCount = {};
  for (const a of activities) {
    typeCount[a.type] = (typeCount[a.type] || 0) + 1;
  }
  const sortedTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
  if (sortedTypes.length > 0) {
    const [favType, favCount] = sortedTypes[0];
    const pct = Math.round((favCount / activities.length) * 100);
    insights.push({
      icon: '⭐',
      text: `Your favorite activity is <strong>${favType}</strong> (${pct}% of all activities, ${favCount} total).`,
      type: 'neutral',
    });
  }

  // --- Recent trend (last 4 weeks vs previous 4 weeks) ---
  const now = new Date();
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 56);

  const recent = activities.filter((a) => a.date >= fourWeeksAgo);
  const previous = activities.filter((a) => a.date >= eightWeeksAgo && a.date < fourWeeksAgo);

  if (recent.length > 0 && previous.length > 0) {
    const recentDist = recent.reduce((s, a) => s + (a.distance || 0), 0);
    const prevDist = previous.reduce((s, a) => s + (a.distance || 0), 0);

    if (prevDist > 0) {
      const changePct = Math.round(((recentDist - prevDist) / prevDist) * 100);
      if (changePct > 0) {
        insights.push({
          icon: '📈',
          text: `Your distance is <strong>up ${changePct}%</strong> in the last 4 weeks compared to the previous 4 weeks. Keep it up!`,
          type: 'positive',
        });
      } else if (changePct < -10) {
        insights.push({
          icon: '📉',
          text: `Your distance is <strong>down ${Math.abs(changePct)}%</strong> in the last 4 weeks. A small dip is normal — consistency matters more than perfection.`,
          type: 'negative',
        });
      }
    }

    // Activity frequency trend
    if (recent.length > previous.length * 1.2) {
      insights.push({
        icon: '🔥',
        text: `You've been more consistent lately — <strong>${recent.length} activities</strong> in the last 4 weeks vs ${previous.length} before that.`,
        type: 'positive',
      });
    }
  }

  // --- Average duration ---
  const avgDuration = activities.reduce((s, a) => s + (a.duration || 0), 0) / activities.length;
  insights.push({
    icon: '⏱️',
    text: `Your average activity duration is <strong>${formatDuration(avgDuration)}</strong>.`,
    type: 'neutral',
  });

  // --- Calories insight ---
  const totalCal = activities.reduce((s, a) => s + (a.calories || 0), 0);
  if (totalCal > 0) {
    const pizzas = (totalCal / 285).toFixed(0); // ~285 cal per slice
    insights.push({
      icon: '🍕',
      text: `You've burned <strong>${fmt(totalCal)}</strong> calories — that's roughly ${pizzas} slices of pizza!`,
      type: 'highlight',
    });
  }

  // --- Heart rate insight ---
  const hrActivities = activities.filter((a) => a.avgHR);
  if (hrActivities.length >= 5) {
    const recentHR = hrActivities.slice(-5);
    const avgRecentHR = Math.round(recentHR.reduce((s, a) => s + a.avgHR, 0) / recentHR.length);
    const oldHR = hrActivities.slice(0, 5);
    const avgOldHR = Math.round(oldHR.reduce((s, a) => s + a.avgHR, 0) / oldHR.length);

    if (avgRecentHR < avgOldHR - 3) {
      insights.push({
        icon: '❤️',
        text: `Your average exercise heart rate has <strong>dropped from ${avgOldHR} to ${avgRecentHR} bpm</strong>. This often indicates improving fitness!`,
        type: 'positive',
      });
    }
  }

  // --- Running pace improvement ---
  const runs = activities.filter(
    (a) => a.type.toLowerCase().includes('running') && a.avgPace
  );
  if (runs.length >= 6) {
    const firstRuns = runs.slice(0, 3);
    const lastRuns = runs.slice(-3);
    const earlyPace = firstRuns.reduce((s, a) => s + a.avgPace, 0) / 3;
    const latePace = lastRuns.reduce((s, a) => s + a.avgPace, 0) / 3;

    if (latePace < earlyPace * 0.95) {
      const improvePct = Math.round(((earlyPace - latePace) / earlyPace) * 100);
      insights.push({
        icon: '🚀',
        text: `Your running pace improved by <strong>${improvePct}%</strong> — you're getting faster!`,
        type: 'positive',
      });
    }
  }

  // --- Streak ---
  const activityDates = new Set(
    activities.map((a) => a.date.toISOString().slice(0, 10))
  );
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activityDates.has(key)) {
      tempStreak++;
      if (i < 7 && tempStreak > currentStreak) currentStreak = tempStreak;
    } else {
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 0;
    }
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  if (maxStreak > 2) {
    insights.push({
      icon: '🔥',
      text: `Your longest activity streak was <strong>${maxStreak} consecutive days</strong>.`,
      type: 'highlight',
    });
  }

  // --- Health data insights ---
  if (healthData.steps && healthData.steps.length > 7) {
    const stepsArr = healthData.steps.filter((d) => d.steps);
    const avg = stepsArr.reduce((s, d) => s + d.steps, 0) / stepsArr.length;
    const daysOver10k = stepsArr.filter((d) => d.steps >= 10000).length;
    const pct10k = Math.round((daysOver10k / stepsArr.length) * 100);

    insights.push({
      icon: '👟',
      text: `You average <strong>${fmt(Math.round(avg))}</strong> steps per day. You hit 10,000+ steps on ${pct10k}% of days.`,
      type: pct10k >= 50 ? 'positive' : 'neutral',
    });
  }

  if (healthData.sleep && healthData.sleep.length > 7) {
    const sleepArr = healthData.sleep.filter((d) => d.total);
    if (sleepArr.length > 0) {
      const avgSleep = sleepArr.reduce((s, d) => s + d.total, 0) / sleepArr.length;
      const h = Math.floor(avgSleep);
      const m = Math.round((avgSleep - h) * 60);
      insights.push({
        icon: '😴',
        text: `You average <strong>${h}h ${m}m</strong> of sleep per night.${avgSleep >= 7 ? ' Great job meeting the 7-hour recommendation!' : ' Try to aim for 7+ hours for optimal recovery.'}`,
        type: avgSleep >= 7 ? 'positive' : 'negative',
      });
    }
  }

  if (healthData.stress && healthData.stress.length > 7) {
    const stressArr = healthData.stress.filter((d) => d.overall);
    if (stressArr.length > 0) {
      const avgStress = Math.round(
        stressArr.reduce((s, d) => s + d.overall, 0) / stressArr.length
      );
      insights.push({
        icon: '🧠',
        text: `Your average stress level is <strong>${avgStress}/100</strong>.${avgStress <= 35 ? ' You\u2019re managing stress well!' : avgStress <= 55 ? ' Moderate stress \u2014 keep up your activity routine.' : ' Your stress is on the higher side. Exercise and sleep are great stress relievers.'}`,
        type: avgStress <= 35 ? 'positive' : avgStress <= 55 ? 'neutral' : 'negative',
      });
    }
  }

  return insights;
}

/**
 * Render insight cards into the DOM.
 */
export function renderInsights(insights) {
  const container = document.getElementById('insights-container');
  if (!container) return;

  container.innerHTML = insights
    .map(
      (insight) => `
    <div class="insight-card ${insight.type}">
      <span class="insight-icon">${insight.icon}</span>
      <span class="insight-text">${insight.text}</span>
    </div>
  `
    )
    .join('');
}

/**
 * Populate the recent activities table.
 */
export function renderActivitiesTable(activities, limit = 50) {
  const tbody = document.getElementById('activities-tbody');
  if (!tbody) return;

  const recent = [...activities].reverse().slice(0, limit);

  tbody.innerHTML = recent
    .map((a) => {
      const date = a.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const dist = a.distance ? `${a.distance.toFixed(2)} km` : '—';
      const dur = a.duration ? formatDuration(a.duration) : '—';
      const cal = a.calories ? fmt(a.calories) : '—';
      const hr = a.avgHR ? `${a.avgHR} bpm` : '—';
      const pace = a.avgPace
        ? `${Math.floor(a.avgPace)}:${String(Math.round((a.avgPace % 1) * 60)).padStart(2, '0')} /km`
        : a.avgSpeed
        ? `${a.avgSpeed.toFixed(1)} km/h`
        : '—';

      return `
        <tr>
          <td>${date}</td>
          <td>${a.type}</td>
          <td>${a.title || '—'}</td>
          <td>${dist}</td>
          <td>${dur}</td>
          <td>${cal}</td>
          <td>${hr}</td>
          <td>${pace}</td>
        </tr>
      `;
    })
    .join('');
}
