"use strict";

// ---------- settings ----------
const POLL_MS = 3000;          // how often to ask the server for new readings
const OFFLINE_AFTER_S = 15;    // no reading for this long = device looks offline
const UNITS = { temperature: "°C", humidity: "%" };

// ---------- page elements ----------
const els = {
  device: document.getElementById("device"),
  limit: document.getElementById("limit"),
  status: document.getElementById("status"),
  statusText: document.getElementById("status-text"),
  latest: document.getElementById("stat-latest"),
  min: document.getElementById("stat-min"),
  max: document.getElementById("stat-max"),
  avg: document.getElementById("stat-avg"),
  tableBody: document.getElementById("table-body"),
  canvas: document.getElementById("chart"),
};

// ---------- state ----------
const state = {
  device: "",                       // empty = let the server pick the first device
  limit: Number(els.limit.value),   // how many readings to keep on screen
  readings: [],                     // oldest first
  lastId: 0,                        // id of the newest reading we already have
  devices: [],
};
let requestToken = 0;               // used to ignore outdated responses

// ---------- chart ----------
const css = getComputedStyle(document.documentElement);
const accent = css.getPropertyValue("--accent").trim();
const muted = css.getPropertyValue("--muted").trim();
const gridColor = css.getPropertyValue("--border").trim();

const chart = new Chart(els.canvas, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Value",
      data: [],
      borderColor: accent,
      backgroundColor: accent + "22",
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 10,
      borderWidth: 2,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: muted, maxTicksLimit: 8 }, grid: { color: gridColor } },
      y: { ticks: { color: muted }, grid: { color: gridColor } },
    },
  },
});

// ---------- talking to the server ----------
async function poll() {
  const token = ++requestToken;
  const params = new URLSearchParams({ limit: state.limit });
  if (state.device) params.set("device", state.device);
  if (state.lastId > 0) params.set("after_id", state.lastId);

  try {
    const response = await fetch("readings.php?" + params, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (token !== requestToken) return;   // a newer request replaced this one
    applyData(data);
  } catch (error) {
    if (token !== requestToken) return;
    setStatus("error", "Server unreachable");
  }
}

function resetAndPoll() {
  state.readings = [];
  state.lastId = 0;
  poll();
}

function applyData(data) {
  const fullLoad = state.lastId === 0;
  state.device = data.device || "";
  syncDevices(data.devices);

  if (data.readings.length > 0) {
    state.readings = fullLoad ? data.readings : state.readings.concat(data.readings);
    if (state.readings.length > state.limit) {
      state.readings = state.readings.slice(-state.limit);
    }
    state.lastId = state.readings[state.readings.length - 1].id;
  } else if (fullLoad) {
    state.readings = [];
  }

  render(data.age);
}

// ---------- drawing ----------
function render(age) {
  const readings = state.readings;
  const latest = readings[readings.length - 1];
  const unit = latest ? (UNITS[latest.sensor_type] || "") : "";
  const format = (n) => n.toFixed(1) + (unit ? " " + unit : "");

  // stat cards
  if (latest) {
    const values = readings.map((r) => r.value);
    els.latest.textContent = format(latest.value);
    els.min.textContent = format(Math.min(...values));
    els.max.textContent = format(Math.max(...values));
    els.avg.textContent = format(values.reduce((a, b) => a + b, 0) / values.length);
  } else {
    [els.latest, els.min, els.max, els.avg].forEach((el) => (el.textContent = "–"));
  }

  // chart (the time part of "YYYY-MM-DD HH:MM:SS" is characters 11-19)
  chart.data.labels = readings.map((r) => r.created_at.slice(11, 19));
  chart.data.datasets[0].data = readings.map((r) => r.value);
  chart.update();

  // table: ten newest readings, newest first
  els.tableBody.replaceChildren();
  if (readings.length === 0) {
    const row = els.tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.className = "empty";
    cell.textContent = "No readings yet. Start the simulator or your device.";
  } else {
    readings.slice(-10).reverse().forEach((r) => {
      const row = els.tableBody.insertRow();
      row.insertCell().textContent = r.created_at;
      row.insertCell().textContent = r.sensor_type;
      row.insertCell().textContent = format(r.value);
    });
  }

  // status pill
  if (!state.device || age === null) {
    setStatus("wait", "Waiting for the first reading…");
  } else if (age <= OFFLINE_AFTER_S) {
    setStatus("live", "Live · last reading " + age + " s ago");
  } else {
    setStatus("offline", "No data for " + describeAge(age));
  }
}

function setStatus(kind, text) {
  els.status.className = "status status--" + kind;
  els.statusText.textContent = text;
}

function describeAge(seconds) {
  if (seconds < 120) return seconds + " s";
  if (seconds < 7200) return Math.round(seconds / 60) + " min";
  return Math.round(seconds / 3600) + " h";
}

// Rebuild the device dropdown only when the list of devices changed.
function syncDevices(devices) {
  if (JSON.stringify(devices) !== JSON.stringify(state.devices)) {
    state.devices = devices;
    els.device.replaceChildren(
      ...devices.map((id) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = id;
        return option;
      })
    );
  }
  els.device.value = state.device;
}

// ---------- events and start ----------
els.device.addEventListener("change", () => {
  state.device = els.device.value;
  resetAndPoll();
});

els.limit.addEventListener("change", () => {
  state.limit = Number(els.limit.value);
  resetAndPoll();
});

poll();
setInterval(() => {
  if (!document.hidden) poll();   // pause while the tab is in the background
}, POLL_MS);
