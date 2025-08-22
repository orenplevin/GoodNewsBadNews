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

// Global state for filtering and layout
let globalData = {
    latest: null,
    history: null,
    selectedSources: new Set(),
    allSources: [],
    layouts: {
        default: {
            stats: { width: 240, height: 'auto' },
            sources: { height: 140 },
            sentiment: { width: '50%', height: 360 },
            trend: { width: '50%', height: 360 },
            publication: { width: '50%', height: 360 },
            topics: { width: '50%', height: 360 },
            headlines: { height: 400 }
        }
    },
    currentLayout: 'default',
    minimizedWidgets: new Set()
};

// Resize functionality
let resizeState = {
    isResizing: false,
    currentWidget: null,
    currentHandle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0
};

async function fetchJSON(path) {
    const response = await fetch(path);
    return await response.json();
}

function filterDataBySources(data, selectedSources) {
    if (selectedSources.size === 0) return data;
    
    // Filter by_publication
    const filteredByPublication = data.by_publication.filter(item => 
        selectedSources.has(item.source)
    );
    
    // Calculate new totals based on selected sources
    const filteredTotals = filteredByPublication.reduce((acc, item) => {
        acc.positive += item.positive || 0;
        acc.neutral += item.neutral || 0;
        acc.negative += item.negative || 0;
        return acc;
    }, { positive: 0, neutral: 0, negative: 0 });
    
    // Filter headlines by selected sources
    const filteredHeadlines = data.sample_headlines.filter(headline =>
        selectedSources.has(headline.source)
    );
    
    return {
        ...data,
        totals: filteredTotals,
        by_publication: filteredByPublication,
        sample_headlines: filteredHeadlines
    };
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
    const startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
    const duration = 1000;
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

function updateSourceCount() {
    const selectedCount = globalData.selectedSources.size;
    const totalCount = globalData.allSources.length;
    document.getElementById('sourceCountBadge').textContent = `${selectedCount}/${totalCount}`;
}

function renderSourcesList(byPublication) {
    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = '';
    
    // Store all sources globally
    globalData.allSources = byPublication.map(item => item.source);
    
    // Initialize all sources as selected if none are selected yet
    if (globalData.selectedSources.size === 0) {
        globalData.allSources.forEach(source => {
            globalData.selectedSources.add(source);
        });
    }
    
    // Sort by total count
    const sortedSources = [...byPublication].sort((a, b) => 
        (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative)
    );
    
    sortedSources.forEach((source, index) => {
        const total = source.positive + source.neutral + source.negative;
        const isSelected = globalData.selectedSources.has(source.source);
        
        const sourceItem = document.createElement('div');
        sourceItem.className = `source-item ${isSelected ? 'selected' : 'deselected'}`;
        sourceItem.style.animationDelay = `${index * 50}ms`;
        sourceItem.dataset.source = source.source;
        
        sourceItem.innerHTML = `
            <div class="source-name">${source.source}</div>
            <div class="source-count">${total} articles</div>
        `;
        
        // Add click handler for filtering
        sourceItem.addEventListener('click', () => {
            toggleSource(source.source);
        });
        
        sourcesList.appendChild(sourceItem);
    });
    
    updateSourceCount();
}

function toggleSource(sourceName) {
    if (globalData.selectedSources.has(sourceName)) {
        globalData.selectedSources.delete(sourceName);
    } else {
        globalData.selectedSources.add(sourceName);
    }
    
    // Update visual state
    updateSourceVisuals();
    updateSourceCount();
    
    // Re-render dashboard with filtered data
    refreshDashboard();
}

function updateSourceVisuals() {
    const sourceItems = document.querySelectorAll('.source-item');
    sourceItems.forEach(item => {
        const sourceName = item.dataset.source;
        const isSelected = globalData.selectedSources.has(sourceName);
        
        item.className = `source-item ${isSelected ? 'selected' : 'deselected'}`;
    });
}

function selectAllSources() {
    globalData.allSources.forEach(source => {
        globalData.selectedSources.add(source);
    });
    updateSourceVisuals();
    updateSourceCount();
    refreshDashboard();
}

function deselectAllSources() {
    globalData.selectedSources.clear();
    updateSourceVisuals();
    updateSourceCount();
    refreshDashboard();
}

function refreshDashboard() {
    if (!globalData.latest) return;
    
    // Filter data based on selected sources
    const filteredData = filterDataBySources(globalData.latest, globalData.selectedSources);
    
    // Update all visualizations
    updateSummaryStats(filteredData.totals);
    updateChartsWithFilteredData(filteredData);
    renderHeadlines(document.getElementById('headlines'), filteredData.sample_headlines);
    updateHeadlinesCount(filteredData.sample_headlines.length);
}

function updateChartsWithFilteredData(filteredData) {
    // Destroy existing charts
    ['overallChart', 'pubChart', 'topicChart'].forEach(chartId => {
        const chartInstance = Chart.getChart(chartId);
        if (chartInstance) {
            chartInstance.destroy();
        }
    });
    
    // Re-render charts with filtered data
    renderOverall(document.getElementById('overallChart'), filteredData.totals);
    
    const pubSort = document.getElementById('pubSort');
    renderBars(
        document.getElementById('pubChart'),
        filteredData.by_publication,
        'source',
        ['positive', 'neutral', 'negative'],
        pubSort.value
    );
    
    renderBars(
        document.getElementById('topicChart'),
        filteredData.by_topic,
        'topic',
        ['positive', 'neutral', 'negative'],
        'count'
    );
}

function updateHeadlinesCount(count) {
    document.getElementById('headlinesCount').textContent = `${count} articles`;
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
                    display: false
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
                            if (total === 0) return `${context.label}: 0 (0%)`;
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
                duration: 1000
            }
        }
    });
}

