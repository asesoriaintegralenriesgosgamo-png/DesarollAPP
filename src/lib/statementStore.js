import catalogData from './statementsCatalog.json';
import { MONTHS_MAP, classifySubType } from './pdfParser';

const META_DELIMITER = ' |||META:';
const IDB_NAME = 'analisis_estados_cuenta_db';
const IDB_VERSION = 1;
const STORE_PDFS = 'uploaded_pdfs';

function openStatementsDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: 'fileName' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUploadedStatementToIDB({ statement, transactions, arrayBuffer }) {
  try {
    const db = await openStatementsDB();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PDFS, 'readwrite');
      const store = tx.objectStore(STORE_PDFS);
      store.put({
        fileName: statement.fileName,
        statement,
        transactions,
        arrayBuffer,
        savedAt: new Date().toISOString()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error guardando PDF en IndexedDB:', err);
  }
}

export async function listUploadedStatementsFromIDB() {
  try {
    const db = await openStatementsDB();
    if (!db) return [];
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PDFS, 'readonly');
      const store = tx.objectStore(STORE_PDFS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error leyendo PDFs de IndexedDB:', err);
    return [];
  }
}

export async function getStatementPdfData(statementFile) {
  if (!statementFile) return null;
  // 1. Check built-in catalog first
  const builtin = catalogData.statements.find(s => s.fileName === statementFile);
  if (builtin) {
    return { type: 'url', url: builtin.url, statement: builtin };
  }
  // 2. Check IndexedDB
  try {
    const db = await openStatementsDB();
    if (db) {
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PDFS, 'readonly');
        const store = tx.objectStore(STORE_PDFS);
        const req = store.get(statementFile);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (record && record.arrayBuffer) {
        return { type: 'buffer', data: record.arrayBuffer, statement: record.statement };
      }
    }
  } catch (e) {
    console.warn('No se pudo obtener de IndexedDB:', e);
  }
  // Fallback URL
  return { type: 'url', url: `/estados-de-cuenta/${encodeURIComponent(statementFile)}`, statement: null };
}

export async function getAllCatalogAndUploadedData() {
  const uploaded = await listUploadedStatementsFromIDB();
  const statementMap = new Map();
  const txList = [...catalogData.transactions];

  catalogData.statements.forEach(s => {
    statementMap.set(s.fileName, { ...s, source: 'folder' });
  });

  uploaded.forEach(item => {
    if (item.statement && !statementMap.has(item.statement.fileName)) {
      statementMap.set(item.statement.fileName, { ...item.statement, source: 'uploaded' });
      if (Array.isArray(item.transactions)) {
        txList.push(...item.transactions);
      }
    }
  });

  const statements = Array.from(statementMap.values()).sort((a, b) =>
    (a.cutoffDate || '').localeCompare(b.cutoffDate || '')
  );

  return { statements, transactions: txList };
}

export function packOriginalLineWithMeta(rawOriginalLine, meta) {
  const cleanRaw = stripMetaFromOriginalLine(rawOriginalLine);
  if (!meta) return cleanRaw;
  const compactMeta = {
    cid: meta.catalogId || undefined,
    sid: meta.statementId || undefined,
    sf: meta.statementFile || undefined,
    su: meta.statementUrl || undefined,
    pl: meta.periodLabel || undefined,
    bk: meta.bank || undefined,
    pm: meta.paymentMethod || undefined,
    an: meta.accountName || undefined,
    pg: meta.page || undefined,
    y: meta.y || undefined,
    ph: meta.pageHeight || undefined,
    pw: meta.pageWidth || undefined,
    iso: meta.isoDate || undefined,
    st: meta.subType || undefined,
    bc: meta.baseConcept || undefined,
    dl: meta.detailLines && meta.detailLines.length ? meta.detailLines : undefined
  };
  return `${cleanRaw}${META_DELIMITER}${JSON.stringify(compactMeta)}`;
}

export function stripMetaFromOriginalLine(originalLine) {
  if (!originalLine) return '';
  const idx = originalLine.indexOf(META_DELIMITER);
  return idx !== -1 ? originalLine.slice(0, idx) : originalLine;
}

