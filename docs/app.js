async function fetchJSON(path) {
    const response = await fetch(path);
    return await response.json();
}

function renderOverall(ctx, totals) {
    const data = {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
            data: [totals.positive, totals.neutral, totals.negative],
            backgroundColor: ['#16a34a', '#6b7280', '#dc2626'],
            borderWidth: 0
        }]
    };
    
    new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e5e7eb' }
                }
            }
        }
    });
}

function renderBars(ctx, data, labelKey, valueKeys, sortBy) {
    // Sort data
    const sortedData = [...data].sort((a, b) => {
        if (sortBy === 'count') {
            return (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative);
        }
        return (b[sortBy] || 0) - (a[sortBy] || 0);
    });
    
    // Take top 10 to avoid overcrowding
    const topData = sortedData.slice(0, 10);
    
    const chartData = {
        labels: topData.map(item => item[labelKey]),
        datasets: valueKeys.map((key, index) => ({
            label: key.charAt(0).toUpperCase() + key.slice(1),
            data: topData.map(item => item[key] || 0),
            backgroundColor: ['#16a34a', '#6b7280', '#dc2626'][index],
        }))
    };
    
    new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: '#e5e7eb' },
                    grid: { color: '#374151' }
                },
                y: {
                    stacked: true,
                    ticks: { color: '#e5e7eb' },
                    grid: { color: '#374151' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#e5e7eb' }
                }
            }
        }
    });
}

function renderTrend(ctx, history) {
    const labels = history.map(h => h.date);
    const datasets = ['positive', 'neutral', 'negative'].map((key, index) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        data: history.map(h => h[key] || 0),
        borderColor: ['#16a34a', '#6b7280', '#dc2626'][index],
        backgroundColor: ['#16a34a', '#6b7280', '#dc2626'][index] + '20',
        fill: false,
        tension: 0.1
    }));
    
    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: { color: '#e5e7eb' },
                    grid: { color: '#374151' }
                },
                y: {
                    ticks: { color: '#e5e7eb' },
                    grid: { color: '#374151' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#e5e7eb' }
                }
            }
        }
    });
}

function renderHeadlines(listEl, items) {
    listEl.innerHTML = '';
    items.forEach(it => {
        const li = document.createElement('li');
        li.className = 'headline';
        li.innerHTML = `
            <div class="tag ${it.sentiment}">${it.sentiment}</div>
            <div>
                <a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>
                <div class="meta">${it.source} • ${new Date(it.published).toLocaleString()}</div>
            </div>
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
            pubChartEl.remove();
            const canvas = document.createElement('canvas');
            canvas.id = 'pubChart';
            parent.appendChild(canvas);
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
