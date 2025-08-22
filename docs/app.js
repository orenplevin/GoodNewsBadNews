// Modern gradient color palette
const COLORS = {
    positive: '#00D4AA',
    neutral: '#8B93A6', 
    negative: '#FF6B9D',
    gradients: {
        positive: 'linear-gradient(135deg, #00D4AA 0%, #43E97B 100%)',
        neutral: 'linear-gradient(135deg, #8B93A6 0%, #A8B5C8 100%)',
        negative: 'linear-gradient(135deg, #FF6B9D 0%, #F093FB 100%)',
        primary: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
        secondary: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
        tertiary: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
        quaternary: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)'
    },
    chart: {
        positive: '#00D4AA',
        neutral: '#8B93A6',
        negative: '#FF6B9D',
        background: 'rgba(255, 255, 255, 0.02)',
        grid: 'rgba(255, 255, 255, 0.1)',
        text: 'rgba(255, 255, 255, 0.7)'
    }
};

async function fetchJSON(path) {
    const response = await fetch(path);
    return await response.json();
}

function updateSummaryStats(totals) {
    const total = totals.positive + totals.neutral + totals.negative;
    
    // Add count animations
    animateCounter('positiveCount', totals.positive);
    animateCounter('neutralCount', totals.neutral);
    animateCounter('negativeCount', totals.negative);
    animateCounter('totalCount', total);
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = 0;
    const duration = 1500;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
        
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

function updateSourceCount(byPublication) {
    const sourceCount = byPublication.length;
    document.getElementById('sourceCountBadge').textContent = sourceCount;
}

function renderSourcesList(byPublication) {
    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = '';
    
    // Sort by total count
    const sortedSources = [...byPublication].sort((a, b) => 
        (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative)
    ).slice(0, 12); // Show top 12 sources
    
    sortedSources.forEach((source, index) => {
        const total = source.positive + source.neutral + source.negative;
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.style.animationDelay = `${index * 50}ms`;
        sourceItem.innerHTML = `
            <div class="source-name">${source.source}</div>
            <div class="source-count">${total} articles</div>
        `;
        sourcesList.appendChild(sourceItem);
    });
}

function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

function renderOverall(ctx, totals) {
    const data = {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
            data: [totals.positive, totals.neutral, totals.negative],
            backgroundColor: [
                COLORS.chart.positive,
                COLORS.chart.neutral,
                COLORS.chart.negative
            ],
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
            cutout: '70%',
            plugins: {
                legend: {
                    display: false // We'll use custom legend
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    titleFont: { size: 14, weight: '600' },
                    bodyFont: { size: 13 },
                    padding: 12,
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
                    borderWidth: 3,
                    borderColor: '#0B0E18'
                }
            },
            animation: {
                animateRotate: true,
                duration: 2000
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
    
    const topData = sortedData.slice(0, 6); // Show top 6 for better readability
    
    const chartData = {
        labels: topData.map(item => {
            const name = item[labelKey];
            return name.length > 12 ? name.substring(0, 12) + '...' : name;
        }),
        datasets: valueKeys.map((key, index) => ({
            label: key.charAt(0).toUpperCase() + key.slice(1),
            data: topData.map(item => item[key] || 0),
            backgroundColor: [COLORS.chart.positive, COLORS.chart.neutral, COLORS.chart.negative][index],
            borderRadius: 6,
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
                        color: COLORS.chart.text,
                        font: { size: 11, weight: '500' }
                    },
                    grid: { 
                        display: false
                    },
                    border: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    ticks: { 
                        color: COLORS.chart.text,
                        font: { size: 11 }
                    },
                    grid: { 
                        color: COLORS.chart.grid,
                        borderColor: COLORS.chart.grid
                    },
                    border: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Custom legend in HTML
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 12
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
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
        borderColor: [COLORS.chart.positive, COLORS.chart.neutral, COLORS.chart.negative][index],
        backgroundColor: [COLORS.chart.positive, COLORS.chart.neutral, COLORS.chart.negative][index] + '20',
        fill: false,
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: [COLORS.chart.positive, COLORS.chart.neutral, COLORS.chart.negative][index],
        pointBorderColor: '#0B0E18',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointHoverBorderWidth: 3
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
                        color: COLORS.chart.text,
                        font: { size: 11, weight: '500' }
                    },
                    grid: { 
                        color: COLORS.chart.grid,
                        borderColor: COLORS.chart.grid
                    },
                    border: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: COLORS.chart.text,
                        font: { size: 11 }
                    },
                    grid: { 
                        color: COLORS.chart.grid,
                        borderColor: COLORS.chart.grid
                    },
                    border: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Custom legend in HTML
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 12,
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
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function renderHeadlines(listEl, items) {
    listEl.innerHTML = '';
    
    items.slice(0, 10).forEach((item, index) => { // Show top 10 headlines
        const li = document.createElement('li');
        li.className = 'headline';
        li.style.animationDelay = `${index * 100}ms`;
        
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

// Add some interactive features
function addInteractivity() {
    // Add refresh functionality
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    // Add nav item interactions
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Add source item click effects
    document.addEventListener('click', (e) => {
        if (e.target.closest('.source-item')) {
            const item = e.target.closest('.source-item');
            item.style.transform = 'scale(0.95)';
            setTimeout(() => {
                item.style.transform = '';
            }, 150);
        }
    });
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
        document.getElementById('generatedAt').textContent = `Last updated ${updateTime}`;

        // Update summary stats with animation
        updateSummaryStats(latest.totals);

        // Update source count
        updateSourceCount(latest.by_publication);

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
        
        // Add interactivity
        addInteractivity();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('generatedAt').textContent = 'Error loading data';
        
        // Show error message
        const container = document.querySelector('.main-content');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: rgba(255, 107, 157, 0.1);
            border: 1px solid #FF6B9D;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            color: #FF6B9D;
            margin: 20px 0;
            backdrop-filter: blur(20px);
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ Unable to load dashboard data</h3>
            <p>Please check if the data files exist and try refreshing the page.</p>
        `;
        container.insertBefore(errorDiv, container.firstChild);
    }
})();
