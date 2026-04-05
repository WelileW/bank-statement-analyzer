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
    filteredTransactions: [],
    selectedCategory: ''
};

const {
    extractTextFromPDF: extractPdfText,
    parseTransactions: parseStatementTransactions
} = window.StatementParser;

const CATEGORIES_COOKIE_NAME = 'statement_categories';
const CATEGORIES_COOKIE_DAYS = 365;
const CATEGORIES_LOCAL_STORAGE_KEY = 'categories';

// Default categories
const defaultCategories = [
    {
        name: 'Alimentos',
        keywords: ['automercado', 'masxmenos', 'walmart', 'pali', 'maxi pali', 'pricesmart', 'fresh market', 'megasuper', 'am pm', 'super', 'mercado'],
        color: '#16a34a'
    },
    {
        name: 'Restaurantes/Cafeterías',
        keywords: ['mcdonald', 'kfc', 'burger king', 'subway', 'pizza', 'taco bell', 'starbucks', 'restaurante', 'cafeteria', 'soda', 'ubereats', 'rappi', 'PAPA JOHN', 'CAFE', 'pops'],
        color: '#f97316'
    },
    {
        name: 'Transporte',
        keywords: ['uber', 'didi', 'inDriver', 'gasolina', 'gasolinera', 'delta', 'puma', 'uno', 'texaco', 'peaje', 'parking', 'parqueo', 'RUTA'],
        color: '#2563eb'
    },
    {
        name: 'Farmacia/Salud',
        keywords: ['farmavalue', 'fischel', 'la bomba', 'sucre', 'farmacia', 'hospital', 'clinica', 'laboratorio', 'medico', 'dra'],
        color: '#dc2626'
    },
    {
        name: 'Ropa/Calzado',
        keywords: ['h&m', 'zara', 'mango', 'siman', 'ekono', 'pequeno mundo', 'universal', 'tienda', 'ropa', 'calzado'],
        color: '#7c3aed'
    },
    {
        name: 'Gastos fijos',
        keywords: ['netflix', 'spotify', 'google', 'apple', 'amazon', 'steam', 'playstation', 'disney', 'youtube', 'icloud', 'CCSS',
             'ice', 'kolbi', 'cnfl', 'aya', 'acueductos', 'electricidad', 'agua', 'internet', 'telefonia', 'claro', 'liberty', 'tigo',
             'SMARTFIT'],
        color: '#0891b2'
    },
    {
        name: 'Transferencias/SINPE',
        keywords: ['sinpe', 'sinpe movil', 'transferencia', 'transfer', 'deposito', 'SALDO', 'TEF A', 'TEF B', 'intereses'],
        color: '#0d9488'
    },
    {
        name: 'Mascotas',
        keywords: ['pet', 'mascota', 'vet', 'perro', 'gato', 'animal'],
        color: '#ca8a04'
    },
    {
        name: 'Educación',
        keywords: ['educacion', 'education', 'curso', 'cursos', 'academy', 'universidad', 'udemy', 'coursera', 'platzi', 'domestika', 'LIBRERIA'],
        color: '#4f46e5'
    },
    {
        name: 'Descanso',
        keywords: ['descanso', 'ocio', 'recreacion', 'parque'],
        color: '#65a30d'
    },
    {
        name: 'Compras en línea',
        keywords: ['online shopping', 'compra online', 'ecommerce', 'amazon', 'aliexpress', 'ebay', 'mercadolibre', 'shopify', 'temu', 'shein'],
        color: '#db2777'
    }
];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initCategories();
    setupEventListeners();
});

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const prefix = `${name}=`;
    const parts = document.cookie.split(';');

    for (const rawPart of parts) {
        const part = rawPart.trim();
        if (part.startsWith(prefix)) {
            return decodeURIComponent(part.substring(prefix.length));
        }
    }

    return null;
}

function setLocalStorageValue(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn('Could not write to localStorage:', error);
        return false;
    }
}

function getLocalStorageValue(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.warn('Could not read localStorage:', error);
        return null;
    }
}

