async function fetchJSON(path) {
const labels = history.map(h => h.date);
const datasets = ['positive', 'neutral', 'negative'].map(k => ({ label: k, data: history.map(h => h[k] || 0) }));
new Chart(ctx, { type: 'line', data: { labels, datasets }, options: { responsive: true }});
}


function renderHeadlines(listEl, items) {
listEl.innerHTML = '';
items.forEach(it => {
const li = document.createElement('li');
li.className = 'headline';
li.innerHTML = `
<div class="tag ${it.sentiment}">${it.sentiment}</div>
<a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>
<div class="meta">${it.source} • ${new Date(it.published).toLocaleString()}</div>
`;
listEl.appendChild(li);
});
}


(async function init() {
try {
const [latest, history] = await Promise.all([
fetchJSON('./data/latest.json'),
fetchJSON('./data/history.json')
]);


document.getElementById('generatedAt').textContent = `Updated: ${new Date(latest.generated_at).toLocaleString()}`;


// Overall
renderOverall(document.getElementById('overallChart'), latest.totals);


// By Publication (stacked)
const pubSort = document.getElementById('pubSort');
const makePub = () => renderBars(
document.getElementById('pubChart'),
latest.by_publication,
'source',
['positive', 'neutral', 'negative'],
pubSort.value
);
let pubChartEl = document.getElementById('pubChart');
makePub();
pubSort.addEventListener('change', () => {
// Re-create canvas to avoid Chart.js instance overlap
const parent = pubChartEl.parentElement;
const canvas = document.createElement('canvas');
parent.replaceChild(canvas, pubChartEl);
pubChartEl = canvas;
makePub();
});


// By Topic
renderBars(
document.getElementById('topicChart'),
latest.by_topic,
'topic',
['positive', 'neutral', 'negative'],
'count'
);


// Trend 7 days
renderTrend(document.getElementById('trendChart'), history.history);


// Headlines
renderHeadlines(document.getElementById('headlines'), latest.sample_headlines);
} catch (e) {
console.error(e);
alert('Failed to load dashboard data.');
}
})();