export function parseFallbackIsoDate(dateStr) {
  if (!dateStr) return '2026-01-01';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // BBVA credito: 08-dic-2025
  const bbvaCred = dateStr.match(/^(\d{1,2})-([a-z]{3})-(\d{4})$/i);
  if (bbvaCred) {
    const m = MONTHS_MAP[bbvaCred[2].toLowerCase()] || '01';
    return `${bbvaCred[3]}-${m}-${String(bbvaCred[1]).padStart(2, '0')}`;
  }

  // BBVA debito: 25/DIC
  const bbvaDeb = dateStr.match(/^(\d{1,2})\/([a-z]{3})$/i);
  if (bbvaDeb) {
    const monAbbr = bbvaDeb[2].toLowerCase();
    const m = MONTHS_MAP[monAbbr] || '01';
    const yr = ['oct', 'nov', 'dic'].includes(monAbbr) ? '2025' : '2026';
    return `${yr}-${m}-${String(bbvaDeb[1]).padStart(2, '0')}`;
  }

  // Amex: 20 de Abril
  const amex = dateStr.match(/^(\d{1,2})\s+de\s+([a-z]+)$/i);
  if (amex) {
    const monName = amex[2].toLowerCase();
    const m = MONTHS_MAP[monName] || '01';
    const yr = (monName.startsWith('oct') || monName.startsWith('nov') || monName.startsWith('dic')) ? '2025' : '2026';
    return `${yr}-${m}-${String(amex[1]).padStart(2, '0')}`;
  }

  return '2026-01-01';
}

