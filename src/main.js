/**
 * Garmin Dashboard — Main Entry Point
 *
 * Handles UI interactions, file uploads, and orchestrates
 * data flow between parsers, charts, and insights.
 */
import { parseActivitiesCSV } from './parsers/activities.js';
import {
  parseStepsCSV,
  parseHeartRateCSV,
  parseSleepCSV,
  parseStressCSV,
} from './parsers/health.js';
import {
  renderAllActivityCharts,
  renderAllHealthCharts,
  destroyAllCharts,
} from './charts.js';
import {
  computeStats,
  updateStatCards,
  generateInsights,
  renderInsights,
  renderActivitiesTable,
} from './insights.js';
import { generateDemoActivities, generateDemoHealthData } from './demo-data.js';

// ========================================
// State
// ========================================
let state = {
  activities: [],
  activityTypes: [],
  healthData: { steps: null, heartRate: null, sleep: null, stress: null },
  files: { activities: null, steps: null, heartRate: null, sleep: null, stress: null },
};

// ========================================
// DOM References
// ========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const uploadModal = $('#upload-modal');
const welcomeScreen = $('#welcome-screen');
const dashboard = $('#dashboard');
const btnProcess = $('#btn-process');
const dateRangeSelect = $('#date-range');
const activityTypeSelect = $('#activity-type');

// ========================================
// Modal Logic
// ========================================
function openModal() {
  uploadModal.hidden = false;
}

function closeModal() {
  uploadModal.hidden = true;
}

// Open modal buttons
$('#btn-upload')?.addEventListener('click', openModal);
$('#btn-welcome-upload')?.addEventListener('click', openModal);

// Close modal
$('.modal-close')?.addEventListener('click', closeModal);
$('.modal-backdrop')?.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !uploadModal.hidden) closeModal();
});

// ========================================
// Tab Switching
// ========================================
$$('.upload-tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.upload-tabs .tab').forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const targetId = `panel-${tab.dataset.tab}`;
    $$('.tab-panel').forEach((panel) => {
      panel.hidden = panel.id !== targetId;
      panel.classList.toggle('active', panel.id === targetId);
    });
  });
});

// ========================================
// File Upload Handling
// ========================================

/**
 * Setup a drop zone for file upload.
 */
function setupDropZone(dropZoneId, fileInputId, stateKey) {
  const zone = $(`#${dropZoneId}`);
  const input = $(`#${fileInputId}`);
  if (!zone || !input) return;

  // Click to browse
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // File selected
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      state.files[stateKey] = input.files[0];
      zone.classList.add('has-file');
      const p = zone.querySelector('p');
      if (p) p.innerHTML = `✅ <strong>${input.files[0].name}</strong>`;
      updateProcessButton();
    }
  });

  // Drag & drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      state.files[stateKey] = file;
      zone.classList.add('has-file');
      const p = zone.querySelector('p');
      if (p) p.innerHTML = `✅ <strong>${file.name}</strong>`;
      updateProcessButton();
    }
  });
}

// Setup all drop zones
setupDropZone('drop-activities', 'file-activities', 'activities');
setupDropZone('drop-steps', 'file-steps', 'steps');
setupDropZone('drop-heart-rate', 'file-heart-rate', 'heartRate');
setupDropZone('drop-sleep', 'file-sleep', 'sleep');
setupDropZone('drop-stress', 'file-stress', 'stress');

function updateProcessButton() {
  const hasAnyFile = Object.values(state.files).some((f) => f !== null);
  btnProcess.disabled = !hasAnyFile;
}

// ========================================
// Process Uploaded Files
// ========================================
async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

