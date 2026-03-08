// PDF.js setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application state
const state = {
    pdfText: '',
    pdfLines: [],
    transactions: [],
    categories: [],
    filteredTransactions: []
};

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
        const { text, lines } = await extractTextFromPDF(file);
        state.pdfText = text;
        state.pdfLines = lines;
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('categoriesSection').classList.remove('hidden');
    } catch (error) {
        console.error('Error while processing PDF:', error);
        alert('Error al leer el archivo PDF. Verifica el formato del archivo.');
        document.getElementById('loader').classList.add('hidden');
    }
}

function extractLinesFromTextContent(textContent) {
    const yTolerance = 2;
    const items = textContent.items
        .filter(item => item.str && item.str.trim())
        .map(item => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5]
        }))
        .sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) > yTolerance) {
                return yDiff;
            }
            return a.x - b.x;
        });

    const lines = [];
    let currentLine = [];
    let currentY = null;

    for (const item of items) {
        if (currentY === null || Math.abs(item.y - currentY) <= yTolerance) {
            currentLine.push(item);
            currentY = currentY === null ? item.y : currentY;
            continue;
        }

        lines.push(currentLine.map(part => part.str).join(' ').replace(/\s+/g, ' ').trim());
        currentLine = [item];
        currentY = item.y;
    }

    if (currentLine.length) {
        lines.push(currentLine.map(part => part.str).join(' ').replace(/\s+/g, ' ').trim());
    }

    return lines.filter(Boolean);
}

// Extract text from PDF
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const allLines = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageLines = extractLinesFromTextContent(textContent);
        allLines.push(...pageLines);
    }
    
    return {
        text: allLines.join('\n'),
        lines: allLines
    };
}

// Parse transactions from text
function parseTransactions(text) {
    const transactions = [];
    const lines = text.split('\n');
    
    // Try to find transaction patterns
    // Example formats:
    // DD.MM.YYYY Description -1234.56
    // DD/MM/YYYY Description 1234,56 UAH
    
    const patterns = [
        // Format: 01.02.2024 Description -123.45
        /(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})\s+(.+?)\s+([\-\+]?\d+[\.,]\d{2})/g,
        // Format with currency: 01.02.2024 Description 123,45 UAH
        /(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})\s+(.+?)\s+([\-\+]?\d+[\.,]\d{2})\s*(?:UAH|₴|грн)?/g,
    ];
    
    // Try both patterns
    for (const pattern of patterns) {
        let match;
        const tempTransactions = [];
        
        while ((match = pattern.exec(text)) !== null) {
            const date = match[1];
            let description = match[2].trim();
            let amount = parseFloat(match[3].replace(',', '.').replace(/\s/g, ''));
            
            // Filter too-short descriptions or zero amounts
            if (description.length > 3 && Math.abs(amount) > 0) {
                // Keep only negative amounts (expenses)
                if (amount < 0) {
                    amount = Math.abs(amount);
                    tempTransactions.push({
                        date,
                        description,
                        amount,
                        category: 'Sin categoría'
                    });
                }
            }
        }
        
        if (tempTransactions.length > 0) {
            transactions.push(...tempTransactions);
        }
    }
    
    // If no transactions were found automatically, try an alternative approach
    if (transactions.length === 0) {
        // Look for lines with dates and amounts
        for (const line of lines) {
            const dateMatch = line.match(/\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4}/);
            const amountMatch = line.match(/([\-\+]?\d+[\.,]\d{2})/g);
            
            if (dateMatch && amountMatch) {
                const date = dateMatch[0];
                const amount = Math.abs(parseFloat(amountMatch[amountMatch.length - 1].replace(',', '.')));
                
                // Extract description (everything between date and amount)
                let description = line
                    .replace(date, '')
                    .replace(amountMatch[amountMatch.length - 1], '')
                    .trim();
                
                // Clean description from extra characters
                description = description.replace(/\s+/g, ' ').slice(0, 100);
                
                if (description.length > 3 && amount > 0) {
                    transactions.push({
                        date,
                        description,
                        amount,
                        category: 'Sin categoría'
                    });
                }
            }
        }
    }
    
    return transactions;
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
    if (!state.pdfText) {
        alert('Primero sube un archivo PDF');
        return;
    }
    
    // Parse transactions
    let transactions = parseTransactions(state.pdfText);
    
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

// Render summary
function renderSummary() {
    const total = state.transactions.length;
    const totalAmount = state.transactions.reduce((sum, t) => sum + t.amount, 0);
    const categories = new Set(state.transactions.map(t => t.category)).size;
    
    document.getElementById('totalTransactions').textContent = total;
    document.getElementById('totalAmount').textContent = totalAmount.toFixed(2) + ' ₴';
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
                            return `${label}: ${value.toFixed(2)} ₴ (${percentage}%)`;
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
    
    // Sort by amount descending
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total);
    
    const html = sorted.map(([category, data]) => {
        const percentage = ((data.total / totalAmount) * 100).toFixed(1);
        return `
            <div class="category-detail">
                <div class="category-detail-header">
                    <span class="category-name">${category}</span>
                    <span class="category-amount">${data.total.toFixed(2)} ₴</span>
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
            <td class="transaction-amount">-${t.amount.toFixed(2)} ₴</td>
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
    const headers = ['Fecha', 'Descripción', 'Importe', 'Categoría'];
    
    // Rows
    const rows = state.transactions.map(t => [
        t.date,
        `"${t.description}"`, // Wrap with quotes in case of commas
        t.amount.toFixed(2),
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
