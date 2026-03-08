// PDF.js setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application state
const state = {
    pdfText: '',
    pdfLines: [],
    pdfLinesWithX: [],
    pdfPages: [],
    transactions: [],
    categories: [],
    filteredTransactions: []
};

const { extractTextFromPDF, parseTransactions } = window.StatementParser;

// Default categories
const defaultCategories = [
    {
        name: 'Alimentos',
        keywords: ['атб', 'сільпо', 'ашан', 'novus', 'эко маркет', 'fozzy', 'varus', 'megamarket', 'маркет'],
        color: '#10b981'
    },
    {
        name: 'Restaurantes/Cafeterías',
        keywords: ['макдональдс', 'kfc', 'pizza', 'пицца', 'кафе', 'ресторан', 'їжа', 'бургер'],
        color: '#f59e0b'
    },
    {
        name: 'Transporte',
        keywords: ['bolt', 'uber', 'uklon', 'паркування', 'азс', 'бензин', 'wog', 'okko', 'metro'],
        color: '#3b82f6'
    },
    {
        name: 'Servicios públicos',
        keywords: ['київенерго', 'водоканал', 'теплоенерго', 'gas', 'utility', 'комунальн'],
        color: '#ef4444'
    },
    {
        name: 'Farmacia/Salud',
        keywords: ['аптека', 'pharmacy', 'medical', 'clinic', 'лікарня', 'hospital'],
        color: '#ec4899'
    },
    {
        name: 'Ropa/Calzado',
        keywords: ['h&m', 'zara', 'mango', 'reserved', 'fashion', 'одяг', 'взуття'],
        color: '#8b5cf6'
    },
    {
        name: 'Servicios en línea',
        keywords: ['netflix', 'spotify', 'google', 'apple', 'amazon', 'steam', 'playstation'],
        color: '#06b6d4'
    }
];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initCategories();
    setupEventListeners();
});

// Load categories from localStorage or use defaults
function initCategories() {
    const savedCategories = localStorage.getItem('categories');
    state.categories = savedCategories ? JSON.parse(savedCategories) : defaultCategories;
    renderCategories();
}

// Save categories
function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(state.categories));
}

// Render categories
function renderCategories() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = state.categories.map((cat, index) => `
        <div class="category-item">
            <button class="delete-category" onclick="deleteCategory(${index})">×</button>
            <h4>${cat.name}</h4>
            <div class="category-keywords">
                ${cat.keywords.map(kw => `<span>${kw}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

// Delete category
function deleteCategory(index) {
    state.categories.splice(index, 1);
    saveCategories();
    renderCategories();
}

// Add new category
function addCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const keywordsInput = document.getElementById('newCategoryKeywords');
    
    const name = nameInput.value.trim();
    const keywords = keywordsInput.value.trim().toLowerCase().split(',').map(k => k.trim()).filter(k => k);
    
    if (!name || keywords.length === 0) {
        alert('Completa el nombre de la categoría y las palabras clave');
        return;
    }
    
    state.categories.push({
        name,
        keywords,
        color: getRandomColor()
    });
    
    saveCategories();
    renderCategories();
    
    nameInput.value = '';
    keywordsInput.value = '';
}

// Generate random color
function getRandomColor() {
    const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Setup event listeners
function setupEventListeners() {
    const fileInput = document.getElementById('pdfFile');
    const uploadBox = document.querySelector('.upload-box');
    
    // File upload
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '#764ba2';
        uploadBox.style.background = '#f8f9ff';
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.borderColor = '#667eea';
        uploadBox.style.background = '';
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '#667eea';
        uploadBox.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            fileInput.files = files;
            handleFileSelect({ target: fileInput });
        }
    });
    
    // Buttons
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeTransactions);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Search and filters
    document.getElementById('searchTransactions').addEventListener('input', filterTransactions);
    document.getElementById('filterCategory').addEventListener('change', filterTransactions);
}

// Handle file selection
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('fileName').textContent = `Archivo seleccionado: ${file.name}`;
    document.getElementById('loader').classList.remove('hidden');
    
    try {
        const { text, lines, linesWithX, pages } = await extractTextFromPDF(file);
        state.pdfText = text;
        state.pdfLines = lines;
        state.pdfLinesWithX = linesWithX;
        state.pdfPages = pages;
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('categoriesSection').classList.remove('hidden');
    } catch (error) {
        console.error('Error while processing PDF:', error);
        alert('Error al leer el archivo PDF. Verifica el formato del archivo.');
        document.getElementById('loader').classList.add('hidden');
    }
}

// Categorize transactions
function categorizeTransactions(transactions) {
    return transactions.map(transaction => {
        const descLower = transaction.description.toLowerCase();
        
        for (const category of state.categories) {
            for (const keyword of category.keywords) {
                if (descLower.includes(keyword.toLowerCase())) {
                    return { ...transaction, category: category.name };
                }
            }
        }
        
        return transaction;
    });
}

// Analyze transactions
function analyzeTransactions() {
    console.log(state.pdfText);
    console.log('PDF lines with X coordinates:', state.pdfLinesWithX);
    console.log('PDF pages:', state.pdfPages);
    if (!state.pdfText) {
        alert('Primero sube un archivo PDF');
        return;
    }
    
    // Parse transactions
    let transactions = parseTransactions(state.pdfText, state.pdfPages);
    
    if (transactions.length === 0) {
        alert('No se pudieron encontrar transacciones en el extracto. Es posible que el formato PDF no sea compatible. Prueba con otro archivo.');
        return;
    }
    
    // Categorize
    transactions = categorizeTransactions(transactions);
    state.transactions = transactions;
    state.filteredTransactions = transactions;
    
    // Show results
    document.getElementById('resultsSection').classList.remove('hidden');
    
    // Render
    renderSummary();
    renderChart();
    renderCategoryDetails();
    renderTransactionsTable();
    populateCategoryFilter();
}

