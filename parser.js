const PARSER_CONSTANTS = {
    yTolerance: 2,
    creditXThreshold: 560,
    startMarker: 'NO. REFERENCIA FECHA CONCEPTO DEBITOS CREDITOS',
    endMarker: 'ULTIMA LINEA'
};

function normalizeForMatch(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function parseAmountValue(raw) {
    if (!raw) {
        return null;
    }

    let clean = raw
        .replace(/\u00A0/g, '')
        .replace(/\s+/g, '')
        .replace(/[₡₴$€£]/g, '')
        .replace(/CR|CRC|COLONES|USD|DOLLAR/gi, '')
        .replace(/[()]/g, '')
        .replace(/-/g, '');

    if (!/[\d]/.test(clean)) {
        return null;
    }

    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (lastComma > -1) {
        clean = clean.replace(',', '.');
    }

    if (clean.startsWith('.')) {
        clean = `0${clean}`;
    }

    if (!/^\d+(?:\.\d+)?$/.test(clean)) {
        return null;
    }

    const parsed = parseFloat(clean);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
}

function extractAmountsFromLineWithX(lineWithX) {
    const amounts = [];
    const tokenRegex = /\[x=(\d+)\](?:\[r=(\d+)\])?\s*([^\[]+)/g;
    let match;

    while ((match = tokenRegex.exec(lineWithX)) !== null) {
        const x = parseInt(match[1], 10);
        const rightX = match[2] ? parseInt(match[2], 10) : x;
        const token = match[3].trim();
        const value = parseAmountValue(token);

        if (value !== null) {
            amounts.push({ x, rightX, value, raw: token });
        }
    }

    return amounts.sort((a, b) => a.rightX - b.rightX);
}

function extractReferenceAndDate(line) {
    const startMatch = line.match(/^\s*(\d{6,})\s+([A-Z]{3}\/\d{2}|\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})\b/i);
    if (startMatch) {
        return {
            reference: startMatch[1],
            date: startMatch[2],
            matchedPrefix: startMatch[0]
        };
    }

    const dateMatch = line.match(/\b([A-Z]{3}\/\d{2}|\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})\b/i);
    if (dateMatch) {
        return {
            reference: '',
            date: dateMatch[1],
            matchedPrefix: dateMatch[0]
        };
    }

    return null;
}

function detectCurrency(pageText, previousCurrency) {
    const upper = normalizeForMatch(pageText);
    if (upper.includes('U.S. DOLLAR') || upper.includes('US DOLLAR')) {
        return 'U.S. DOLLAR';
    }
    if (upper.includes('COLONES')) {
        return 'COLONES';
    }
    return previousCurrency;
}

