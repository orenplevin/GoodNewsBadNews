// Modern color palette
const COLORS = {
    positive: '#22c55e',
    neutral: '#94a3b8', 
    negative: '#ef4444',
    accent: '#3b82f6',
    background: 'rgba(15, 23, 42, 0.8)',
    grid: '#334155'
};

async function fetchJSON(path) {
    const response = await fetch(path);
    return await response.json();
}

function updateSummaryStats(totals) {
    const total = totals.positive + totals.neutral + totals.negative;
    
    document.getElementById('positiveCount').textContent = totals.positive.toLocaleString();
    document.getElementById('neutralCount').textContent = totals.neutral.toLocaleString();
    document.getElementById('negativeCount').textContent = totals.negative.toLocaleString();
    document.getElementById('totalCount').textContent = total.toLocaleString();
}

function renderSourcesList(byPublication) {
    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = '';
    
    // Sort by total count
    const sortedSources = [...byPublication].sort((a, b) => 
        (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative)
    );
    
    sortedSources.forEach(source => {
        const total = source.positive + source.neutral + source.negative;
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.innerHTML = `
            <div class="source-name">${source.source}</div>
            <div class="source-count">${total} articles</div>
        `;
        sourcesList.appendChild(sourceItem);
    });
}

function renderOverall(ctx, totals) {
    const data = {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
            data: [totals.positive, totals.neutral, totals.negative],
            backgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative],
            borderWidth: 0,
            hoverBorderWidth: 3,
            hoverBorderColor: '#ffffff'
        }]
    };
    
    new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        color: '#f1f5f9',
                        padding: 20,
                        font: { size: 14, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: COLORS.background,
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: COLORS.grid,
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            elements: {
                arc: {
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }
            }
        }
    });
}

function renderBars(ctx, data, labelKey, valueKeys, sortBy) {
    // Sort and limit data
    const sortedData = [...data].sort((a, b) => {
        if (sortBy === 'count') {
            return (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative);
        }
        return (b[sortBy] || 0) - (a[sortBy] || 0);
    });
    
    const topData = sortedData.slice(0, 8); // Show top 8 for better readability
    
    const chartData = {
        labels: topData.map(item => {
            // Truncate long names
            const name = item[labelKey];
            return name.length > 15 ? name.substring(0, 15) + '...' : name;
        }),
        datasets: valueKeys.map((key, index) => ({
            label: key.charAt(0).toUpperCase() + key.slice(1),
            data: topData.map(item => item[key] || 0),
            backgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative][index],
            borderRadius: 4,
            borderSkipped: false,
        }))
    };
    
    new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 12 }
                    },
                    grid: { 
                        color: COLORS.grid,
                        borderColor: COLORS.grid
                    }
                },
                y: {
                    stacked: true,
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 12 }
                    },
                    grid: { 
                        color: COLORS.grid,
                        borderColor: COLORS.grid
                    }
                }
            },
            plugins: {
                legend: {
                    labels: { 
                        color: '#f1f5f9',
                        padding: 15,
                        font: { size: 13, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: COLORS.background,
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: COLORS.grid,
                    borderWidth: 1,
                    cornerRadius: 8
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function renderTrend(ctx, history) {
    const labels = history.map(h => {
        const date = new Date(h.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const datasets = ['positive', 'neutral', 'negative'].map((key, index) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        data: history.map(h => h[key] || 0),
        borderColor: [COLORS.positive, COLORS.neutral, COLORS.negative][index],
        backgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative][index] + '20',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointBackgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative][index],
        pointBorderColor: '#1e293b',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
    }));
    
    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 12 }
                    },
                    grid: { 
                        color: COLORS.grid,
                        borderColor: COLORS.grid
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 12 }
                    },
                    grid: { 
                        color: COLORS.grid,
                        borderColor: COLORS.grid
                    }
                }
            },
            plugins: {
                legend: {
                    labels: { 
                        color: '#f1f5f9',
                        padding: 15,
                        font: { size: 13, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: COLORS.background,
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: COLORS.grid,
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return `${context[0].label}`;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function renderHeadlines(listEl, items) {
    listEl.innerHTML = '';
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'headline';
        
        const publishedDate = new Date(item.published);
        const timeAgo = getTimeAgo(publishedDate);
        
        li.innerHTML = `
            <div class="tag ${item.sentiment}">${item.sentiment}</div>
            <div>
                <a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
                <div class="meta">
                    <span>${item.source}</span>
                    <span>•</span>
                    <span>${timeAgo}</span>
                </div>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

(async function init() {
    try {
        // Show loading state
        document.getElementById('generatedAt').textContent = 'Loading...';
        
        const [latest, history] = await Promise.all([
            fetchJSON('./data/latest.json'),
            fetchJSON('./data/history.json')
        ]);

        // Update timestamp
        const updateTime = new Date(latest.generated_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        document.getElementById('generatedAt').textContent = `Updated: ${updateTime}`;

        // Update summary stats
        updateSummaryStats(latest.totals);

        // Render sources list
        renderSourcesList(latest.by_publication);

        // Overall sentiment chart
        renderOverall(document.getElementById('overallChart'), latest.totals);

        // Publication chart with sorting
        const pubSort = document.getElementById('pubSort');
        let pubChartEl = document.getElementById('pubChart');
        
        const makePubChart = () => {
            renderBars(
                pubChartEl,
                latest.by_publication,
                'source',
                ['positive', 'neutral', 'negative'],
                pubSort.value
            );
        };
        
        makePubChart();
        
        pubSort.addEventListener('change', () => {
            // Destroy previous chart instance
            const chartInstance = Chart.getChart(pubChartEl);
            if (chartInstance) {
                chartInstance.destroy();
            }
            makePubChart();
        });

        // Topic chart
        renderBars(
            document.getElementById('topicChart'),
            latest.by_topic,
            'topic',
            ['positive', 'neutral', 'negative'],
            'count'
        );

        // Trend chart
        renderTrend(document.getElementById('trendChart'), history.history);

        // Headlines
        renderHeadlines(document.getElementById('headlines'), latest.sample_headlines);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('generatedAt').textContent = 'Error loading data';
        
        // Show error message
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            color: #ef4444;
            margin: 20px 0;
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ Unable to load dashboard data</h3>
            <p>Please check if the data files exist and try refreshing the page.</p>
        `;
        container.insertBefore(errorDiv, container.firstChild);
    }
})();
