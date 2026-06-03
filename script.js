const STORAGE_KEY = 'ironbody.measurements.v1';

const defaultMeasurement = {
  date: new Date().toISOString().slice(0, 10),
  weight: 100.0,
  bmi: 32.6,
  muscle: 31.3,
  basal: 2085.5,
  fatFree: 52.5,
  bodyFat: 41.8,
  water: 38.4,
  visceral: 18.0,
  lean: { leftArm: 3.36, rightArm: 3.36, trunk: 26.34, leftLeg: 9.68, rightLeg: 9.73 },
  fat: { leftArm: 2.17, rightArm: 2.17, trunk: 26.82, leftLeg: 5.36, rightLeg: 5.32 },
};

const metricDefinitions = [
  { key: 'weight', label: 'Peso', unit: 'kg', icon: '⚖', min: 37.7, idealStart: 57.0, idealEnd: 76.3, max: 95.6 },
  { key: 'bmi', label: 'IMC', unit: '', icon: '⌘', min: 12.3, idealStart: 18.6, idealEnd: 24.9, max: 31.2 },
  { key: 'fatFree', label: 'Masa libre de grasa', unit: 'kg', icon: '✣', min: 47.2, idealStart: 54.6, idealEnd: 62.0, max: 69.4 },
  { key: 'bodyFat', label: 'Grasa corporal', unit: '%', icon: '◌', min: 0.0, idealStart: 8.0, idealEnd: 19.0, max: 30.0 },
  { key: 'water', label: 'Agua', unit: 'L', icon: '💧', min: 35.0, idealStart: 50.0, idealEnd: 65.0, max: 80.0 },
  { key: 'visceral', label: 'Grasa visceral', unit: '', icon: '♦', min: 6.0, idealStart: 8.0, idealEnd: 10.0, max: 12.0 },
];

const dataStore = loadStore();
let state = dataStore.current;
const metricCards = document.querySelector('#metricCards');
const form = document.querySelector('#metricsForm');
const editorPanel = document.querySelector('#editorPanel');
const historyPanel = document.querySelector('#historyPanel');

function createDefaultStore() {
  const current = structuredClone(defaultMeasurement);
  return { current, history: [structuredClone(current)] };
}

function loadStore() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createDefaultStore();

  try {
    const parsed = JSON.parse(saved);
    if (parsed.current) {
      const current = mergeMeasurement(parsed.current);
      return { current, history: Array.isArray(parsed.history) ? parsed.history.map(mergeMeasurement) : [current] };
    }

    const current = mergeMeasurement(parsed);
    return { current, history: [current] };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return createDefaultStore();
  }
}

function mergeMeasurement(measurement) {
  return {
    ...structuredClone(defaultMeasurement),
    ...measurement,
    lean: { ...defaultMeasurement.lean, ...measurement.lean },
    fat: { ...defaultMeasurement.fat, ...measurement.fat },
  };
}

function saveStore() {
  dataStore.current = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataStore));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function markerPosition(metric, value) {
  return clamp(((value - metric.min) / (metric.max - metric.min)) * 100, 0, 100);
}

function formatValue(value) {
  return Number(value).toFixed(1);
}

function findPreviousMeasurement() {
  return dataStore.history.length > 1 ? dataStore.history[dataStore.history.length - 2] : null;
}

function renderDelta(key) {
  const previous = findPreviousMeasurement();
  if (!previous) return '<small class="delta neutral">Base</small>';

  const difference = Number(state[key]) - Number(previous[key]);
  const sign = difference > 0 ? '+' : '';
  const tone = difference < 0 ? 'down' : difference > 0 ? 'up' : 'neutral';
  return `<small class="delta ${tone}">${sign}${difference.toFixed(1)} vs. medición previa</small>`;
}

function renderMetricCards() {
  metricCards.innerHTML = metricDefinitions.map((metric) => {
    const value = Number(state[metric.key]);
    const position = markerPosition(metric, value);

    return `
      <article class="metric-card">
        <div class="metric-title">
          <span><span class="badge">${metric.icon}</span>${metric.label}</span>
          <span class="info">i</span>
        </div>
        <div class="metric-value">${formatValue(value)}<small>${metric.unit}</small></div>
        ${renderDelta(metric.key)}
        <div class="range-labels"><span class="low">Bajo</span><span class="ideal">Ideal</span><span class="high">Alto</span></div>
        <div class="range-bar"><span class="range-dot" style="left:${position}%"></span></div>
        <div class="range-values"><span>${metric.min.toFixed(1)}</span><span>${metric.idealStart.toFixed(1)}</span><span>${metric.idealEnd.toFixed(1)}</span><span>${metric.max.toFixed(1)}</span></div>
      </article>`;
  }).join('');
}

function renderHistory() {
  const latest = dataStore.history.slice(-4).reverse();
  historyPanel.innerHTML = latest.map((entry, index) => `
    <article class="history-chip">
      <strong>${index === 0 ? 'Actual' : entry.date}</strong><br />
      Peso ${formatValue(entry.weight)} kg · Grasa ${formatValue(entry.bodyFat)}%<br />
      Músculo ${formatValue(entry.muscle)} kg
    </article>`).join('');
}

function updateDataBindings() {
  document.querySelectorAll('[data-value]').forEach((node) => {
    node.textContent = formatValue(state[node.dataset.value]);
  });

  document.querySelectorAll('[data-segment]').forEach((node) => {
    const [group, key] = node.dataset.segment.split('.');
    node.textContent = Number(state[group][key]).toFixed(2);
  });
}

function syncForm() {
  Object.entries(state).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([segmentKey, segmentValue]) => {
        const input = form.elements[`${key}.${segmentKey}`];
        if (input) input.value = segmentValue;
      });
      return;
    }

    const input = form.elements[key];
    if (input) input.value = value;
  });
}

function render() {
  renderMetricCards();
  renderHistory();
  updateDataBindings();
  syncForm();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const nextMeasurement = structuredClone(state);

  for (const [key, value] of formData.entries()) {
    if (key.includes('.')) {
      const [group, segmentKey] = key.split('.');
      nextMeasurement[group][segmentKey] = Number(value);
    } else {
      nextMeasurement[key] = key === 'date' ? value : Number(value);
    }
  }

  state = nextMeasurement;
  dataStore.history.push(structuredClone(nextMeasurement));
  saveStore();
  render();
  showToast('Medición guardada en localStorage');
});

document.querySelector('#toggleEdit').addEventListener('click', () => {
  editorPanel.classList.toggle('hidden');
});

document.querySelector('#resetData').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(dataStore, createDefaultStore());
  state = dataStore.current;
  render();
  showToast('Datos restaurados al diseño original');
});

render();
