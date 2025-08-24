// Headlines Editor JavaScript
let allHeadlines = [];
let filteredHeadlines = [];
let editedHeadlines = new Map(); // Track edited headlines
let currentPage = 1;
let itemsPerPage = 50;
let currentEditId = null;
let sortBy = 'published';
let sortDirection = 'desc';

// Load headlines data
async function loadHeadlines() {
    try {
        const response = await fetch('./data/latest.json');
        const data = await response.json();
        
        // Get all headlines with their topics
        allHeadlines = data.sample_headlines.map((headline, index) => ({
            ...headline,
            id: index,
            topic: headline.topic || classifyTopic(headline.title) // Use existing or classify
        }));
        
        // Initialize filters
        initializeFilters(data);
        
        // Apply initial filter and render
        applyFilters();
        
    } catch (error) {
        console.error('Error loading headlines:', error);
    }
}

// Topic classification (same as in fetcher.py)
function classifyTopic(text) {
    const topicKeywords = {
        'Politics': ['election', 'president', 'parliament', 'congress', 'minister', 'policy', 'politic', 'government', 'senate', 'vote'],
        'Business': ['market', 'stocks', 'earnings', 'profit', 'merger', 'economy', 'inflation', 'startup', 'ipo', 'trading', 'finance'],
        'Tech': ['ai', 'artificial intelligence', 'iphone', 'android', 'microsoft', 'google', 'apple', 'meta', 'openai', 'software', 'chip', 'semiconductor', 'startup', 'tech'],
        'Sports': ['match', 'game', 'tournament', 'league', 'world cup', 'olympic', 'goal', 'coach', 'player', 'team', 'football', 'basketball', 'tennis'],
        'Health': ['covid', 'cancer', 'vaccine', 'health', 'disease', 'nhs', 'virus', 'medical', 'hospital', 'doctor'],
        'Science': ['research', 'study', 'space', 'nasa', 'astronomy', 'physics', 'biology', 'climate', 'environment'],
        'Entertainment': ['movie', 'film', 'celebrity', 'music', 'box office', 'tv', 'netflix', 'streaming', 'hollywood'],
        'World': ['ukraine', 'gaza', 'israel', 'middle east', 'eu', 'china', 'russia', 'africa', 'asia', 'europe', 'america', 'war', 'conflict'],
    };
    
    const textLower = (text || '').toLowerCase();
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(keyword => textLower.includes(keyword))) {
            return topic;
        }
    }
    
    return 'Other';
}

