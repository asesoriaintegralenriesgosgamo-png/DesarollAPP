/**
 * Motor de censura / privacidad sobre estados de cuenta PDF (AMEX y BBVA).
 * Calcula coordenadas exactas en espacio PDF (puntos) a partir de `page.getTextContent()`
 * y de las transacciones de la página para:
 *  1. Ocultar todos los demás gastos/movimientos que no correspondan a la auditoría activa.
 *  2. Ocultar datos confidenciales (Nombre, RFC, dirección, número de cuenta/tarjeta/CLABE,
 *     saldos en cuenta, límites de crédito y totales globales del estado de cuenta).
 */

const SECTION_STOP_REGEX = /^(Total de |Subtotal|CARGOS\s*,\s*COMPRAS|COMPRAS Y CARGOS|MENSAJES ADICIONALES|PROGRAMA DE BENEFICIOS|SALDO SOBRE EL QUE|Notas:|BBVA MEXICO|Este no es un documento|Información Financiera|RESUMEN DE CARGOS|DETALLE DE TRANSACCIONES|Estado de Cuenta|Página \d|PAGINA \d)/i;

const DATE_START_REGEX = /^(\d{1,2}\s+de\s+[A-Za-záéíóúÁÉÍÓÚ]+|\d{1,2}-[a-z]{3}-\d{4}|\d{2}\/[A-Z]{3})\b/i;

const CONFIDENTIAL_PERSONAL_REGEX = /ANTONIO|GARCIA\s+DE\s+LA|DE\s+LA\s+MORA|GAMA990112|ANTIGUO\s+CAMINO|AL\s+SAUZ|HACIENDA\s+GRANDE|TEQUISQUIAPAN|76799|C0232992|3401-\d{4,}-\d{3,}|4772\d{8,}|0465988152|012975\d{8,}|012680\d{8,}|X{4,}\d{3,4}|\*{3,}\d{3,4}/i;

const CONFIDENTIAL_ROW_LABEL_REGEX = /\b(Calle:|Colonia:|CP:\s*\d|R\.?F\.?C\.?\s*:|CLABE\s*:|No\.\s*Cuenta\s*CLABE|No\.\s*de\s*(Cuenta|Cliente)|Número\s*de\s*(Cuenta|tarjeta|cliente)|Tarjeta\s*titular\s*:)/i;

const CONFIDENTIAL_BALANCE_ROW_REGEX = /(Total de (las transacciones|Nuevos Cargos|cargos|abonos|movimientos)|Saldo (Anterior|Actual|Promedio|Final|inicial|base)|Pago (para no generar|mínimo|requerido)|Límite (de Crédito|Disponible)|Depósitos\s*\/\s*Abonos|Retiros\s*\/\s*Cargos|Adeudo del periodo|Monto de intereses|Puntos BBVA|El pago mínimo|veces el pago mínimo|Estimado cliente su cuenta presenta)/i;

const SUMMARY_HEADER_TRIGGER_REGEX = /(Saldo Anterior|Pagos y Créditos|Límite de Crédito|Límite Disponible|Puntos BBVA|Saldo base para)/i;

/**
 * Agrupa los items de `page.getTextContent()` en renglones ordenados de arriba hacia abajo (Y descendente).
 */