// Load categories from cookies or use defaults
function initCategories() {
    let savedCategories = null;
    let saveCookieAfterLoad = false;

    const cookieValue = getCookie(CATEGORIES_COOKIE_NAME);
    if (cookieValue) {
        try {
            savedCategories = JSON.parse(cookieValue);
        } catch (error) {
            console.warn('Could not parse categories cookie:', error);
        }
    }

    if (!savedCategories) {
        const legacyLocalStorageValue = getLocalStorageValue(CATEGORIES_LOCAL_STORAGE_KEY);
        if (legacyLocalStorageValue) {
            try {
                savedCategories = JSON.parse(legacyLocalStorageValue);
                saveCookieAfterLoad = true;
            } catch (error) {
                console.warn('Could not parse legacy localStorage categories:', error);
            }
        }
    }

    state.categories = Array.isArray(savedCategories) ? savedCategories : defaultCategories;

    if (saveCookieAfterLoad) {
        setCookie(CATEGORIES_COOKIE_NAME, JSON.stringify(state.categories), CATEGORIES_COOKIE_DAYS);
    }

    setLocalStorageValue(CATEGORIES_LOCAL_STORAGE_KEY, JSON.stringify(state.categories));
    renderCategories();
}

// Save categories
function saveCategories() {
    setCookie(CATEGORIES_COOKIE_NAME, JSON.stringify(state.categories), CATEGORIES_COOKIE_DAYS);
    setLocalStorageValue(CATEGORIES_LOCAL_STORAGE_KEY, JSON.stringify(state.categories));
}

// Render categories
function renderCategories() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = state.categories.map((cat, index) => `
        <div class="category-item" style="border-color: ${cat.color}33; border-left: 6px solid ${cat.color};">
            <button class="delete-category" onclick="deleteCategory(${index})">×</button>
            <h4 style="color: ${cat.color};">${cat.name}</h4>
            <div class="category-keywords">
                ${cat.keywords.map(kw => `<span style="background: ${cat.color}22; color: ${cat.color};">${kw}</span>`).join('')}
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

    const existingCategory = state.categories.find(
        category => category.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
        const keywordSet = new Set(existingCategory.keywords.map(keyword => keyword.toLowerCase()));
        const newKeywords = keywords.filter(keyword => !keywordSet.has(keyword.toLowerCase()));

        if (newKeywords.length === 0) {
            alert('Estas palabras clave ya existen en la categoría');
            return;
        }

        existingCategory.keywords.push(...newKeywords);
        saveCategories();
        renderCategories();

        nameInput.value = '';
        keywordsInput.value = '';
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
    const colors = ['#16a34a', '#f97316', '#2563eb', '#dc2626', '#7c3aed', '#0891b2', '#0d9488', '#ca8a04', '#4f46e5', '#65a30d', '#db2777'];
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
    
}

// Handle file selection
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('fileName').textContent = `Archivo seleccionado: ${file.name}`;
    document.getElementById('loader').classList.remove('hidden');
    
    try {
        const { text, lines, linesWithX, pages } = await extractPdfText(file);
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
    let transactions = parseStatementTransactions(state.pdfText, state.pdfPages);
    
    if (transactions.length === 0) {
        alert('No se pudieron encontrar transacciones en el extracto. Es posible que el formato PDF no sea compatible. Prueba con otro archivo.');
        return;
    }
    
    // Categorize
    transactions = categorizeTransactions(transactions);
    state.transactions = transactions;
    state.filteredTransactions = transactions;
    state.selectedCategory = '';
    
    // Show results
    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('categoriesSection').classList.add('hidden');
    
    // Render
    renderChart();
    renderCategoryDetails();
    renderTransactionsTable();
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
    const excludedFromPie = 'transferencias/sinpe';
    
    state.transactions.forEach(t => {
        if ((t.category || '').toLowerCase() === excludedFromPie) {
            return;
        }
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
    const selectedCategory = state.selectedCategory;
    
    // Sort by amount descending
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total);
    
    const html = sorted.map(([category, data]) => {
        const percentage = ((data.total / totalAmount) * 100).toFixed(1);
        const isActive = selectedCategory === category;

        return `
            <div class="category-detail ${isActive ? 'active' : ''}" onclick="showCategoryTransactions('${encodeURIComponent(category)}')">
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

function showCategoryTransactions(encodedCategoryName) {
    const categoryName = decodeURIComponent(encodedCategoryName);
    state.selectedCategory = categoryName;

    filterTransactions();
}

// Render transactions table
function renderTransactionsTable() {
    const tbody = document.getElementById('transactionsBody');
    const title = document.getElementById('transactionsTitle');

    if (title) {
        title.textContent = state.selectedCategory || 'Todas las transacciones';
    }
    
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

// Filter transactions
function filterTransactions() {
    const categoryFilter = state.selectedCategory;
    
    state.filteredTransactions = state.transactions.filter(t => {
        const matchesCategory = !categoryFilter || t.category === categoryFilter;
        
        return matchesCategory;
    });
    
    renderTransactionsTable();
    renderCategoryDetails();
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
