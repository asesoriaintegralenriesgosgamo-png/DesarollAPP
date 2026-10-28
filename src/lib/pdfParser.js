import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker para Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export const MONTHS_MAP = {
  ene: '01', enero: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03',
  abr: '04', abril: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06',
  jul: '07', julio: '07',
  ago: '08', agosto: '08',
  sep: '09', septiembre: '09', set: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12'
};

function resolveYearForMonth(monthNum, startMonth, startYear, endMonth, endYear) {
  if (startYear === endYear) return endYear;
  if (monthNum >= 10) return startYear;
  return endYear;
}

export function classifySubType(concept, type, bank, paymentMethod) {
  const upper = (concept || '').toUpperCase();
  if (
    upper.includes('APERTURA DE INVERSION') ||
    upper.includes('DEPOSITO DE INVERSION') ||
    upper.includes('LIQUIDACION DE INVERSION')
  ) {
    return 'inversion';
  }
  if (
    upper.includes('MONTO A DIFERIR MESES EN AUTOM') ||
    upper.includes('MESES EN AUTOMÁTICO') ||
    upper.includes('MESES EN AUTOMATICO')
  ) {
    return 'msi_ajuste';
  }
  if (
    upper.includes('GRACIAS POR SU PAGO') ||
    upper.includes('BMOVIL.PAGO TDC') ||
    upper.includes('PAGO TARJETA DE CREDITO') ||
    (bank === 'BBVA' && paymentMethod === 'debito' && upper.includes('AMERICAN EXPRESS'))
  ) {
    return 'pago_tdc';
  }
  if (type === 'abono') {
    if (paymentMethod === 'credito') return 'reembolso';
    return 'ingreso';
  }
  return 'gasto';
}

/**
 * Extrae líneas detalladas con coordenadas (página, X, Y, dimensiones de página) desde un File o ArrayBuffer.
 */
export async function extractDetailedLinesFromPDF(fileOrBuffer) {
  const arrayBuffer = fileOrBuffer instanceof ArrayBuffer
    ? fileOrBuffer
    : await fileOrBuffer.arrayBuffer();
  const data = new Uint8Array(arrayBuffer.slice(0));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();

    const lineMap = new Map();
    content.items.forEach(item => {
      const str = (item.str || '').trim();
      if (!str) return;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y).push({
        x,
        y,
        str,
        width: Math.round(item.width || 0),
        height: Math.round(item.height || 10)
      });
    });

    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    sortedY.forEach(y => {
      const items = lineMap.get(y).sort((a, b) => a.x - b.x);
      const text = items.map(it => it.str).join(' ');
      if (text) {
        lines.push({
          page: i,
          y,
          pageWidth: Math.round(viewport.width),
          pageHeight: Math.round(viewport.height),
          items,
          text
        });
      }
    });
  }

  return { numPages: pdf.numPages, lines };
}

/**
 * Analiza un estado de cuenta PDF completo (AMEX Crédito, BBVA Débito, BBVA Crédito)
 * devolviendo metadatos del estado de cuenta y todas las transacciones con coordenadas de página y Y.
 */