export function groupTextContentRows(textContent) {
  const rowsMap = new Map();

  for (const item of textContent?.items || []) {
    const str = item.str;
    if (!str || !str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const w = Math.max(item.width || 0, str.trim().length * 4.2);
    const h = Math.max(Math.abs(item.height || item.transform[3] || 9.5), 8.5);

    // Group items within 2.5pt vertical tolerance
    let matchedKey = null;
    for (const key of rowsMap.keys()) {
      if (Math.abs(key - y) <= 2.5) {
        matchedKey = key;
        break;
      }
    }

    const rowKey = matchedKey !== null ? matchedKey : Math.round(y * 2) / 2;
    if (!rowsMap.has(rowKey)) {
      rowsMap.set(rowKey, []);
    }
    rowsMap.get(rowKey).push({ str, x, y, w, h });
  }

  const rows = [];
  for (const [yKey, items] of rowsMap.entries()) {
    items.sort((a, b) => a.x - b.x);
    const text = items.map(i => i.str.trim()).join(' ');
    const minX = Math.min(...items.map(i => i.x));
    const maxX = Math.max(...items.map(i => i.x + i.w));
    const maxH = Math.max(...items.map(i => i.h));
    rows.push({
      y: yKey,
      items,
      text,
      minX,
      maxX,
      height: maxH
    });
  }

  // Sort top-to-bottom (descending Y in PDF coordinates)
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

/**
 * Calcula los rectángulos de censura en coordenadas PDF (origen abajo-izquierda: x, yBottom, width, height)
 */
export function computePageRedactions({
  textContent,
  pageTransactions = [],
  visibleTxIds = null, // Set of tx.id or tx.catalogId that should remain visible
  bank = '',
  paymentMethod = '',
  pageWidth = 612,
  hideOtherExpenses = false,
  hideConfidentialData = false
}) {
  if (!hideOtherExpenses && !hideConfidentialData) return [];

  const rows = groupTextContentRows(textContent);
  if (rows.length === 0) return [];

  const sortedTxs = [...pageTransactions]
    .filter(tx => typeof tx.y === 'number')
    .sort((a, b) => b.y - a.y);

  const isTxVisible = (tx) => {
    if (!visibleTxIds) return true;
    return (
      (tx.id && visibleTxIds.has(tx.id)) ||
      (tx.catalogId && visibleTxIds.has(tx.catalogId))
    );
  };

  // Map row index -> owning transaction (if any)
  const rowOwner = new Map();
  const isBbvaDebito = bank === 'BBVA' && paymentMethod === 'debito';

  // 1. Anchor main row for each transaction
  const txMainRowIdx = new Map();
  for (const tx of sortedTxs) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const dist = Math.abs(rows[i].y - tx.y);
      if (dist <= 5 && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) {
      txMainRowIdx.set(tx, bestIdx);
      rowOwner.set(bestIdx, tx);
    }
  }

  // 2. Attach BBVA Débito pre-line (SPEI beneficiary line right above date row)
  if (isBbvaDebito) {
    for (const tx of sortedTxs) {
      const mainIdx = txMainRowIdx.get(tx);
      if (mainIdx === undefined || mainIdx <= 0) continue;
      const prevRow = rows[mainIdx - 1];
      if (
        !rowOwner.has(mainIdx - 1) &&
        prevRow.y - rows[mainIdx].y <= 14.5 &&
        prevRow.minX >= 72 &&
        !/DESCRIPCI|OPERACI|FECHA|SALDO/i.test(prevRow.text)
      ) {
        rowOwner.set(mainIdx - 1, tx);
      }
    }
  }

  // 3. Attach continuation sub-lines below each transaction (RFC/REF, CR, Dólar, SPEI refs, IVA/MXP)
  for (let t = 0; t < sortedTxs.length; t++) {
    const tx = sortedTxs[t];
    const mainIdx = txMainRowIdx.get(tx);
    if (mainIdx === undefined) continue;

    const nextTx = sortedTxs[t + 1];
    const nextMainIdx = nextTx ? txMainRowIdx.get(nextTx) : rows.length;
    const stopIdx = nextMainIdx !== undefined ? nextMainIdx : rows.length;

    for (let rIdx = mainIdx + 1; rIdx < stopIdx; rIdx++) {
      if (rowOwner.has(rIdx)) break;
      const r = rows[rIdx];
      if (rows[mainIdx].y - r.y > 54) break;
      if (SECTION_STOP_REGEX.test(r.text.trim())) break;
      if (DATE_START_REGEX.test(r.text.trim())) break;
      rowOwner.set(rIdx, tx);
    }
  }

  const rects = [];
  const addRect = (x, yBottom, width, height, kind = 'confidential') => {
    rects.push({
      x: Math.max(4, x),
      yBottom: Math.max(2, yBottom),
      width: Math.min(pageWidth - 8, width),
      height: Math.max(10, height),
      kind
    });
  };

  let redactNextNumericRow = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ownerTx = rowOwner.get(i);

    if (ownerTx) {
      const visible = isTxVisible(ownerTx);
      if (!visible && hideOtherExpenses) {
        // Redact the entire non-audited transaction row cleanly
        addRect(12, row.y - 3.5, pageWidth - 24, row.height + 5.5, 'expense');
        continue;
      }

      // Even on a VISIBLE transaction, redact confidential running balances or card digits if hideConfidentialData is ON
      if (visible && hideConfidentialData) {
        for (const item of row.items) {
          // BBVA Débito running balances (SALDO OPERACIÓN / SALDO LIQUIDACIÓN at x >= 470)
          if (isBbvaDebito && item.x >= 470) {
            addRect(item.x - 3, item.y - 3, item.w + 8, item.h + 5, 'confidential');
          } else if (/\*{3,}\d{3,4}|X{4,}\d{3,4}/i.test(item.str)) {
            // Mask digital card suffix if present
            addRect(item.x - 2, item.y - 2.5, item.w + 4, item.h + 4, 'confidential');
          }
        }
      }
      redactNextNumericRow = false;
      continue;
    }

    // Non-owned row (headers, summary boxes, MSI informational tables, footers)
    const trimmed = row.text.trim();

    // A) If hideOtherExpenses is ON, redact unowned informational movement rows (e.g. MSI summary table rows or Benefit points movement rows)
    if (hideOtherExpenses && DATE_START_REGEX.test(trimmed)) {
      addRect(12, row.y - 3.5, pageWidth - 24, row.height + 5.5, 'expense');
      continue;
    }

    if (!hideConfidentialData) continue;

    // B) BBVA Débito running balance column values on any row below header
    if (isBbvaDebito && row.y < 635) {
      for (const item of row.items) {
        if (item.x >= 470 && /\d/.test(item.str)) {
          addRect(item.x - 3, item.y - 3, item.w + 8, item.h + 5, 'confidential');
        }
      }
    }

    // C) Summary numeric row immediately below a summary header (e.g., AMEX Page 1 Saldo Anterior / Nuevos Cargos values)
    if (redactNextNumericRow && /^[\d$,.\-+=\sCRNA%]+$/i.test(trimmed)) {
      addRect(row.minX - 4, row.y - 3, row.maxX - row.minX + 10, row.height + 5.5, 'confidential');
      redactNextNumericRow = false;
      continue;
    }
    redactNextNumericRow = SUMMARY_HEADER_TRIGGER_REGEX.test(trimmed);

    // D) Full-row confidential labels or global balance/total rows
    if (CONFIDENTIAL_ROW_LABEL_REGEX.test(trimmed) || CONFIDENTIAL_BALANCE_ROW_REGEX.test(trimmed)) {
      // Check item by item so we can keep harmless headers like "Fecha de Corte 19-Jun-2026" while redacting sensitive items/amounts
      for (const item of row.items) {
        const s = item.str.trim();
        const isDateOrPageLabel = /^(Fecha|Siguiente|de Corte|Periodo:?|Período|Página|\d{1,2}-[A-Za-z]{3}-\d{4}|\d{2}\/\d{2}\/\d{4})/i.test(s);
        if (!isDateOrPageLabel) {
          addRect(item.x - 3, item.y - 3, item.w + 6, item.h + 5, 'confidential');
        }
      }
      continue;
    }

    // E) Individual items matching personal name, RFC, address, account/card/CLABE
    for (const item of row.items) {
      if (CONFIDENTIAL_PERSONAL_REGEX.test(item.str)) {
        addRect(item.x - 3, item.y - 3, item.w + 6, item.h + 5, 'confidential');
      }
    }
  }

  return mergeOverlappingRowRects(rects);
}