function renderBars(ctx, data, labelKey, valueKeys, sortBy) {
    if (!data || data.length === 0) {
        // Show empty state
        ctx.fillStyle = COLORS.chart.text;
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    // Sort and limit data
    const sortedData = [...data].sort((a, b) => {
        if (sortBy === 'count') {
            return (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative);
        }
        return (b[sortBy] || 0) - (a[sortBy] || 0);
    });
    
    const topData = sortedData.slice(0, 6);
    
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
                    display: false
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
                duration: 1000,
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
                    display: false
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
                duration: 1500,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function renderHeadlines(listEl, items) {
    listEl.innerHTML = '';
    
    // Show ALL headlines, not just a sample
    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'headline';
        li.style.animationDelay = `${index * 50}ms`;
        
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
    
    updateHeadlinesCount(items.length);
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Resize functionality
function initializeResize() {
    const resizeHandles = document.querySelectorAll('.resize-handle');
    const resizableWidgets = document.querySelectorAll('.resizable-widget');
    const resizableStats = document.querySelectorAll('.resizable-stat');
    
    // Add resize functionality to all elements
    [...resizeHandles].forEach(handle => {
        handle.addEventListener('mousedown', startResize);
    });
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    
    // Prevent text selection during resize
    document.addEventListener('selectstart', (e) => {
        if (resizeState.isResizing) {
            e.preventDefault();
        }
    });
}

function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target;
    const widget = handle.closest('.resizable-widget') || handle.closest('.resizable-stat');
    
    if (!widget) return;
    
    resizeState.isResizing = true;
    resizeState.currentWidget = widget;
    resizeState.currentHandle = handle;
    resizeState.startX = e.clientX;
    resizeState.startY = e.clientY;
    
    const rect = widget.getBoundingClientRect();
    resizeState.startWidth = rect.width;
    resizeState.startHeight = rect.height;
    resizeState.startLeft = rect.left;
    resizeState.startTop = rect.top;
    
    // Add visual feedback
    handle.classList.add('active');
    document.body.classList.add('resizing');
    
    // Set cursor
    const handleClass = handle.className;
    if (handleClass.includes('resize-handle-right') || handleClass.includes('resize-handle-left')) {
        document.body.style.setProperty('--resize-cursor', 'ew-resize');
    } else if (handleClass.includes('resize-handle-top') || handleClass.includes('resize-handle-bottom')) {
        document.body.style.setProperty('--resize-cursor', 'ns-resize');
    } else if (handleClass.includes('corner')) {
        document.body.style.setProperty('--resize-cursor', 'nw-resize');
    }
}

function handleResize(e) {
    if (!resizeState.isResizing) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - resizeState.startX;
    const deltaY = e.clientY - resizeState.startY;
    const widget = resizeState.currentWidget;
    const handle = resizeState.currentHandle;
    
    let newWidth = resizeState.startWidth;
    let newHeight = resizeState.startHeight;
    
    // Determine resize direction based on handle class
    const handleClass = handle.className;
    
    if (handleClass.includes('resize-handle-right')) {
        newWidth = Math.max(200, resizeState.startWidth + deltaX);
        widget.style.width = `${newWidth}px`;
    } else if (handleClass.includes('resize-handle-left')) {
        newWidth = Math.max(200, resizeState.startWidth - deltaX);
        widget.style.width = `${newWidth}px`;
    } else if (handleClass.includes('resize-handle-bottom')) {
        newHeight = Math.max(100, resizeState.startHeight + deltaY);
        widget.style.height = `${newHeight}px`;
    } else if (handleClass.includes('resize-handle-top')) {
        newHeight = Math.max(100, resizeState.startHeight - deltaY);
        widget.style.height = `${newHeight}px`;
    } else if (handleClass.includes('resize-handle-corner')) {
        newWidth = Math.max(200, resizeState.startWidth + deltaX);
        newHeight = Math.max(100, resizeState.startHeight + deltaY);
        widget.style.width = `${newWidth}px`;
        widget.style.height = `${newHeight}px`;
    } else if (handleClass.includes('resize-handle-corner-left')) {
        newWidth = Math.max(200, resizeState.startWidth - deltaX);
        newHeight = Math.max(100, resizeState.startHeight + deltaY);
        widget.style.width = `${newWidth}px`;
        widget.style.height = `${newHeight}px`;
    }
    
    // Trigger chart resize if this is a chart widget
    const canvas = widget.querySelector('canvas');
    if (canvas) {
        const chartInstance = Chart.getChart(canvas);
        if (chartInstance) {
            setTimeout(() => chartInstance.resize(), 50);
        }
    }
}

function stopResize(e) {
    if (!resizeState.isResizing) return;
    
    resizeState.currentHandle?.classList.remove('active');
    document.body.classList.remove('resizing');
    document.body.style.removeProperty('--resize-cursor');
    
    resizeState.isResizing = false;
    resizeState.currentWidget = null;
    resizeState.currentHandle = null;
}

// Widget minimize/expand functionality
function initializeMinimize() {
    const minimizeButtons = document.querySelectorAll('.minimize-btn');
    
    minimizeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const widgetType = btn.dataset.widget;
            toggleMinimize(widgetType);
        });
    });
}