const SHORT_MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatFriendlyDate(isoDate, rawDate = '') {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [yr, mo, dy] = isoDate.split('-');
    const mIdx = parseInt(mo, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${dy} ${SHORT_MONTHS_ES[mIdx]} ${yr}`;
    }
  }
  return rawDate || '';
}

export function inferBankAndMethodFromLegacy(dateStr) {
  if (/^\d{1,2}\s+de\s+[A-Za-z]+/i.test(dateStr || '')) {
    return {
      bank: 'AMEX',
      paymentMethod: 'credito',
      accountName: 'Amex Gold Elite'
    };
  }
  if (/^\d{2}\/[A-Z]{3}$/i.test(dateStr || '')) {
    return {
      bank: 'BBVA',
      paymentMethod: 'debito',
      accountName: 'BBVA Libretón Premium'
    };
  }
  if (/^\d{2}-[a-z]{3}-\d{4}$/i.test(dateStr || '')) {
    return {
      bank: 'BBVA',
      paymentMethod: 'credito',
      accountName: 'BBVA Tarjeta Oro'
    };
  }
  return {
    bank: 'MANUAL',
    paymentMethod: 'debito',
    accountName: 'Registro Manual'
  };
}

export function unpackExpenseRow(dbRow, catalogTxs = catalogData.transactions) {
  const rawOriginalLine = stripMetaFromOriginalLine(dbRow.original_line || dbRow.originalLine || '');
  let meta = null;

  const fullOrig = dbRow.original_line || dbRow.originalLine || '';
  const delimIdx = fullOrig.indexOf(META_DELIMITER);
  if (delimIdx !== -1) {
    try {
      const parsed = JSON.parse(fullOrig.slice(delimIdx + META_DELIMITER.length));
      meta = {
        catalogId: parsed.cid,
        statementId: parsed.sid,
        statementFile: parsed.sf,
        statementUrl: parsed.su || (parsed.sf ? `/estados-de-cuenta/${encodeURIComponent(parsed.sf)}` : null),
        periodLabel: parsed.pl,
        bank: parsed.bk,
        paymentMethod: parsed.pm,
        accountName: parsed.an,
        page: parsed.pg,
        y: parsed.y,
        pageHeight: parsed.ph || 792,
        pageWidth: parsed.pw || 612,
        isoDate: parsed.iso,
        subType: parsed.st,
        baseConcept: parsed.bc,
        detailLines: parsed.dl || []
      };
    } catch {
      meta = null;
    }
  }

  // If meta is missing or incomplete, try matching from catalogTxs
  if ((!meta || !meta.statementFile) && rawOriginalLine && rawOriginalLine !== 'Registro manual') {
    const amt = Number(dbRow.amount);
    const matched = catalogTxs.find(
      c => c.originalLine.trim() === rawOriginalLine.trim() && Math.abs(c.amount - amt) < 0.01
    ) || catalogTxs.find(
      c => c.date === dbRow.date && Math.abs(c.amount - amt) < 0.01 && (c.baseConcept === dbRow.concept || c.concept === dbRow.concept)
    );
    if (matched) {
      meta = {
        catalogId: matched.catalogId,
        statementId: matched.statementId,
        statementFile: matched.statementFile,
        statementUrl: matched.statementUrl,
        periodLabel: matched.periodLabel,
        bank: matched.bank,
        paymentMethod: matched.paymentMethod,
        accountName: matched.accountName,
        page: matched.page,
        y: matched.y,
        pageHeight: matched.pageHeight,
        pageWidth: matched.pageWidth,
        isoDate: matched.isoDate,
        subType: matched.subType,
        baseConcept: matched.baseConcept,
        detailLines: matched.detailLines || []
      };
    }
  }

  const fallbackInfo = inferBankAndMethodFromLegacy(dbRow.date, rawOriginalLine, dbRow.concept);
  const bank = meta?.bank || fallbackInfo.bank;
  const paymentMethod = meta?.paymentMethod || fallbackInfo.paymentMethod;
  const accountName = meta?.accountName || fallbackInfo.accountName;
  const isoDate = meta?.isoDate || parseFallbackIsoDate(dbRow.date, rawOriginalLine);
  const inferredSubType = classifySubType(dbRow.concept, dbRow.type, bank, paymentMethod);
  const subType = inferredSubType === 'inversion' ? 'inversion' : (meta?.subType || inferredSubType);

  return {
    ...dbRow,
    amount: Number(dbRow.amount) || 0,
    bucket: dbRow.category_id ?? dbRow.bucket ?? null,
    rawOriginalLine,
    catalogId: meta?.catalogId || null,
    statementId: meta?.statementId || null,
    statementFile: meta?.statementFile || null,
    statementUrl: meta?.statementUrl || null,
    periodLabel: meta?.periodLabel || null,
    bank,
    paymentMethod,
    accountName,
    page: meta?.page || null,
    y: meta?.y || null,
    pageHeight: meta?.pageHeight || 792,
    pageWidth: meta?.pageWidth || 612,
    isoDate,
    subType,
    baseConcept: meta?.baseConcept || dbRow.concept,
    detailLines: meta?.detailLines || [],
    hasMetaPacked: delimIdx !== -1
  };
}

/**
 * Reconcilia todos los gastos existentes en Supabase con los 28 estados de cuenta (859 movimientos):
 * 1. Conserva el 100% de los nombres personalizados (`title`) y categorías (`category_id`).
 * 2. Elimina duplicados fusionando cualquier nombre personalizado o categoría en el registro principal.
 * 3. Vincula cada movimiento con su PDF (`statementFile`, `page`, `y`, `bank`, `paymentMethod`, `isoDate`).
 * 4. Inserta los movimientos faltantes de los 28 estados de cuenta para que nada quede fuera.
 */
export async function reconcileAndLinkExpenses({
  existingExpenses,
  deletedExpenses = [],
  userId,
  insertPersonalExpenses,
  updatePersonalExpenseFields,
  hardDeletePersonalExpense
}) {
  const { statements, transactions: catalogTxs } = await getAllCatalogAndUploadedData();

  const unpackedActive = existingExpenses.map(r => unpackExpenseRow(r, catalogTxs));
  const unpackedDeleted = deletedExpenses.map(r => unpackExpenseRow(r, catalogTxs));

  // Build a map of custom titles and categories by signature in case a duplicate had a rename/category
  const customRenameBySig = new Map();
  const customCategoryBySig = new Map();

  for (const row of unpackedActive) {
    const isRenamed = Boolean(
      row.title &&
      row.title.trim() !== '' &&
      row.title.trim() !== (row.concept || '').trim() &&
      row.title.trim() !== (row.baseConcept || '').trim()
    );
    const sig1 = `${row.rawOriginalLine.trim()}|${Number(row.amount).toFixed(2)}`;
    const sig2 = `${row.date}|${Number(row.amount).toFixed(2)}|${(row.baseConcept || row.concept || '').trim()}`;

    if (isRenamed) {
      customRenameBySig.set(sig1, row.title.trim());
      customRenameBySig.set(sig2, row.title.trim());
    }
    if (row.category_id) {
      customCategoryBySig.set(sig1, row.category_id);
      customCategoryBySig.set(sig2, row.category_id);
    }
  }

  // Sort active rows so rows with custom title or category_id are matched FIRST
  const sortedActive = [...unpackedActive].sort((a, b) => {
    const aRenamed = a.title && a.title !== a.concept && a.title !== a.baseConcept ? 2 : 0;
    const bRenamed = b.title && b.title !== b.concept && b.title !== b.baseConcept ? 2 : 0;
    const aCat = a.category_id ? 1 : 0;
    const bCat = b.category_id ? 1 : 0;
    return (bRenamed + bCat) - (aRenamed + aCat);
  });

  const usedCatalogIds = new Set();
  const matchedActiveRows = [];
  const duplicateRowsToDelete = [];
  const manualRows = [];

  // Mark catalog transactions that are currently in the user's Trash bin as used so we don't re-insert them
  for (const delRow of unpackedDeleted) {
    const amt = Number(delRow.amount);
    const match = catalogTxs.find(c =>
      !usedCatalogIds.has(c.catalogId) &&
      (
        (delRow.catalogId && c.catalogId === delRow.catalogId) ||
        (delRow.rawOriginalLine && c.originalLine.trim() === delRow.rawOriginalLine.trim() && Math.abs(c.amount - amt) < 0.01)
      )
    );
    if (match) {
      usedCatalogIds.add(match.catalogId);
    }
  }

  // Match active DB rows 1-to-1 against catalogTxs
  for (const row of sortedActive) {
    if (row.rawOriginalLine === 'Registro manual' || row.bank === 'MANUAL') {
      manualRows.push(row);
      continue;
    }

    const amt = Number(row.amount);
    // 1. Exact catalogId match
    let matchedCat = row.catalogId
      ? catalogTxs.find(c => !usedCatalogIds.has(c.catalogId) && c.catalogId === row.catalogId)
      : null;

    // 2. Exact originalLine + amount match
    if (!matchedCat && row.rawOriginalLine) {
      matchedCat = catalogTxs.find(c =>
        !usedCatalogIds.has(c.catalogId) &&
        c.originalLine.trim() === row.rawOriginalLine.trim() &&
        Math.abs(c.amount - amt) < 0.01
      );
    }

    // 3. Fallback date + amount + concept match
    if (!matchedCat) {
      matchedCat = catalogTxs.find(c =>
        !usedCatalogIds.has(c.catalogId) &&
        c.date === row.date &&
        Math.abs(c.amount - amt) < 0.01 &&
        (c.baseConcept === row.concept || c.concept === row.concept)
      );
    }

    if (matchedCat) {
      usedCatalogIds.add(matchedCat.catalogId);
      matchedActiveRows.push({ dbRow: row, catTx: matchedCat });
    } else {
      // Check if this row is a duplicate of an ALREADY matched catalogTx!
      const isDuplicateOfCatalog = catalogTxs.some(c =>
        usedCatalogIds.has(c.catalogId) &&
        (
          (row.rawOriginalLine && c.originalLine.trim() === row.rawOriginalLine.trim() && Math.abs(c.amount - amt) < 0.01) ||
          (c.date === row.date && Math.abs(c.amount - amt) < 0.01 && (c.baseConcept === row.concept || c.concept === row.concept))
        )
      );
      if (isDuplicateOfCatalog) {
        duplicateRowsToDelete.push(row);
      } else {
        // Keep if it's from another unknown PDF
        manualRows.push(row);
      }
    }
  }

  let updatedCount = 0;
  let deduplicatedCount = 0;
  let insertedCount = 0;
  let preservedRenames = 0;
  let preservedCategories = 0;

  // 1. Delete duplicate rows in Supabase
  if (duplicateRowsToDelete.length > 0 && hardDeletePersonalExpense) {
    for (const dup of duplicateRowsToDelete) {
      try {
        await hardDeletePersonalExpense(dup.id);
        deduplicatedCount++;
      } catch (e) {
        console.warn('No se pudo eliminar duplicado:', dup.id, e);
      }
    }
  }

  // 2. Update matched active rows if their metadata/type/concept/title/category needs enrichment
  const updatePromises = [];
  for (const { dbRow, catTx } of matchedActiveRows) {
    const sig1 = `${catTx.originalLine.trim()}|${Number(catTx.amount).toFixed(2)}`;
    const sig2 = `${catTx.date}|${Number(catTx.amount).toFixed(2)}|${catTx.baseConcept.trim()}`;

    const wasRenamedOnThisRow = Boolean(
      dbRow.title &&
      dbRow.title.trim() !== '' &&
      dbRow.title.trim() !== (dbRow.concept || '').trim() &&
      dbRow.title.trim() !== (catTx.baseConcept || '').trim() &&
      dbRow.title.trim() !== (catTx.concept || '').trim()
    );

    const bestCustomTitle = wasRenamedOnThisRow
      ? dbRow.title.trim()
      : (customRenameBySig.get(sig1) || customRenameBySig.get(sig2) || null);

    const bestCategoryId = dbRow.category_id || customCategoryBySig.get(sig1) || customCategoryBySig.get(sig2) || null;

    if (bestCustomTitle) preservedRenames++;
    if (bestCategoryId) preservedCategories++;

    const desiredTitle = bestCustomTitle || catTx.concept;
    const desiredConcept = catTx.concept;
    const desiredType = catTx.type;
    const desiredOriginalLine = packOriginalLineWithMeta(catTx.originalLine, catTx);

    const needsDbUpdate =
      !dbRow.hasMetaPacked ||
      dbRow.type !== desiredType ||
      dbRow.concept !== desiredConcept ||
      dbRow.title !== desiredTitle ||
      dbRow.category_id !== bestCategoryId ||
      dbRow.statementFile !== catTx.statementFile ||
      dbRow.page !== catTx.page;

    if (needsDbUpdate && updatePersonalExpenseFields) {
      updatePromises.push(
        updatePersonalExpenseFields(dbRow.id, {
          concept: desiredConcept,
          title: desiredTitle,
          type: desiredType,
          category_id: bestCategoryId,
          original_line: desiredOriginalLine
        }).then(() => {
          updatedCount++;
        }).catch(err => {
          console.warn('Error actualizando fila:', dbRow.id, err);
        })
      );
    }
  }

  // Run updates in batches of 20 so we don't overwhelm network
  for (let i = 0; i < updatePromises.length; i += 20) {
    await Promise.all(updatePromises.slice(i, i + 20));
  }

  // 3. Insert any missing catalog transactions into Supabase
  const missingCatalogTxs = catalogTxs.filter(c => !usedCatalogIds.has(c.catalogId));
  if (missingCatalogTxs.length > 0 && insertPersonalExpenses && userId) {
    const payloads = missingCatalogTxs.map(catTx => {
      const sig1 = `${catTx.originalLine.trim()}|${Number(catTx.amount).toFixed(2)}`;
      const sig2 = `${catTx.date}|${Number(catTx.amount).toFixed(2)}|${catTx.baseConcept.trim()}`;
      const inheritedTitle = customRenameBySig.get(sig1) || customRenameBySig.get(sig2) || catTx.concept;
      const inheritedCategory = customCategoryBySig.get(sig1) || customCategoryBySig.get(sig2) || null;

      return {
        user_id: userId,
        date: catTx.date,
        concept: catTx.concept,
        title: inheritedTitle,
        amount: catTx.amount,
        type: catTx.type,
        category_id: inheritedCategory,
        original_line: packOriginalLineWithMeta(catTx.originalLine, catTx)
      };
    });

    for (let i = 0; i < payloads.length; i += 80) {
      const chunk = payloads.slice(i, i + 80);
      try {
        const inserted = await insertPersonalExpenses(chunk);
        insertedCount += inserted.length;
      } catch (err) {
        console.error('Error insertando lote de estados de cuenta:', err);
      }
    }
  }

  return {
    statements,
    stats: {
      totalStatements: statements.length,
      totalCatalogTransactions: catalogTxs.length,
      matched: matchedActiveRows.length,
      updated: updatedCount,
      deduplicated: deduplicatedCount,
      inserted: insertedCount,
      preservedRenames,
      preservedCategories
    }
  };
}