// Initialize filter dropdowns
function initializeFilters(data) {
    // Sources filter
    const sources = [...new Set(allHeadlines.map(h => h.source))].sort();
    const sourceSelect = document.getElementById('filterSource');
    sources.forEach(source => {
        const option = document.createElement('option');
        option.value = source;
        option.textContent = source;
        sourceSelect.appendChild(option);
    });
    
    // Regions filter
    const regions = [...new Set(allHeadlines.map(h => h.region))].sort();
    const regionSelect = document.getElementById('filterRegion');
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sourceFilter = document.getElementById('filterSource').value;
    const topicFilter = document.getElementById('filterTopic').value;
    const sentimentFilter = document.getElementById('filterSentiment').value;
    const regionFilter = document.getElementById('filterRegion').value;
    
    filteredHeadlines = allHeadlines.filter(headline => {
        // Apply edited values if they exist
        const current = editedHeadlines.has(headline.id) ? 
            { ...headline, ...editedHeadlines.get(headline.id) } : headline;
        
        // Search filter
        if (searchTerm && !current.title.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        // Source filter
        if (sourceFilter && current.source !== sourceFilter) {
            return false;
        }
        
        // Topic filter
        if (topicFilter && current.topic !== topicFilter) {
            return false;
        }
        
        // Sentiment filter
        if (sentimentFilter && current.sentiment !== sentimentFilter) {
            return false;
        }
        
        // Region filter
        if (regionFilter && current.region !== regionFilter) {
            return false;
        }
        
        return true;
    });
    
    // Sort headlines
    sortHeadlines();
    
    // Update filter stats
    document.getElementById('filterResults').textContent = 
        `Showing ${filteredHeadlines.length} of ${allHeadlines.length} headlines`;
    
    // Reset to first page
    currentPage = 1;
    
    // Render table
    renderTable();
}

// Sort headlines
function sortHeadlines() {
    filteredHeadlines.sort((a, b) => {
        let aVal, bVal;
        
        if (sortBy === 'published') {
            aVal = new Date(a.published);
            bVal = new Date(b.published);
        } else if (sortBy === 'source') {
            aVal = a.source;
            bVal = b.source;
        }
        
        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

// Render table
function renderTable() {
    const tbody = document.getElementById('headlinesBody');
    tbody.innerHTML = '';
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredHeadlines.length);
    const pageHeadlines = filteredHeadlines.slice(startIndex, endIndex);
    
    // Render rows
    pageHeadlines.forEach(headline => {
        const row = createTableRow(headline);
        tbody.appendChild(row);
    });
    
    // Update pagination
    updatePagination();
}

// Create table row
function createTableRow(headline) {
    const row = document.createElement('tr');
    
    // Apply edited values if they exist
    const current = editedHeadlines.has(headline.id) ? 
        { ...headline, ...editedHeadlines.get(headline.id) } : headline;
    
    // Mark as edited if it has been modified
    if (editedHeadlines.has(headline.id)) {
        row.classList.add('edited');
    }
    
    // Time column
    const timeCell = document.createElement('td');
    timeCell.className = 'time-cell';
    const date = new Date(current.published);
    timeCell.textContent = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    row.appendChild(timeCell);
    
    // Headline column
    const headlineCell = document.createElement('td');
    const headlineLink = document.createElement('a');
    headlineLink.href = current.url;
    headlineLink.target = '_blank';
    headlineLink.className = 'headline-link';
    headlineLink.textContent = current.title;
    headlineLink.title = current.title; // Full title on hover
    headlineCell.appendChild(headlineLink);
    row.appendChild(headlineCell);
    
    // Source column
    const sourceCell = document.createElement('td');
    sourceCell.textContent = current.source;
    row.appendChild(sourceCell);
    
    // Region column
    const regionCell = document.createElement('td');
    regionCell.textContent = current.region;
    row.appendChild(regionCell);
    
    // Topic column
    const topicCell = document.createElement('td');
    const topicSelect = document.createElement('select');
    topicSelect.className = 'topic-select';
    topicSelect.innerHTML = `
        <option value="Politics" ${current.topic === 'Politics' ? 'selected' : ''}>Politics</option>
        <option value="Business" ${current.topic === 'Business' ? 'selected' : ''}>Business</option>
        <option value="Tech" ${current.topic === 'Tech' ? 'selected' : ''}>Tech</option>
        <option value="Sports" ${current.topic === 'Sports' ? 'selected' : ''}>Sports</option>
        <option value="Health" ${current.topic === 'Health' ? 'selected' : ''}>Health</option>
        <option value="Science" ${current.topic === 'Science' ? 'selected' : ''}>Science</option>
        <option value="Entertainment" ${current.topic === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
        <option value="World" ${current.topic === 'World' ? 'selected' : ''}>World</option>
        <option value="Other" ${current.topic === 'Other' ? 'selected' : ''}>Other</option>
    `;
    topicSelect.onchange = () => updateField(headline.id, 'topic', topicSelect.value);
    topicCell.appendChild(topicSelect);
    row.appendChild(topicCell);
    
    // Sentiment column
    const sentimentCell = document.createElement('td');
    const sentimentSelect = document.createElement('select');
    sentimentSelect.className = `sentiment-select ${current.sentiment}`;
    sentimentSelect.innerHTML = `
        <option value="positive" ${current.sentiment === 'positive' ? 'selected' : ''}>Positive</option>
        <option value="neutral" ${current.sentiment === 'neutral' ? 'selected' : ''}>Neutral</option>
        <option value="negative" ${current.sentiment === 'negative' ? 'selected' : ''}>Negative</option>
    `;
    sentimentSelect.onchange = () => {
        updateField(headline.id, 'sentiment', sentimentSelect.value);
        sentimentSelect.className = `sentiment-select ${sentimentSelect.value}`;
    };
    sentimentCell.appendChild(sentimentSelect);
    row.appendChild(sentimentCell);
    
    // Actions column
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    editBtn.onclick = () => openEditModal(headline);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deleteHeadline(headline.id);
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    actionsCell.appendChild(actionsDiv);
    row.appendChild(actionsCell);
    
    return row;
}

// Update field
function updateField(id, field, value) {
    if (!editedHeadlines.has(id)) {
        editedHeadlines.set(id, {});
    }
    
    const edits = editedHeadlines.get(id);
    edits[field] = value;
    
    // Enable save button
    document.getElementById('saveChanges').disabled = false;
    
    // Re-render table to show edited state
    renderTable();
}

// Delete headline
function deleteHeadline(id) {
    if (confirm('Are you sure you want to delete this headline?')) {
        // Mark as deleted
        if (!editedHeadlines.has(id)) {
            editedHeadlines.set(id, {});
        }
        editedHeadlines.get(id).deleted = true;
        
        // Remove from filtered list
        filteredHeadlines = filteredHeadlines.filter(h => h.id !== id);
        
        // Enable save button
        document.getElementById('saveChanges').disabled = false;
        
        // Re-render
        renderTable();
    }
}

// Open edit modal
function openEditModal(headline) {
    currentEditId = headline.id;
    
    // Apply edited values if they exist
    const current = editedHeadlines.has(headline.id) ? 
        { ...headline, ...editedHeadlines.get(headline.id) } : headline;
    
    // Populate modal fields
    document.getElementById('editTitle').value = current.title;
    document.getElementById('editUrl').value = current.url;
    document.getElementById('editSource').value = current.source;
    document.getElementById('editRegion').value = current.region;
    document.getElementById('editTopic').value = current.topic;
    document.getElementById('editSentiment').value = current.sentiment;
    
    // Show modal
    document.getElementById('editModal').classList.remove('hidden');
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    currentEditId = null;
}

// Save edit
function saveEdit() {
    if (currentEditId === null) return;
    
    // Get values
    const edits = {
        title: document.getElementById('editTitle').value,
        url: document.getElementById('editUrl').value,
        source: document.getElementById('editSource').value,
        region: document.getElementById('editRegion').value,
        topic: document.getElementById('editTopic').value,
        sentiment: document.getElementById('editSentiment').value
    };
    
    // Save edits
    editedHeadlines.set(currentEditId, edits);
    
    // Enable save button
    document.getElementById('saveChanges').disabled = false;
    
    // Close modal
    closeEditModal();
    
    // Re-render
    applyFilters();
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredHeadlines.length / itemsPerPage);
    
    document.getElementById('pageInfo').textContent = 
        `Page ${currentPage} of ${totalPages}`;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// Save all changes
async function saveAllChanges() {
    if (editedHeadlines.size === 0) return;
    
    // Create updated data
    const updatedHeadlines = allHeadlines.map(headline => {
        if (editedHeadlines.has(headline.id)) {
            const edits = editedHeadlines.get(headline.id);
            if (edits.deleted) {
                return null; // Mark for deletion
            }
            return { ...headline, ...edits };
        }
        return headline;
    }).filter(h => h !== null); // Remove deleted items
    
    // Create download
    const dataStr = JSON.stringify({
        generated_at: new Date().toISOString(),
        headlines: updatedHeadlines,
        edits: Array.from(editedHeadlines.entries())
    }, null, 2);
    
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `headlines_edited_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    // Reset edits
    editedHeadlines.clear();
    document.getElementById('saveChanges').disabled = true;
    
    alert('Changes saved! Download started.');
}

// Export data
function exportData() {
    const dataStr = JSON.stringify({
        generated_at: new Date().toISOString(),
        headlines: filteredHeadlines
    }, null, 2);
    
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `headlines_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadHeadlines();
    
    // Filter listeners
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('filterSource').addEventListener('change', applyFilters);
    document.getElementById('filterTopic').addEventListener('change', applyFilters);
    document.getElementById('filterSentiment').addEventListener('change', applyFilters);
    document.getElementById('filterRegion').addEventListener('change', applyFilters);
    
    // Sort listeners
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const newSortBy = th.dataset.sort;
            if (sortBy === newSortBy) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortBy = newSortBy;
                sortDirection = 'desc';
            }
            applyFilters();
        });
    });
    
    // Pagination listeners
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredHeadlines.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
    
    // Save and export listeners
    document.getElementById('saveChanges').addEventListener('click', saveAllChanges);
    document.getElementById('exportData').addEventListener('click', exportData);
});