function toggleMinimize(widgetType) {
    const widget = document.querySelector(`[data-widget="${widgetType}"]`);
    const btn = document.querySelector(`[data-widget="${widgetType}"].minimize-btn`);
    
    if (!widget || !btn) return;
    
    if (globalData.minimizedWidgets.has(widgetType)) {
        // Expand
        widget.classList.remove('minimized');
        globalData.minimizedWidgets.delete(widgetType);
        btn.textContent = '−';
        btn.title = 'Minimize';
    } else {
        // Minimize
        widget.classList.add('minimized');
        globalData.minimizedWidgets.add(widgetType);
        btn.textContent = '+';
        btn.title = 'Expand';
    }
    
    // Trigger chart resize for expanded charts
    if (!globalData.minimizedWidgets.has(widgetType)) {
        const canvas = widget.querySelector('canvas');
        if (canvas) {
            const chartInstance = Chart.getChart(canvas);
            if (chartInstance) {
                setTimeout(() => chartInstance.resize(), 100);
            }
        }
    }
}

// Reset layout functionality
function resetLayout() {
    const widgets = document.querySelectorAll('.resizable-widget, .resizable-stat');
    
    widgets.forEach(widget => {
        const widgetType = widget.dataset.widget;
        const defaultLayout = globalData.layouts.default[widgetType];
        
        if (defaultLayout) {
            if (defaultLayout.width) {
                widget.style.width = defaultLayout.width;
            }
            if (defaultLayout.height && defaultLayout.height !== 'auto') {
                widget.style.height = `${defaultLayout.height}px`;
            }
        }
        
        // Remove minimized state
        widget.classList.remove('minimized');
        
        // Reset minimize buttons
        const btn = widget.querySelector('.minimize-btn');
        if (btn) {
            btn.textContent = '−';
            btn.title = 'Minimize';
        }
    });
    
    // Clear minimized widgets
    globalData.minimizedWidgets.clear();
    
    // Resize all charts
    setTimeout(() => {
        Chart.instances.forEach(chart => {
            chart.resize();
        });
    }, 100);
}

// Add interactive features
function addInteractivity() {
    // Add refresh functionality
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    // Add source control buttons
    const selectAllBtn = document.getElementById('selectAllSources');
    const deselectAllBtn = document.getElementById('deselectAllSources');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllSources);
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllSources);
    }
    
    // Add reset layout button
    const resetLayoutBtn = document.getElementById('resetLayout');
    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener('click', resetLayout);
    }
    
    // Initialize resize functionality
    initializeResize();
    initializeMinimize();
}

(async function init() {
    try {
        // Show loading state
        document.getElementById('generatedAt').textContent = 'Loading...';
        
        const [latest, history] = await Promise.all([
            fetchJSON('./data/latest.json'),
            fetchJSON('./data/history.json')
        ]);

        // Store data globally
        globalData.latest = latest;
        globalData.history = history;

        // Update timestamp
        const updateTime = new Date(latest.generated_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        document.getElementById('generatedAt').textContent = `Last updated ${updateTime}`;

        // Render sources list first (this initializes selected sources)
        renderSourcesList(latest.by_publication);

        // Initial dashboard render with all sources selected
        refreshDashboard();

        // Trend chart (doesn't need filtering)
        renderTrend(document.getElementById('trendChart'), history.history);

        // Publication chart with sorting
        const pubSort = document.getElementById('pubSort');
        pubSort.addEventListener('change', () => {
            const chartInstance = Chart.getChart('pubChart');
            if (chartInstance) {
                chartInstance.destroy();
            }
            
            const filteredData = filterDataBySources(globalData.latest, globalData.selectedSources);
            renderBars(
                document.getElementById('pubChart'),
                filteredData.by_publication,
                'source',
                ['positive', 'neutral', 'negative'],
                pubSort.value
            );
        });
        
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