/**
 * Une rectángulos del mismo tipo que se traslapan en el mismo renglón para un acabado visual limpio.
 */
function mergeOverlappingRowRects(rects) {
  if (rects.length <= 1) return rects;
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(b.yBottom - a.yBottom) > 3) return b.yBottom - a.yBottom;
    return a.x - b.x;
  });

  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (
      prev.kind === curr.kind &&
      Math.abs(prev.yBottom - curr.yBottom) <= 3.5 &&
      curr.x <= prev.x + prev.width + 8
    ) {
      const right = Math.max(prev.x + prev.width, curr.x + curr.width);
      const bottom = Math.min(prev.yBottom, curr.yBottom);
      const top = Math.max(prev.yBottom + prev.height, curr.yBottom + curr.height);
      prev.x = Math.min(prev.x, curr.x);
      prev.yBottom = bottom;
      prev.width = right - prev.x;
      prev.height = top - bottom;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

/**
 * Dibuja los bloques de censura directamente sobre el `<canvas>` del PDF.
 */
export function drawRedactionsOnCanvas(ctx, redactions, baseViewport, scaledViewport, dpr = 1) {
  if (!ctx || !redactions || redactions.length === 0) return;

  const scaleX = scaledViewport.width / (baseViewport.width || 612);
  const scaleY = scaledViewport.height / (baseViewport.height || 792);
  const baseH = baseViewport.height || 792;

  ctx.save();
  ctx.scale(dpr, dpr);

  for (const r of redactions) {
    const vx = r.x * scaleX;
    const vy = (baseH - (r.yBottom + r.height)) * scaleY;
    const vw = r.width * scaleX;
    const vh = r.height * scaleY;

    // Solid opaque redaction block so underlying pixels are 100% erased
    ctx.fillStyle = r.kind === 'expense' ? '#171717' : '#0f172a';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(vx, vy, vw, vh, 3);
    } else {
      ctx.rect(vx, vy, vw, vh);
    }
    ctx.fill();

    // Subtle border for clean editorial audit look
    ctx.strokeStyle = r.kind === 'expense' ? '#262626' : '#1e293b';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  ctx.restore();
}