export async function parsePdfStatementFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { numPages, lines } = await extractDetailedLinesFromPDF(arrayBuffer);
  const fileName = file.name || `estado-cuenta-${Date.now()}.pdf`;

  const fullText = lines.map(l => l.text).join('\n');
  let bank = 'OTRO';
  let paymentMethod = 'credito';
  let accountName = 'Cuenta Bancaria';
  let accountNumber = '';
  let periodLabel = fileName.replace(/\.pdf$/i, '');
  let startYear = new Date().getFullYear();
  let endYear = startYear;
  let startMonth = 1;
  let endMonth = 1;
  let cutoffDate = '';

  if (fullText.includes('American Express') || fullText.includes('americanexpress.com.mx')) {
    bank = 'AMEX';
    paymentMethod = 'credito';
    accountName = 'Amex Gold Elite';
    const accMatch = fullText.match(/3401-\d+-\d+/);
    accountNumber = accMatch ? accMatch[0] : '3401-353128-41003';
    const perMatch = fullText.match(/Del\s+(\d{1,2})\s+de\s+([A-Za-z]+)(?:\s+de\s+(\d{4}))?\s+al\s+(\d{1,2})\s+de\s+([A-Za-z]+)\s+de\s+(\d{4})/i);
    if (perMatch) {
      const m1 = MONTHS_MAP[perMatch[2].toLowerCase()] || '01';
      const m2 = MONTHS_MAP[perMatch[5].toLowerCase()] || '01';
      endYear = parseInt(perMatch[6], 10);
      startYear = perMatch[3] ? parseInt(perMatch[3], 10) : (m1 === '12' && m2 === '01' ? endYear - 1 : endYear);
      startMonth = parseInt(m1, 10);
      endMonth = parseInt(m2, 10);
      periodLabel = `${perMatch[1]} ${perMatch[2].slice(0, 3)} ${startYear} - ${perMatch[4]} ${perMatch[5].slice(0, 3)} ${endYear}`;
      cutoffDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(perMatch[4]).padStart(2, '0')}`;
    }
  } else if (fullText.includes('Libretón Premium') || fullText.includes('No. de Cuenta 0465988152') || fullText.includes('OPER LIQ DESCRIPCIÓN')) {
    bank = 'BBVA';
    paymentMethod = 'debito';
    accountName = 'BBVA Libretón Premium';
    const accMatch = fullText.match(/No\.\s*de\s*Cuenta\s+(\d+)/i);
    accountNumber = accMatch ? accMatch[1] : '0465988152';
    const perMatch = fullText.match(/Periodo\s+DEL\s+(\d{2})\/(\d{2})\/(\d{4})\s+AL\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    if (perMatch) {
      startMonth = parseInt(perMatch[2], 10);
      startYear = parseInt(perMatch[3], 10);
      endMonth = parseInt(perMatch[5], 10);
      endYear = parseInt(perMatch[6], 10);
      periodLabel = `${perMatch[1]}/${perMatch[2]}/${perMatch[3]} - ${perMatch[4]}/${perMatch[5]}/${perMatch[6]}`;
      cutoffDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${perMatch[4]}`;
    }
  } else if (fullText.includes('TARJETA ORO BBVA') || fullText.includes('TARJETA DE CREDITO (BANCA DE CONSUMO)') || fullText.includes('CARGOS,COMPRAS Y ABONOS REGULARES')) {
    bank = 'BBVA';
    paymentMethod = 'credito';
    accountName = 'BBVA Tarjeta Oro';
    const cardMatch = fullText.match(/Número de tarjeta:\s*(\d+)/i);
    accountNumber = cardMatch ? cardMatch[1] : '4772133093926654';
    const perMatch = fullText.match(/Periodo:\s*(\d{2})-([a-z]{3})-(\d{4})\s+al\s+(\d{2})-([a-z]{3})-(\d{4})/i);
    if (perMatch) {
      startMonth = parseInt(MONTHS_MAP[perMatch[2].toLowerCase()] || '01', 10);
      startYear = parseInt(perMatch[3], 10);
      endMonth = parseInt(MONTHS_MAP[perMatch[5].toLowerCase()] || '01', 10);
      endYear = parseInt(perMatch[6], 10);
      periodLabel = `${perMatch[1]}-${perMatch[2]}-${perMatch[3]} al ${perMatch[4]}-${perMatch[5]}-${perMatch[6]}`;
      cutoffDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${perMatch[4]}`;
    }
  }

  const statementId = `stmt-${bank.toLowerCase()}-${paymentMethod}-${cutoffDate || fileName}`;
  const statementUrl = `/estados-de-cuenta/${encodeURIComponent(fileName)}`;

  const transactions = [];
  const monthsStr = 'ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC';
  const amexMonthsStr = 'Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre';

  if (bank === 'BBVA' && paymentMethod === 'debito') {
    const bbvaDebitRegex = new RegExp(`^(\\d{2})/(${monthsStr})\\s+(\\d{2})/(${monthsStr})\\s+(.+)$`, 'i');
    let inMovementsSection = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.text.includes('Detalle de Movimientos Realizados') || l.text.includes('OPER LIQ DESCRIPCIÓN')) {
        inMovementsSection = true;
      }
      if (l.text.includes('Total de Movimientos')) {
        inMovementsSection = false;
      }
      if (!inMovementsSection) continue;

      const m = l.text.match(bbvaDebitRegex);
      if (m) {
        const dayStr = m[1];
        const monAbbr = m[2].toUpperCase();
        const rawDate = `${dayStr}/${monAbbr}`;
        const monNum = parseInt(MONTHS_MAP[monAbbr.toLowerCase()] || '01', 10);
        const yr = resolveYearForMonth(monNum, startMonth, startYear, endMonth, endYear);
        const isoDate = `${yr}-${String(monNum).padStart(2, '0')}-${dayStr}`;

        const amountRegexSingle = /^-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})$/;
        let cargoAmt = null;
        let abonoAmt = null;
        const descParts = [];

        l.items.forEach(item => {
          if (amountRegexSingle.test(item.str) && item.x >= 340) {
            const val = parseFloat(item.str.replace(/[$,]/g, ''));
            if (item.x >= 340 && item.x < 412) {
              cargoAmt = val;
            } else if (item.x >= 412 && item.x < 470) {
              abonoAmt = val;
            }
          } else if (item.x >= 50 && item.x < 340) {
            descParts.push(item.str);
          }
        });

        const baseConcept = descParts.join(' ').replace(new RegExp(`^\\d{2}/(${monthsStr})\\s*`, 'i'), '').trim();
        const extraLines = [];
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const nextL = lines[j];
          if (bbvaDebitRegex.test(nextL.text)) break;
          if (
            nextL.text.includes('Total de Movimientos') ||
            nextL.text.includes('BBVA MEXICO') ||
            nextL.text.includes('Estado de Cuenta') ||
            nextL.text.includes('PAGINA ') ||
            nextL.text.includes('FECHA SALDO') ||
            nextL.text.includes('OPER LIQ')
          ) break;
          if (nextL.items[0] && nextL.items[0].x >= 70 && nextL.items[0].x <= 120) {
            extraLines.push(nextL.text.trim());
          }
        }

        const cleanExtras = extraLines
          .map(e => e.replace(/^\d{10}\s+\d{3}\s+\d{7}/, '').replace(/^\d{10}\s+BNET\s+\d+\s*/, '').replace(/^0000\d+$/, '').replace(/^0859\d+$/, '').replace(/^MBAN\d+$/, '').trim())
          .filter(Boolean);

        const amount = cargoAmt !== null ? cargoAmt : abonoAmt;
        const type = cargoAmt !== null ? 'cargo' : 'abono';
        if (amount !== null && !isNaN(amount)) {
          const fullConcept = cleanExtras.length > 0 ? `${baseConcept} · ${cleanExtras.join(' · ')}` : baseConcept;
          const idx = transactions.length;
          transactions.push({
            id: `${statementId}-tx-${idx}`,
            catalogId: `${statementId}-tx-${idx}`,
            statementId,
            statementFile: fileName,
            statementUrl,
            periodLabel,
            bank,
            paymentMethod,
            accountName,
            accountNumber,
            date: rawDate,
            isoDate,
            concept: fullConcept,
            baseConcept,
            detailLines: extraLines,
            amount: Math.abs(amount),
            type,
            subType: classifySubType(fullConcept, type, bank, paymentMethod),
            originalLine: l.text,
            page: l.page,
            y: l.y,
            pageHeight: l.pageHeight,
            pageWidth: l.pageWidth,
            bucket: null
          });
        }
      }
    }
  } else if (bank === 'BBVA' && paymentMethod === 'credito') {
    const bbvaCreditRegex = /^(\d{2}-[a-zA-Z]{3}-\d{4})\s+(\d{2}-[a-zA-Z]{3}-\d{4})\s+(.+?)\s+([+-]\s*\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))$/i;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const m = l.text.match(bbvaCreditRegex);
      if (m) {
        const rawDate = m[1];
        const dParts = rawDate.match(/(\d{2})-([a-zA-Z]{3})-(\d{4})/);
        const monNum = MONTHS_MAP[dParts[2].toLowerCase()] || '01';
        const isoDate = `${dParts[3]}-${monNum}-${dParts[1]}`;
        const concept = m[3].trim();
        const amtStr = m[4].replace(/\s+/g, '');
        const isPayment = amtStr.startsWith('-') || l.text.includes('SU PAGO') || l.text.includes('PAGO TDC');
        const amount = parseFloat(amtStr.replace(/[+\-$,]/g, ''));
        const type = isPayment ? 'abono' : 'cargo';
        const extraLines = [];
        const nextL = lines[i + 1];
        if (nextL && nextL.page === l.page && Math.abs(nextL.y - l.y) <= 18 && !bbvaCreditRegex.test(nextL.text) && !nextL.text.includes('TOTAL ')) {
          extraLines.push(nextL.text.trim());
        }
        const idx = transactions.length;
        transactions.push({
          id: `${statementId}-tx-${idx}`,
          catalogId: `${statementId}-tx-${idx}`,
          statementId,
          statementFile: fileName,
          statementUrl,
          periodLabel,
          bank,
          paymentMethod,
          accountName,
          accountNumber,
          date: rawDate,
          isoDate,
          concept,
          baseConcept: concept,
          detailLines: extraLines,
          amount: Math.abs(amount),
          type,
          subType: classifySubType(concept, type, bank, paymentMethod),
          originalLine: l.text,
          page: l.page,
          y: l.y,
          pageHeight: l.pageHeight,
          pageWidth: l.pageWidth,
          bucket: null
        });
      }
    }
  } else if (bank === 'AMEX') {
    const amexOneLineRegex = new RegExp(`^(\\d{1,2})\\s+de\\s+(${amexMonthsStr})\\s+(.+?)\\s+(-?\\$?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2}))(?:\\s+(CR))?(?:\\s+\\d+\\.\\d{2})?$`, 'i');
    const amexWrappedLineRegex = /^(\d{1,2})\s+de\s+(.+?)\s+(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?:\s+(CR))?$/i;
    const amexMonthStartRegex = new RegExp(`^(${amexMonthsStr})(?:\\s+(.*))?$`, 'i');

    let inOperations = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.text.includes('Fecha y Detalle de las operaciones') || l.text.includes('Transacciones de Meses sin Intereses')) {
        inOperations = true;
      }
      if (l.text.includes('Consolidado de compras en Meses sin Intereses') || l.text.includes('Resumen de Meses sin Intereses') || l.text.includes('Resumen de Cuenta')) {
        inOperations = false;
      }
      if (!inOperations) continue;

      let dayNum = null;
      let monName = null;
      let concept = null;
      let amount = null;
      let inlineCR = false;

      const m1 = l.text.match(amexOneLineRegex);
      if (m1) {
        dayNum = parseInt(m1[1], 10);
        monName = m1[2];
        concept = m1[3].trim();
        amount = parseFloat(m1[4].replace(/[$,]/g, ''));
        inlineCR = Boolean(m1[5]);
      } else {
        const m2 = l.text.match(amexWrappedLineRegex);
        const nextL = lines[i + 1];
        if (m2 && nextL && nextL.page === l.page && Math.abs(nextL.y - l.y) <= 18) {
          const mMonth = nextL.text.match(amexMonthStartRegex);
          if (mMonth && !m2[2].startsWith('Dólar U.S.A.')) {
            dayNum = parseInt(m2[1], 10);
            monName = mMonth[1];
            concept = m2[2].trim();
            amount = parseFloat(m2[3].replace(/[$,]/g, ''));
            inlineCR = Boolean(m2[4]);
          }
        } else if (!m2) {
          const orphanMatch = l.text.match(/^([A-Z0-9*.\s\-/]+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2}))$/);
          if (orphanMatch && !l.text.includes('Total ') && !l.text.includes('CARGO ')) {
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
              if (lines[j].page === l.page + 1) {
                const pNext = lines[j].text.match(/^(\d{1,2})\s+de\s+Dólar U\.S\.A\./i);
                const pNext2 = lines[j + 1]?.text.match(amexMonthStartRegex);
                if (pNext && pNext2) {
                  dayNum = parseInt(pNext[1], 10);
                  monName = pNext2[1];
                  concept = orphanMatch[1].trim();
                  amount = parseFloat(orphanMatch[2].replace(/,/g, ''));
                  break;
                }
              }
            }
          }
        }
      }

      if (dayNum && monName && concept && amount !== null && !isNaN(amount)) {
        if (concept.toUpperCase().includes('TOTAL DE MESES SIN INTERESES')) continue;
        const rawDate = m1 ? `${m1[1]} de ${m1[2]}` : `${dayNum} de ${monName}`;
        const monNum = parseInt(MONTHS_MAP[monName.toLowerCase()] || '01', 10);
        const yr = resolveYearForMonth(monNum, startMonth, startYear, endMonth, endYear);
        const isoDate = `${yr}-${String(monNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        const nextLine = lines[i + 1];
        const hasNextLineCR = nextLine && nextLine.page === l.page && Math.abs(nextLine.y - l.y) <= 18 && /\bCR$/i.test(nextLine.text.trim());
        const isPayment = inlineCR || hasNextLineCR || l.text.includes('GRACIAS POR SU PAGO') || l.text.includes('SU PAGO');
        const type = isPayment ? 'abono' : 'cargo';

        const extraLines = [];
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nl = lines[j];
          if (nl.page !== l.page || Math.abs(nl.y - l.y) > 30) break;
          if (amexOneLineRegex.test(nl.text) || amexWrappedLineRegex.test(nl.text) || nl.text.includes('Total de ')) break;
          if (nl.text.includes('CARGO ') || nl.text.includes('RFC') || nl.text.includes('Dólar ') || nl.text.includes('Euro ')) {
            extraLines.push(nl.text.trim());
          }
        }

        const cargoInstallment = extraLines.find(el => /CARGO\s+\d+\s+DE\s+\d+/i.test(el));
        const enrichedConcept = (concept.includes('MESES EN AUTOMÁTICO') && cargoInstallment)
          ? `${concept} (${cargoInstallment.match(/CARGO\s+\d+\s+DE\s+\d+/i)[0]})`
          : concept;

        const idx = transactions.length;
        transactions.push({
          id: `${statementId}-tx-${idx}`,
          catalogId: `${statementId}-tx-${idx}`,
          statementId,
          statementFile: fileName,
          statementUrl,
          periodLabel,
          bank,
          paymentMethod,
          accountName,
          accountNumber,
          date: rawDate,
          isoDate,
          concept: enrichedConcept,
          baseConcept: concept,
          detailLines: extraLines,
          amount: Math.abs(amount),
          type,
          subType: classifySubType(concept, type, bank, paymentMethod),
          originalLine: l.text,
          page: l.page,
          y: l.y,
          pageHeight: l.pageHeight,
          pageWidth: l.pageWidth,
          bucket: null
        });
      }
    }
  }

  const totalCargos = Number(transactions.filter(t => t.type === 'cargo').reduce((s, t) => s + t.amount, 0).toFixed(2));
  const totalAbonos = Number(transactions.filter(t => t.type === 'abono').reduce((s, t) => s + t.amount, 0).toFixed(2));
  const countCargos = transactions.filter(t => t.type === 'cargo').length;
  const countAbonos = transactions.filter(t => t.type === 'abono').length;

  return {
    statement: {
      id: statementId,
      fileName,
      url: statementUrl,
      bank,
      paymentMethod,
      accountName,
      accountNumber,
      periodLabel,
      cutoffDate,
      startYear,
      endYear,
      startMonth,
      endMonth,
      numPages,
      txCount: transactions.length,
      countCargos,
      countAbonos,
      totalCargos,
      totalAbonos
    },
    transactions,
    arrayBuffer
  };
}

/**
 * Compatibilidad con llamadas existentes
 */
export async function extractLinesFromPDF(file) {
  const { lines } = await extractDetailedLinesFromPDF(file);
  return lines.map(l => l.text);
}

export function parseTransactions(lines) {
  return lines;
}
