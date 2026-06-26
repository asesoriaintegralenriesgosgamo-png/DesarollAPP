import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker para Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Lee un archivo PDF y extrae su texto agrupándolo por líneas (coordenada Y).
 */
export async function extractLinesFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Agrupar items por coordenada Y para reconstruir las líneas
    const lineMap = new Map();
    content.items.forEach(item => {
      // Redondear la coordenada Y para agrupar textos en la misma línea
      // El transform es [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const y = Math.round(item.transform[5]); 
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y).push(item);
    });

    // Ordenar las líneas de arriba hacia abajo (Y decreciente en PDFs)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    
    sortedY.forEach(y => {
      // Ordenar los items de izquierda a derecha en esa línea
      const lineItems = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      const lineText = lineItems.map(item => item.str.trim()).filter(Boolean).join(' ');
      if (lineText) {
        allLines.push(lineText);
      }
    });
  }

  return allLines;
}

/**
 * Intenta identificar gastos en un arreglo de líneas de texto extraídas.
 */
export function parseTransactions(lines) {
  const transactions = [];
  
  // Meses en español comúnmente usados
  const monthsStr = 'ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC';
  const amexMonthsStr = 'Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre';
  
  // Expresiones regulares comunes
  const amexDateRegex = new RegExp(`^(\\d{1,2}\\s+de\\s+(${amexMonthsStr})|\\d{2}/\\d{2}/\\d{2,4})`, 'i'); 
  const bbvaCreditRegex = new RegExp(`^(\\d{2}-[a-zA-Z]{3}-\\d{4})\\s+(\\d{2}-[a-zA-Z]{3}-\\d{4})|^(\\d{2})\\s+(${monthsStr})`, 'i');
  const bbvaDebitRegex = new RegExp(`^(\\d{2}/(?:${monthsStr}))\\s+(\\d{2}/(?:${monthsStr}))`, 'i');
  
  // Monto al final de la línea: opcional signo negativo, $, números, comas, punto y dos decimales
  const amountRegex = /(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?:\s+CR)?(?:\s+\d+\.\d{2})?$/i;
  const bbvaDebitAmountsRegex = /(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s+(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s+(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))$/i;

  let currentYear = new Date().getFullYear();
  let lastSaldo = null;

  lines.forEach((line, index) => {
    let date = null;
    let concept = '';
    let amount = 0;
    let matchType = null;
    let isPayment = false;

    // Capturar Saldo Anterior para BBVA débito
    const saldoAnteriorMatch = line.match(/Saldo Anterior\s+([\d,]+\.\d{2})/i);
    if (saldoAnteriorMatch) {
      lastSaldo = parseFloat(saldoAnteriorMatch[1].replace(/,/g, ''));
    }

    // Checar formato Amex
    const amexMatch = line.match(amexDateRegex);
    if (amexMatch) {
      date = amexMatch[1]; 
      matchType = 'amex';
    } else {
      // Checar formato BBVA Débito
      const bbvaDebitMatch = line.match(bbvaDebitRegex);
      if (bbvaDebitMatch) {
        date = bbvaDebitMatch[1]; // ej: 25/DIC
        matchType = 'bbva-debit';
      } else {
        // Checar formato BBVA Crédito
        const bbvaCreditMatch = line.match(bbvaCreditRegex);
        if (bbvaCreditMatch) {
          date = bbvaCreditMatch[1] || `${bbvaCreditMatch[3]} ${bbvaCreditMatch[4]}`; 
          matchType = 'bbva';
        }
      }
    }

    if (matchType === 'bbva-debit') {
      const amountsMatch = line.match(bbvaDebitAmountsRegex);
      if (amountsMatch) {
        const amt = parseFloat(amountsMatch[1].replace(/[$,]/g, ''));
        const saldoOp = parseFloat(amountsMatch[2].replace(/[$,]/g, ''));
        amount = amt;
        
        // Deducir si es cargo o abono por el saldo
        if (lastSaldo !== null) {
          if (saldoOp > lastSaldo) {
            isPayment = true; // Abono
          }
        } else {
          // Fallback guess
          if (line.toUpperCase().includes('RECIBIDO') || line.toUpperCase().includes('DEPOSITO') || line.toUpperCase().includes('ABONO')) {
            isPayment = true;
          }
        }
        lastSaldo = saldoOp; // update para el siguiente

        let cleanLine = line.replace(bbvaDebitRegex, '').trim();
        cleanLine = cleanLine.replace(bbvaDebitAmountsRegex, '').trim();
        concept = cleanLine.replace(/^[+-]\s*/, '').trim();

        if (concept && !isNaN(amount)) {
          transactions.push({
            id: `tx-${Date.now()}-${index}`,
            date,
            concept,
            amount: Math.abs(amount),
            type: isPayment ? 'abono' : 'cargo',
            originalLine: line,
            bucket: null 
          });
        }
      }
    } else if (matchType) {
      // Buscar el monto para amex o bbva crédito
      const amMatch = line.match(amountRegex);
      if (amMatch) {
        // Extraer el número real
        const cleanAmountStr = amMatch[1].replace(/[$,]/g, '');
        amount = parseFloat(cleanAmountStr);
        
        // El concepto es lo que está entre la fecha y el monto
        let cleanLine = line;
        
        if (matchType === 'amex') {
          cleanLine = cleanLine.replace(amexDateRegex, '').trim();
          if (line.includes('CR') || line.includes('GRACIAS POR SU PAGO') || line.includes('SU PAGO')) {
            isPayment = true;
          }
        } else {
          cleanLine = cleanLine.replace(bbvaCreditRegex, '').trim();
          if (amMatch[1].startsWith('-') || line.includes('SU PAGO')) {
             isPayment = true;
          }
        }
        
        cleanLine = cleanLine.replace(amountRegex, '').trim();
        concept = cleanLine.replace(/^[+-]\s*/, '').trim();

        if (concept && !isNaN(amount)) {
          if (concept.toUpperCase().includes('TOTAL DE MESES SIN INTERESES')) return;

          transactions.push({
            id: `tx-${Date.now()}-${index}`,
            date,
            concept,
            amount: Math.abs(amount),
            type: isPayment ? 'abono' : 'cargo',
            originalLine: line,
            bucket: null 
          });
        }
      }
    }
  });

  return transactions;
}