btnProcess?.addEventListener('click', async () => {
  btnProcess.disabled = true;
  btnProcess.innerHTML = '<span class="loading-spinner"></span> Processing...';

  try {
    // Parse activities
    if (state.files.activities) {
      const text = await readFileAsText(state.files.activities);
      const parsed = parseActivitiesCSV(text);
      state.activities = parsed.activities;
      state.activityTypes = parsed.activityTypes;
    }

    // Parse health data
    if (state.files.steps) {
      const text = await readFileAsText(state.files.steps);
      state.healthData.steps = parseStepsCSV(text);
    }
    if (state.files.heartRate) {
      const text = await readFileAsText(state.files.heartRate);
      state.healthData.heartRate = parseHeartRateCSV(text);
    }
    if (state.files.sleep) {
      const text = await readFileAsText(state.files.sleep);
      state.healthData.sleep = parseSleepCSV(text);
    }
    if (state.files.stress) {
      const text = await readFileAsText(state.files.stress);
      state.healthData.stress = parseStressCSV(text);
    }

    closeModal();
    showDashboard();
  } catch (err) {
    console.error('Error processing files:', err);
    alert(`Error processing files: ${err.message}\n\nPlease make sure you uploaded valid Garmin CSV files.`);
    btnProcess.disabled = false;
    btnProcess.innerHTML = 'Load Dashboard';
  }
});

// ========================================
// Demo Data
// ========================================
function loadDemoData() {
  state.activities = generateDemoActivities();
  state.activityTypes = [...new Set(state.activities.map((a) => a.type))].sort();
  state.healthData = generateDemoHealthData();
  showDashboard();
}

$('#btn-demo')?.addEventListener('click', loadDemoData);
$('#btn-welcome-demo')?.addEventListener('click', loadDemoData);

// ========================================
// Dashboard Rendering
// ========================================
function showDashboard() {
  welcomeScreen.hidden = true;
  dashboard.hidden = false;

  // Populate activity type filter
  populateActivityTypeFilter();

  // Render with current filters
  renderDashboard();
}

function populateActivityTypeFilter() {
  activityTypeSelect.innerHTML = '<option value="all">All Types</option>';
  for (const type of state.activityTypes) {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    activityTypeSelect.appendChild(opt);
  }
}

function getFilteredActivities() {
  let filtered = [...state.activities];
  const now = new Date();

  // Date range filter
  const range = dateRangeSelect.value;
  if (range !== 'all') {
    const days = parseInt(range, 10);
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - days);
    filtered = filtered.filter((a) => a.date >= cutoff);
  }

  // Activity type filter
  const type = activityTypeSelect.value;
  if (type !== 'all') {
    filtered = filtered.filter((a) => a.type === type);
  }

  return filtered;
}

function getFilteredHealthData() {
  const range = dateRangeSelect.value;
  if (range === 'all') return state.healthData;

  const days = parseInt(range, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const filterByDate = (arr) => arr ? arr.filter((d) => d.date >= cutoff) : null;

  return {
    steps: filterByDate(state.healthData.steps),
    heartRate: filterByDate(state.healthData.heartRate),
    sleep: filterByDate(state.healthData.sleep),
    stress: filterByDate(state.healthData.stress),
  };
}

function renderDashboard() {
  const filtered = getFilteredActivities();
  const filteredHealth = getFilteredHealthData();

  // Destroy existing charts before re-rendering
  destroyAllCharts();

  // Stats
  const stats = computeStats(filtered, filteredHealth);
  updateStatCards(stats);

  // Insights
  const insights = generateInsights(filtered, filteredHealth);
  renderInsights(insights);

  // Charts
  if (filtered.length > 0) {
    renderAllActivityCharts(filtered);
  }
  renderAllHealthCharts(filteredHealth);

  // Table
  renderActivitiesTable(filtered);
}

// ========================================
// Filter Change Handlers
// ========================================
dateRangeSelect?.addEventListener('change', renderDashboard);
activityTypeSelect?.addEventListener('change', renderDashboard);

// ========================================
// Init
// ========================================
console.log('🏃 Garmin Dashboard loaded. Upload your data or try the demo!');
