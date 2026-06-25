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
  const bbvaDateRegex = new RegExp(`^(\\d{2}-[a-zA-Z]{3}-\\d{4})\\s+(\\d{2}-[a-zA-Z]{3}-\\d{4})|^(\\d{2})\\s+(${monthsStr})`, 'i');
  
  // Monto al final de la línea: opcional signo negativo, $, números, comas, punto y dos decimales
  const amountRegex = /(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?:\s+CR)?(?:\s+\d+\.\d{2})?$/i;

  let currentYear = new Date().getFullYear();

  lines.forEach((line, index) => {
    let date = null;
    let concept = '';
    let amount = 0;
    let matchType = null;
    let isPayment = false;

    // Checar formato Amex
    const amexMatch = line.match(amexDateRegex);
    if (amexMatch) {
      date = amexMatch[1]; 
      matchType = 'amex';
    } else {
      // Checar formato BBVA
      const bbvaMatch = line.match(bbvaDateRegex);
      if (bbvaMatch) {
        date = bbvaMatch[1] || `${bbvaMatch[3]} ${bbvaMatch[4]}`; // 08-dic-2025 o 15 ENE
        matchType = 'bbva';
      }
    }

    if (matchType) {
      // Buscar el monto
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
          cleanLine = cleanLine.replace(bbvaDateRegex, '').trim();
          if (amMatch[1].startsWith('-') || line.includes('SU PAGO')) {
             isPayment = true;
          }
        }
        
        cleanLine = cleanLine.replace(amountRegex, '').trim();
        
        // Quitar posibles basuras como "+" o "-" extra
        concept = cleanLine.replace(/^[+-]\s*/, '').trim();

        // Si es pago y queremos ignorarlo (normalmente no organizamos los pagos, sino los gastos)
        // Por ahora lo dejaremos para que el usuario pueda verlos o ignorarlos. 
        // Solo descartaremos si es un pago explicitamente negativo (abono en BBVA crédito).
        // Sin embargo, las compras a veces también tienen signo. Agreguemos todo por ahora y el usuario lo clasifica.

        if (concept && !isNaN(amount)) {
          // Ignorar lineas de total de "MESES SIN INTERESES" que son resumenes
          if (concept.toUpperCase().includes('TOTAL DE MESES SIN INTERESES')) return;

          transactions.push({
            id: `tx-${Date.now()}-${index}`,
            date,
            concept,
            amount: Math.abs(amount), // Guardamos absoluto por ahora
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