function getCurrencySymbol(currency) {
    const normalized = (currency || '').toUpperCase();
    if (normalized.includes('COLONES')) {
        return '₡';
    }
    if (normalized.includes('DOLLAR') || normalized.includes('USD')) {
        return '$';
    }
    if (normalized.includes('UAH') || normalized.includes('₴') || normalized.includes('GRN')) {
        return '₴';
    }
    return currency || '';
}

function getPrimaryCurrency(transactions) {
    const counts = {};
    for (const transaction of transactions) {
        const currency = transaction.currency || 'N/A';
        counts[currency] = (counts[currency] || 0) + 1;
    }

    let primary = 'N/A';
    let maxCount = 0;
    for (const [currency, count] of Object.entries(counts)) {
        if (count > maxCount) {
            primary = currency;
            maxCount = count;
        }
    }

    return primary;
}

// Render summary
function renderSummary() {
    const total = state.transactions.length;
    const totalsByCurrency = {};
    state.transactions.forEach(t => {
        const currency = t.currency || 'N/A';
        totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + t.amount;
    });

    const totalAmountText = Object.entries(totalsByCurrency)
        .map(([currency, amount]) => `${amount.toFixed(2)} ${getCurrencySymbol(currency)}`)
        .join(' • ');

    const categories = new Set(state.transactions.map(t => t.category)).size;
    
    document.getElementById('totalTransactions').textContent = total;
    document.getElementById('totalAmount').textContent = totalAmountText;
    document.getElementById('totalCategories').textContent = categories;
}

// Render pie chart
function renderChart() {
    const categoryTotals = {};
    
    state.transactions.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const currencySymbol = getCurrencySymbol(getPrimaryCurrency(state.transactions));
    const colors = labels.map(label => {
        const cat = state.categories.find(c => c.name === label);
        return cat ? cat.color : '#999999';
    });
    
    const canvas = document.getElementById('pieChart');
    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart if it exists
    if (window.chartInstance) {
        window.chartInstance.destroy();
    }
    
    window.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(2)} ${currencySymbol} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Render category details
function renderCategoryDetails() {
    const categoryTotals = {};
    
    state.transactions.forEach(t => {
        if (!categoryTotals[t.category]) {
            categoryTotals[t.category] = { total: 0, count: 0 };
        }
        categoryTotals[t.category].total += t.amount;
        categoryTotals[t.category].count += 1;
    });
    
    const totalAmount = state.transactions.reduce((sum, t) => sum + t.amount, 0);
    const currencySymbol = getCurrencySymbol(getPrimaryCurrency(state.transactions));
    
    // Sort by amount descending
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total);
    
    const html = sorted.map(([category, data]) => {
        const percentage = ((data.total / totalAmount) * 100).toFixed(1);
        return `
            <div class="category-detail">
                <div class="category-detail-header">
                    <span class="category-name">${category}</span>
                    <span class="category-amount">${data.total.toFixed(2)} ${currencySymbol}</span>
                </div>
                <div class="category-percentage">${data.count} transacciones • ${percentage}%</div>
                <div class="category-bar">
                    <div class="category-bar-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('categoryDetails').innerHTML = html;
}

// Render transactions table
function renderTransactionsTable() {
    const tbody = document.getElementById('transactionsBody');
    
    const html = state.filteredTransactions.map(t => `
        <tr>
            <td class="transaction-date">${t.date}</td>
            <td>${t.description}</td>
            <td class="transaction-amount">-${t.amount.toFixed(2)} ${getCurrencySymbol(t.currency)}</td>
            <td>
                <span class="transaction-category ${t.category === 'Sin categoría' ? 'uncategorized' : ''}">
                    ${t.category}
                </span>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// Populate category filter
function populateCategoryFilter() {
    const select = document.getElementById('filterCategory');
    const categories = [...new Set(state.transactions.map(t => t.category))].sort();
    
    select.innerHTML = '<option value="">Todas las categorías</option>' + 
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

// Filter transactions
function filterTransactions() {
    const searchText = document.getElementById('searchTransactions').value.toLowerCase();
    const categoryFilter = document.getElementById('filterCategory').value;
    
    state.filteredTransactions = state.transactions.filter(t => {
        const matchesSearch = !searchText || 
            t.description.toLowerCase().includes(searchText) ||
            t.date.includes(searchText);
        
        const matchesCategory = !categoryFilter || t.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    renderTransactionsTable();
}

// Export to CSV
function exportToCSV() {
    if (state.transactions.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    // Headers
    const headers = ['Fecha', 'Descripción', 'Importe', 'Moneda', 'Categoría'];
    
    // Rows
    const rows = state.transactions.map(t => [
        t.date,
        `"${t.description}"`, // Wrap with quotes in case of commas
        t.amount.toFixed(2),
        t.currency || 'N/A',
        t.category
    ]);
    
    // Build CSV
    const csv = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
    
    // BOM for correct UTF-8 display in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    
    // Download file
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `estado_bancario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
