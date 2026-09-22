/**
 * Garmin Dashboard — Demo Data Generator
 *
 * Creates realistic-looking sample data so users can see
 * the dashboard in action before uploading their own data.
 */

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate demo activities over the last ~6 months.
 */
export function generateDemoActivities() {
  const activities = [];
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(now.getMonth() - 6);

  const activityTemplates = [
    {
      type: 'Running',
      titles: ['Morning Run', 'Easy Run', 'Tempo Run', 'Long Run', 'Recovery Run', 'Interval Training', 'Park Run'],
      distance: [3, 15],
      pace: [4.2, 6.8],
      hr: [135, 175],
      calories: [200, 900],
      cadence: [160, 185],
      weight: 4,
    },
    {
      type: 'Cycling',
      titles: ['Road Ride', 'Morning Ride', 'Weekend Ride', 'Hill Climb', 'Easy Spin', 'Group Ride'],
      distance: [15, 80],
      speed: [18, 35],
      hr: [120, 165],
      calories: [300, 1200],
      weight: 2,
    },
    {
      type: 'Walking',
      titles: ['Evening Walk', 'Morning Walk', 'Lunch Walk', 'Hike', 'Dog Walk'],
      distance: [2, 8],
      pace: [8, 14],
      hr: [85, 120],
      calories: [100, 400],
      weight: 3,
    },
    {
      type: 'Swimming',
      titles: ['Pool Swim', 'Open Water Swim', 'Swim Drills', 'Lap Swim'],
      distance: [0.5, 3],
      speed: [1.5, 3.5],
      hr: [110, 155],
      calories: [200, 600],
      weight: 1,
    },
    {
      type: 'Strength Training',
      titles: ['Upper Body', 'Leg Day', 'Full Body Workout', 'Core Training', 'HIIT Session', 'CrossFit'],
      distance: [0, 0],
      hr: [100, 155],
      calories: [150, 500],
      weight: 2,
    },
    {
      type: 'Yoga',
      titles: ['Morning Yoga', 'Vinyasa Flow', 'Stretching', 'Power Yoga', 'Recovery Yoga'],
      distance: [0, 0],
      hr: [70, 110],
      calories: [80, 250],
      weight: 1,
    },
  ];

  // Build a weighted pool
  const pool = [];
  for (const t of activityTemplates) {
    for (let i = 0; i < t.weight; i++) pool.push(t);
  }

  // Generate activities (3-6 per week)
  const current = new Date(startDate);
  let basePace = 5.8; // starting running pace, will improve

  while (current <= now) {
    // Decide how many activities this day (0-2)
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const chance = isWeekend ? 0.7 : 0.55;

    if (Math.random() < chance) {
      const template = pickRandom(pool);
      const daysFromStart = (current - startDate) / (1000 * 60 * 60 * 24);
      const progressFactor = daysFromStart / 180; // 0 to 1 over 6 months

      let distance = null;
      let avgPace = null;
      let avgSpeed = null;
      let duration = 0;

      if (template.distance[1] > 0) {
        distance = randomBetween(template.distance[0], template.distance[1]);
        // Slight improvement over time
        distance *= 1 + progressFactor * 0.15;
      }

      if (template.pace) {
        // Pace improves slightly over time
        avgPace = randomBetween(template.pace[0], template.pace[1]);
        avgPace -= progressFactor * 0.4;
        avgPace = Math.max(template.pace[0], avgPace);
        duration = distance ? distance * avgPace * 60 : randomBetween(20, 60) * 60;
      } else if (template.speed) {
        avgSpeed = randomBetween(template.speed[0], template.speed[1]);
        avgSpeed += progressFactor * 1;
        duration = distance ? (distance / avgSpeed) * 3600 : randomBetween(30, 90) * 60;
      } else {
        duration = randomBetween(20, 75) * 60;
      }

      const avgHR = randomInt(template.hr[0], template.hr[1]);
      const maxHR = avgHR + randomInt(10, 30);
      const calories = randomInt(template.calories[0], template.calories[1]);

      activities.push({
        date: new Date(current),
        type: template.type,
        title: pickRandom(template.titles),
        distance: distance ? Math.round(distance * 100) / 100 : null,
        duration: Math.round(duration),
        calories,
        avgHR,
        maxHR,
        avgPace: avgPace ? Math.round(avgPace * 100) / 100 : null,
        avgSpeed: avgSpeed ? Math.round(avgSpeed * 10) / 10 : null,
        elevGain: distance ? randomInt(10, Math.max(20, distance * 15)) : null,
        elevLoss: distance ? randomInt(10, Math.max(20, distance * 12)) : null,
        avgCadence: template.cadence ? randomInt(template.cadence[0], template.cadence[1]) : null,
        steps: template.type === 'Running' ? Math.round(distance * 1300) : null,
        aerobicTE: Math.round(randomBetween(1.5, 4.5) * 10) / 10,
        anaerobicTE: Math.round(randomBetween(0.5, 3.5) * 10) / 10,
        movingTime: Math.round(duration * randomBetween(0.85, 0.98)),
      });

      // Occasionally do a second activity
      if (isWeekend && Math.random() < 0.2) {
        const template2 = pickRandom(pool);
        if (template2.type !== template.type) {
          const d2 = template2.distance[1] > 0 ? randomBetween(template2.distance[0], template2.distance[1] * 0.6) : null;
          activities.push({
            date: new Date(current),
            type: template2.type,
            title: pickRandom(template2.titles),
            distance: d2 ? Math.round(d2 * 100) / 100 : null,
            duration: Math.round(randomBetween(20, 50) * 60),
            calories: randomInt(100, 400),
            avgHR: randomInt(template2.hr[0], template2.hr[1]),
            maxHR: randomInt(template2.hr[1], template2.hr[1] + 15),
            avgPace: null,
            avgSpeed: null,
            elevGain: null,
            elevLoss: null,
            avgCadence: null,
            steps: null,
            aerobicTE: null,
            anaerobicTE: null,
            movingTime: null,
          });
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return activities.sort((a, b) => a.date - b.date);
}

/**
 * Generate demo health data (steps, heart rate, sleep, stress).
 */
export function generateDemoHealthData() {
  const now = new Date();
  const days = 90; // 3 months of health data

  const steps = [];
  const heartRate = [];
  const sleep = [];
  const stress = [];

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;

    // Steps — higher on weekdays usually
    const baseSteps = isWeekend ? randomInt(5000, 12000) : randomInt(6000, 15000);
    steps.push({
      date: new Date(date),
      steps: baseSteps,
      goal: 10000,
    });

    // Heart rate
    heartRate.push({
      date: new Date(date),
      resting: randomInt(55, 72),
      low: randomInt(48, 60),
      high: randomInt(130, 180),
      avg: randomInt(62, 85),
    });

    // Sleep
    const totalSleep = randomBetween(5.5, 9);
    const deep = totalSleep * randomBetween(0.12, 0.22);
    const rem = totalSleep * randomBetween(0.18, 0.28);
    const light = totalSleep - deep - rem;
    sleep.push({
      date: new Date(date),
      total: Math.round(totalSleep * 100) / 100,
      deep: Math.round(deep * 100) / 100,
      light: Math.round(light * 100) / 100,
      rem: Math.round(rem * 100) / 100,
      awake: Math.round(randomBetween(0.3, 1.2) * 100) / 100,
      score: randomInt(50, 95),
    });

    // Stress
    const baseStress = isWeekend ? randomInt(18, 40) : randomInt(28, 55);
    stress.push({
      date: new Date(date),
      overall: baseStress,
      high: randomInt(5, 20),
      medium: randomInt(15, 35),
      low: randomInt(20, 40),
      rest: randomInt(15, 35),
    });
  }

  return { steps, heartRate, sleep, stress };
}
