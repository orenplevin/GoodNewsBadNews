/*
 * Main application script for the News Sentiment Dashboard
 *
 * This script loads sentiment data from JSON endpoints, allows users to
 * filter by news source, and renders a collection of charts using
 * Chart.js. Additional widgets display summary statistics and the
 * latest headlines. Where possible we avoid modifying DOM elements
 * directly and instead use helper functions to keep the code
 * organised.
 */

// Base URL where the data JSON files live. When the dashboard is served
// from GitHub Pages the `data` directory sits alongside `index.html`.
// Using a relative path ensures the fetch requests work correctly
// regardless of whether the app is hosted on GitHub Pages or opened
// locally from the filesystem. The trailing slash is important so
// that `latest.json` resolves to `./data/latest.json`.
const DATA_BASE_URL = './data/';

// Colour definitions matching those in styles.css
const COLOR = {
  positive: '#00D4AA',
  neutral: '#8B93A6',
  negative: '#FF6B9D',
  text: 'rgba(255,255,255,0.8)',
  grid: 'rgba(255,255,255,0.15)',
};

// A small set of common English stop words used when extracting
// trending keywords. These are lower‑case and should cover most
// frequently used words that add little meaning.
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'and',
  'in',
  'on',
  'for',
  'with',
  'at',
  'by',
  'from',
  'up',
  'about',
  'into',
  'over',
  'after',
  'under',
  'above',
  'below',
  'between',
  'through',
  'during',
  'before',
  'again',
  'further',
  'then',
  'once',
  'all',
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'but',
  'if',
  'or',
  'because',
  'as',
  'until',
  'while',
  'nor',
  'so',
  'than',
  'too',
  'very',
  'can',
  'will',
  'just',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  's',
  't',
  're',
  'll',
  'd',
  've',
  'm',
  'y',
  'just',
  'don',
  'should',
  'now',
]);

// Global state object to store loaded data and selected sources
const globalData = {
  latest: null,
  history: null,
  selectedSources: new Set(),
};

// Keep references to chart instances so we can destroy them on update
let overallChart;
let pubChart;
let topicChart;
let trendChart;
let regionChart;
let keywordsChart;

/**
 * Fetch a JSON file from a URL. Returns a parsed object. Throws
 * if the network request fails or if the response is not valid JSON.
 * @param {string} url
 */
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Fetch latest and history data. If local data is unavailable the
 * function will fall back to using the remote URLs defined above.
 */
async function loadData() {
  try {
    const latest = await fetchJSON(`${DATA_BASE_URL}latest.json`);
    const history = await fetchJSON(`${DATA_BASE_URL}history.json`);
    return { latest, history };
  } catch (e) {
    console.error('Error fetching data:', e);
    throw e;
  }
}

/**
 * Build the sources list in the sidebar. Each source can be toggled
 * individually, allowing the user to filter the dashboard. When no
 * sources are selected the dashboard shows all data. Sources are
 * sorted alphabetically for easier scanning.
 * @param {Array} byPublication
 */
function renderSourcesList(byPublication) {
  const listEl = document.getElementById('sourcesList');
  listEl.innerHTML = '';
  // Sort sources alphabetically
  const sorted = [...byPublication].sort((a, b) =>
    a.source.localeCompare(b.source)
  );
  sorted.forEach((item) => {
    const li = document.createElement('div');
    li.className = 'source-item';
    li.dataset.source = item.source;
    li.innerHTML = `<span>${item.source}</span><span>${item.count}</span>`;
    li.addEventListener('click', () => {
      toggleSource(item.source);
    });
    listEl.appendChild(li);
  });
  updateSourceVisuals();
}

/**
 * Toggle a source in the selected set. If the source is already
 * selected it will be removed; otherwise it will be added. Then
 * refresh the dashboard.
 * @param {string} source
 */
function toggleSource(source) {
  if (globalData.selectedSources.has(source)) {
    globalData.selectedSources.delete(source);
  } else {
    globalData.selectedSources.add(source);
  }
  updateSourceVisuals();
  updateDashboard();
}

/**
 * Highlight selected sources in the sidebar.
 */