function cleanDescription(row, debitRaw, creditRaw) {
    let description = row.line
        .replace(row.matchedPrefix, '')
        .replace(debitRaw, '')
        .replace(creditRaw, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

    if (!description || description.length < 3) {
        description = 'Sin descripción';
    }

    return description;
}

function isUnsupportedTransactionDescription(description) {
    return false;
}

function mapRowsToTransactions(rows, currentCurrency) {
    const transactions = [];

    for (const row of rows) {
        const debitCandidates = row.amounts.filter(amount => amount.rightX <= PARSER_CONSTANTS.creditXThreshold);
        const creditCandidates = row.amounts.filter(amount => amount.rightX > PARSER_CONSTANTS.creditXThreshold);

        const debitEntry = debitCandidates.length > 0 ? debitCandidates[debitCandidates.length - 1] : null;
        const creditEntry = creditCandidates.length > 0 ? creditCandidates[creditCandidates.length - 1] : null;

        if (!debitEntry && !creditEntry) {
            continue;
        }

        let signedAmount = 0;
        let movementType = '';

        if (creditEntry && !debitEntry) {
            signedAmount = creditEntry.value;
            movementType = 'credit';
        } else if (debitEntry && !creditEntry) {
            signedAmount = -debitEntry.value;
            movementType = 'debit';
        } else if (creditEntry && debitEntry) {
            if (creditEntry.rightX >= debitEntry.rightX) {
                signedAmount = creditEntry.value;
                movementType = 'credit';
            } else {
                signedAmount = -debitEntry.value;
                movementType = 'debit';
            }
        }

        if (!Number.isFinite(signedAmount) || signedAmount === 0) {
            continue;
        }

        const debitRaw = debitEntry ? debitEntry.raw : '';
        const creditRaw = creditEntry ? creditEntry.raw : '';

        const description = cleanDescription(row, debitRaw, creditRaw);

        if (isUnsupportedTransactionDescription(description)) {
            continue;
        }

        transactions.push({
            date: row.date,
            reference: row.reference,
            description,
            amount: signedAmount,
            movementType,
            currency: currentCurrency || 'N/A',
            category: 'Sin categoría'
        });
    }

    return transactions;
}

function extractRowsFromPage(page) {
    const normalizedLines = page.lines.map(normalizeForMatch);
    const startIndex = normalizedLines.findIndex(line => line.includes(PARSER_CONSTANTS.startMarker));
    if (startIndex === -1) {
        return [];
    }

    let endIndex = normalizedLines.findIndex((line, index) => index > startIndex && line.startsWith(PARSER_CONSTANTS.endMarker));
    if (endIndex === -1) {
        endIndex = page.lines.length;
    }

    const rows = [];

    for (let i = startIndex + 1; i < endIndex; i++) {
        const line = page.lines[i];
        const lineWithX = page.linesWithX[i] || '';
        const txHeader = extractReferenceAndDate(line);

        if (!txHeader) {
            continue;
        }

        const amounts = extractAmountsFromLineWithX(lineWithX);
        if (amounts.length === 0) {
            continue;
        }

        rows.push({
            line,
            date: txHeader.date,
            reference: txHeader.reference,
            matchedPrefix: txHeader.matchedPrefix,
            amounts
        });
    }

    return rows;
}

function parseTransactionsFromPages(pages) {
    const transactions = [];
    let currentCurrency = '';

    for (const page of pages) {
        const normalizedPageText = normalizeForMatch(page.text);
        if (normalizedPageText.includes('RESUMEN DE PRODUCTOS')) {
            continue;
        }

        currentCurrency = detectCurrency(page.text, currentCurrency);
        const pageRows = extractRowsFromPage(page);

        if (pageRows.length === 0) {
            continue;
        }

        transactions.push(...mapRowsToTransactions(pageRows, currentCurrency));
    }

    return transactions;
}

function parseTransactionsFromText(text) {
    const transactions = [];
    const lines = text.split('\n');

    const patterns = [
        /(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})\s+(.+?)\s+([\-\+]?\d+[\.,]\d{2})/g,
        /(\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4})\s+(.+?)\s+([\-\+]?\d+[\.,]\d{2})\s*(?:UAH|₴|грн)?/g,
    ];

    for (const pattern of patterns) {
        let match;
        const tempTransactions = [];

        while ((match = pattern.exec(text)) !== null) {
            const date = match[1];
            const description = match[2].trim();
            let amount = parseFloat(match[3].replace(',', '.').replace(/\s/g, ''));

            if (isUnsupportedTransactionDescription(description)) {
                continue;
            }

            if (description.length > 3 && Math.abs(amount) > 0 && amount < 0) {
                amount = Math.abs(amount);
                tempTransactions.push({
                    date,
                    description,
                    amount,
                    currency: 'N/A',
                    category: 'Sin categoría'
                });
            }
        }

        if (tempTransactions.length > 0) {
            transactions.push(...tempTransactions);
        }
    }

    if (transactions.length > 0) {
        return transactions;
    }

    for (const line of lines) {
        const dateMatch = line.match(/\d{2}[\.\-\/]\d{2}[\.\-\/]\d{4}/);
        const amountMatch = line.match(/([\-\+]?\d+[\.,]\d{2})/g);

        if (!dateMatch || !amountMatch) {
            continue;
        }

        const date = dateMatch[0];
        const amount = Math.abs(parseFloat(amountMatch[amountMatch.length - 1].replace(',', '.')));

        let description = line
            .replace(date, '')
            .replace(amountMatch[amountMatch.length - 1], '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 100);

        if (isUnsupportedTransactionDescription(description)) {
            continue;
        }

        if (description.length <= 3 || amount <= 0) {
            continue;
        }

        transactions.push({
            date,
            description,
            amount,
            currency: 'N/A',
            category: 'Sin categoría'
        });
    }

    return transactions;
}

function extractLinesFromTextContent(textContent) {
    const items = textContent.items
        .filter(item => item.str && item.str.trim())
        .map(item => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: Number.isFinite(item.width) ? item.width : 0,
            rightX: item.transform[4] + (Number.isFinite(item.width) ? item.width : 0)
        }))
        .sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) > PARSER_CONSTANTS.yTolerance) {
                return yDiff;
            }
            return a.x - b.x;
        });

    const lines = [];
    const linesWithX = [];
    let currentLine = [];
    let currentY = null;

    const pushLine = (lineItems) => {
        const cleanLine = lineItems.map(part => part.str).join(' ').replace(/\s+/g, ' ').trim();
        if (!cleanLine) return;

        const lineWithX = lineItems
            .map(part => `[x=${Math.round(part.x)}][r=${Math.round(part.rightX)}] ${part.str}`)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        lines.push(cleanLine);
        linesWithX.push(lineWithX);
    };

    for (const item of items) {
        if (currentY === null || Math.abs(item.y - currentY) <= PARSER_CONSTANTS.yTolerance) {
            currentLine.push(item);
            currentY = currentY === null ? item.y : currentY;
            continue;
        }

        pushLine(currentLine);
        currentLine = [item];
        currentY = item.y;
    }

    if (currentLine.length) {
        pushLine(currentLine);
    }

    return {
        lines,
        linesWithX
    };
}

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allLines = [];
    const allLinesWithX = [];
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const { lines, linesWithX } = extractLinesFromTextContent(textContent);

        allLines.push(...lines);
        allLinesWithX.push(...linesWithX);
        pages.push({
            pageNumber: i,
            lines,
            linesWithX,
            text: lines.join('\n')
        });
    }

    return {
        text: allLines.join('\n'),
        lines: allLines,
        linesWithX: allLinesWithX,
        pages
    };
}

function parseTransactions(text, pages = []) {
    if (pages.length > 0) {
        const pageBasedTransactions = parseTransactionsFromPages(pages);
        if (pageBasedTransactions.length > 0) {
            return pageBasedTransactions;
        }
    }

    return parseTransactionsFromText(text);
}

window.StatementParser = {
    extractTextFromPDF,
    parseTransactions
};