function updateSourceVisuals() {
  const items = document.querySelectorAll('.source-item');
  items.forEach((item) => {
    const sourceName = item.dataset.source;
    if (globalData.selectedSources.has(sourceName)) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

/**
 * Select all sources. Called when the user clicks the All button.
 */
function selectAllSources() {
  globalData.latest.by_publication.forEach((item) => {
    globalData.selectedSources.add(item.source);
  });
  updateSourceVisuals();
  updateDashboard();
}

/**
 * Deselect all sources. Called when the user clicks the None button.
 */
function deselectAllSources() {
  globalData.selectedSources.clear();
  updateSourceVisuals();
  updateDashboard();
}

/**
 * Filter the latest data based on the currently selected sources.
 * Returns an object with recalculated totals, publication list,
 * topic list, region list and sample headlines. When no sources are
 * selected this function returns the original data unchanged.
 * @param {Object} latest
 * @param {Set<string>} selected
 */
function filterDataBySources(latest, selected) {
  if (!selected || selected.size === 0) {
    // Nothing selected: return original data
    return {
      totals: latest.totals,
      by_publication: latest.by_publication,
      by_topic: latest.by_topic,
      by_region: latest.by_region,
      sample_headlines: latest.sample_headlines,
    };
  }
  // Filter by publication
  const filteredPublications = latest.by_publication.filter((item) =>
    selected.has(item.source)
  );
  // Recalculate totals
  const totals = filteredPublications.reduce(
    (acc, item) => {
      acc.positive += item.positive || 0;
      acc.neutral += item.neutral || 0;
      acc.negative += item.negative || 0;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );
  // Filter sample headlines by source
  const filteredHeadlines = latest.sample_headlines.filter((h) =>
    selected.has(h.source)
  );
  // Recalculate by_topic from filtered publications
  const topicMap = {};
  latest.by_topic.forEach((t) => {
    topicMap[t.topic] = { positive: 0, neutral: 0, negative: 0 };
  });
  filteredPublications.forEach((pub) => {
    // Use the topic of each publication? The provided data gives topics separately, so we simply copy original by_topic as we cannot derive per publication topics.
  });
  // In absence of per‑publication topic data, copy the original by_topic unfiltered.
  const filteredByTopic = latest.by_topic;
  // Recalculate by_region from filtered publications
  const regionMap = {};
  filteredPublications.forEach((pub) => {
    const region = pub.region || 'Other';
    if (!regionMap[region]) {
      regionMap[region] = { positive: 0, neutral: 0, negative: 0 };
    }
    regionMap[region].positive += pub.positive || 0;
    regionMap[region].neutral += pub.neutral || 0;
    regionMap[region].negative += pub.negative || 0;
  });
  const filteredByRegion = Object.entries(regionMap).map(([region, val]) => ({
    region,
    positive: val.positive,
    neutral: val.neutral,
    negative: val.negative,
    count: val.positive + val.neutral + val.negative,
  }));
  return {
    totals,
    by_publication: filteredPublications,
    by_topic: filteredByTopic,
    by_region: filteredByRegion,
    sample_headlines: filteredHeadlines,
  };
}

/**
 * Update the summary statistic cards with new totals. If a value
 * changes, the count will animate smoothly from its current value
 * to the new value.
 * @param {Object} totals
 */
function updateStats(totals) {
  animateCounter('positiveCount', totals.positive);
  animateCounter('neutralCount', totals.neutral);
  animateCounter('negativeCount', totals.negative);
  animateCounter('totalCount', totals.positive + totals.neutral + totals.negative);
}

/**
 * Animate a numeric counter from its current displayed value to a
 * target value. Uses a simple ease‑out function for a smoother
 * appearance.
 * @param {string} id
 * @param {number} targetValue
 */
function animateCounter(id, targetValue) {
  const el = document.getElementById(id);
  const startValue = parseInt(el.innerText.replace(/,/g, '')) || 0;
  const duration = 500;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(startValue + (targetValue - startValue) * eased);
    el.innerText = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/**
 * Render or update the sentiment distribution doughnut chart. If a
 * previous instance exists, it will be destroyed before creating
 * a new one.
 * @param {Object} totals
 */
function renderOverallChart(totals) {
  const ctx = document.getElementById('overallChart').getContext('2d');
  if (overallChart) overallChart.destroy();
  overallChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [
        {
          data: [totals.positive, totals.neutral, totals.negative],
          backgroundColor: [COLOR.positive, COLOR.neutral, COLOR.negative],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const value = context.parsed;
              const pct = total ? ((value / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Render or update the by publication bar chart. Top N publications
 * will be shown depending on sort criteria.
 * @param {Array} byPub
 * @param {string} sortBy
 */
function renderPublicationChart(byPub, sortBy) {
  const ctx = document.getElementById('pubChart').getContext('2d');
  if (pubChart) pubChart.destroy();
  // Sort the data
  const sorted = [...byPub].sort((a, b) => {
    if (sortBy === 'count') {
      return b.count - a.count;
    }
    return (b[sortBy] || 0) - (a[sortBy] || 0);
  });
  const top = sorted.slice(0, 8);
  const labels = top.map((item) => item.source.length > 12 ? item.source.slice(0, 12) + '…' : item.source);
  const pos = top.map((item) => item.positive || 0);
  const neu = top.map((item) => item.neutral || 0);
  const neg = top.map((item) => item.negative || 0);
  pubChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Positive',
          data: pos,
          backgroundColor: COLOR.positive,
        },
        {
          label: 'Neutral',
          data: neu,
          backgroundColor: COLOR.neutral,
        },
        {
          label: 'Negative',
          data: neg,
          backgroundColor: COLOR.negative,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: COLOR.text } },
        y: { stacked: true, ticks: { color: COLOR.text } },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

/**
 * Render or update the by topic bar chart. Shows all topics sorted
 * by total count.
 * @param {Array} byTopic
 */
function renderTopicChart(byTopic) {
  const ctx = document.getElementById('topicChart').getContext('2d');
  if (topicChart) topicChart.destroy();
  const sorted = [...byTopic].sort((a, b) => b.count - a.count);
  const labels = sorted.map((item) => item.topic);
  const pos = sorted.map((item) => item.positive || 0);
  const neu = sorted.map((item) => item.neutral || 0);
  const neg = sorted.map((item) => item.negative || 0);
  topicChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Positive', data: pos, backgroundColor: COLOR.positive },
        { label: 'Neutral', data: neu, backgroundColor: COLOR.neutral },
        { label: 'Negative', data: neg, backgroundColor: COLOR.negative },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: COLOR.text } },
        y: { stacked: true, ticks: { color: COLOR.text } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/**
 * Render or update the 7‑day trend line chart. Data is not affected
 * by source filtering.
 * @param {Array} historyArr
 */
function renderTrendChart(historyArr) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  const labels = historyArr.map((h) => {
    const d = new Date(h.date);
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  });
  const pos = historyArr.map((h) => h.positive || 0);
  const neu = historyArr.map((h) => h.neutral || 0);
  const neg = historyArr.map((h) => h.negative || 0);
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Positive',
          data: pos,
          borderColor: COLOR.positive,
          backgroundColor: `${COLOR.positive}33`,
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Neutral',
          data: neu,
          borderColor: COLOR.neutral,
          backgroundColor: `${COLOR.neutral}33`,
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Negative',
          data: neg,
          borderColor: COLOR.negative,
          backgroundColor: `${COLOR.negative}33`,
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: COLOR.text } },
        y: { ticks: { color: COLOR.text } },
      },
      plugins: { legend: { display: true } },
    },
  });
}

/**
 * Render or update the regional sentiment bar chart.
 * @param {Array} byRegion
 */
function renderRegionChart(byRegion) {
  const ctx = document.getElementById('regionChart').getContext('2d');
  if (regionChart) regionChart.destroy();
  const sorted = [...byRegion].sort((a, b) => b.count - a.count);
  const labels = sorted.map((item) => item.region);
  const pos = sorted.map((item) => item.positive || 0);
  const neu = sorted.map((item) => item.neutral || 0);
  const neg = sorted.map((item) => item.negative || 0);
  regionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Positive', data: pos, backgroundColor: COLOR.positive },
        { label: 'Neutral', data: neu, backgroundColor: COLOR.neutral },
        { label: 'Negative', data: neg, backgroundColor: COLOR.negative },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: COLOR.text } },
        y: { stacked: true, ticks: { color: COLOR.text } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/**
 * Extract the top keywords from the list of headlines. Filtering by
 * sentiment will include only headlines matching the chosen
 * sentiment ('positive', 'negative', or 'all'). Returns an array
 * of objects with keyword and count properties.
 * @param {Array} headlines
 * @param {string} sentimentFilter
 * @param {number} topN
 */
function extractTopKeywords(headlines, sentimentFilter = 'all', topN = 10) {
  const freq = {};
  headlines.forEach((item) => {
    if (sentimentFilter !== 'all' && item.sentiment !== sentimentFilter) {
      return;
    }
    const words = item.title
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOPWORDS.has(w));
    words.forEach((word) => {
      freq[word] = (freq[word] || 0) + 1;
    });
  });
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
  return sorted.map(([keyword, count]) => ({ keyword, count }));
}

/**
 * Render or update the trending keywords bar chart.
 * @param {Array} keywordsData
 */
function renderKeywordsChart(keywordsData) {
  const ctx = document.getElementById('keywordsChart').getContext('2d');
  if (keywordsChart) keywordsChart.destroy();
  const labels = keywordsData.map((k) => k.keyword);
  const counts = keywordsData.map((k) => k.count);
  keywordsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Frequency',
          data: counts,
          backgroundColor: COLOR.positive,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: COLOR.text } },
        y: { ticks: { color: COLOR.text } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/**
 * Render the headlines list. Displays title, source and how long
 * ago the article was published. Only the first 30 headlines are
 * shown for brevity.
 * @param {Array} headlines
 */
function renderHeadlinesList(headlines) {
  const listEl = document.getElementById('headlines');
  listEl.innerHTML = '';
  const slice = headlines.slice(0, 30);
  slice.forEach((item) => {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.className = 'headline-title';
    title.textContent = item.title;
    const meta = document.createElement('span');
    meta.className = 'headline-meta';
    meta.textContent = `${item.source} • ${formatTimeAgo(item.published)}`;
    li.appendChild(title);
    li.appendChild(meta);
    listEl.appendChild(li);
  });
  document.getElementById('headlinesCount').textContent = `${headlines.length} articles`;
}

/**
 * Convert an ISO timestamp into a relative time string (e.g. 2h ago).
 * @param {string} iso
 */
function formatTimeAgo(iso) {
  const published = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - published) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Update all charts and widgets based on current state. This
 * function is called whenever data is loaded or the selected
 * sources change.
 */
function updateDashboard() {
  if (!globalData.latest) return;
  const filtered = filterDataBySources(globalData.latest, globalData.selectedSources);
  updateStats(filtered.totals);
  renderOverallChart(filtered.totals);
  // Determine sort option for publication chart
  const sortBy = document.getElementById('pubSort').value || 'count';
  renderPublicationChart(filtered.by_publication, sortBy);
  renderTopicChart(filtered.by_topic);
  renderRegionChart(filtered.by_region);
  // Keywords sentiment filter
  const kwFilter = document.getElementById('keywordsSentiment').value || 'all';
  const keywordsData = extractTopKeywords(filtered.sample_headlines, kwFilter, 10);
  renderKeywordsChart(keywordsData);
  renderHeadlinesList(filtered.sample_headlines);
}

/**
 * Initialise the dashboard: load data, set up event listeners and
 * render everything for the first time.
 */
async function init() {
  try {
    const { latest, history } = await loadData();
    globalData.latest = latest;
    globalData.history = history;
    // Set update time
    const updateDate = new Date(latest.generated_at);
    document.getElementById('generatedAt').textContent = `Last updated ${updateDate.toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    // Build sources list
    renderSourcesList(latest.by_publication);
    // Event listeners for controls
    document.getElementById('selectAllSources').addEventListener('click', selectAllSources);
    document.getElementById('deselectAllSources').addEventListener('click', deselectAllSources);
    document.getElementById('pubSort').addEventListener('change', updateDashboard);
    document.getElementById('keywordsSentiment').addEventListener('change', updateDashboard);
    // Render static charts once
    renderTrendChart(history.history);
    // Initially select all sources
    selectAllSources();
  } catch (err) {
    console.error(err);
    document.getElementById('generatedAt').textContent = 'Error loading data';
  }
}

// Kick off when DOM content is ready
document.addEventListener('DOMContentLoaded', init);
