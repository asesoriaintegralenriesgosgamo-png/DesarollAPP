import { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  FileText,
  Search,
  Edit2,
  Check,
  Crosshair,
  Shield,
  Eye,
  Layers,
  BookOpen,
  CheckSquare,
  Square
} from 'lucide-react';
import { getStatementPdfData, formatFriendlyDate } from '../../lib/statementStore';
import { computePageRedactions, drawRedactionsOnCanvas } from '../../lib/pdfRedactor';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
}

// Session-level byte cache so toggling Privacy Mode or switching views is instant
const pdfBytesCache = new Map();

async function loadPdfBytesCached(fileName) {
  if (pdfBytesCache.has(fileName)) {
    return pdfBytesCache.get(fileName);
  }
  const source = await getStatementPdfData(fileName);
  if (!source) {
    throw new Error(`No se encontró el archivo PDF (${fileName}).`);
  }

  let pdfBytes;
  if (source.type === 'buffer') {
    pdfBytes = new Uint8Array(source.data.slice(0));
  } else {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el PDF (${response.status}).`);
    }
    const arrayBuffer = await response.arrayBuffer();
    pdfBytes = new Uint8Array(arrayBuffer);
    if (
      pdfBytes.length < 5 ||
      pdfBytes[0] !== 0x25 ||
      pdfBytes[1] !== 0x50 ||
      pdfBytes[2] !== 0x44 ||
      pdfBytes[3] !== 0x46
    ) {
      throw new Error('El archivo recibido no es un documento PDF válido.');
    }
  }
  pdfBytesCache.set(fileName, pdfBytes);
  return pdfBytes;
}

/**
 * Renderiza una página individual de un estado de cuenta PDF con:
 * - Lazy rendering por IntersectionObserver (para auditorías multi-PDF fluidas en laptops)
 * - Censura en canvas en tiempo real (otros gastos + datos confidenciales / saldos)
 * - Subrayado y resaltado multicolor de todos los cargos auditados en la página
 */
function PdfPageCanvasCard({
  statement,
  fileName,
  pageNumber,
  scale,
  pageTransactions,
  highlightedTxIds,
  selectedTxId,
  categoriesMap,
  hideOtherExpenses,
  hideConfidentialData,
  onSelectTransaction,
  lazy = false,
  showStatementHeader = false
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [isVisible, setIsVisible] = useState(!lazy);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState(null);

  // Lazy load when scrolling near the page in continuous multi-PDF mode
  useEffect(() => {
    if (!lazy || isVisible) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '700px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, isVisible]);

  // Visible transaction IDs for privacy redactor
  const visibleTxIdsForRedactor = useMemo(() => {
    if (!hideOtherExpenses) return null;
    if (highlightedTxIds && highlightedTxIds.size > 0) {
      return highlightedTxIds;
    }
    if (selectedTxId) {
      const s = new Set([selectedTxId]);
      const match = pageTransactions.find(t => t.id === selectedTxId);
      if (match?.catalogId) s.add(match.catalogId);
      return s;
    }
    return null;
  }, [hideOtherExpenses, highlightedTxIds, selectedTxId, pageTransactions]);

  useEffect(() => {
    if (!isVisible || !fileName || !pageNumber) return;
    let cancelled = false;
    let loadedDoc = null;

    async function render() {
      setRendering(true);
      setError(null);
      try {
        if (renderTaskRef.current) {
          const prev = renderTaskRef.current;
          renderTaskRef.current = null;
          try {
            prev.cancel();
            await prev.promise.catch(() => {});
          } catch {
            // ignore
          }
        }

        const rawBytes = await loadPdfBytesCached(fileName);
        if (cancelled) return;

        // Pass a fresh slice copy because pdf.js worker transfers the ArrayBuffer
        const loadingTask = pdfjsLib.getDocument({ data: rawBytes.slice(0) });
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy().catch(() => {});
          return;
        }
        loadedDoc = doc;

        const safePage = Math.min(Math.max(1, pageNumber), doc.numPages);
        const page = await doc.getPage(safePage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1.0 });
        setPageSize({ width: baseViewport.width, height: baseViewport.height });

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (cancelled) return;

        // Apply canvas-level privacy redactions (other expenses + confidential data)
        if (hideOtherExpenses || hideConfidentialData) {
          const textContent = await page.getTextContent();
          if (cancelled) return;
          const redactions = computePageRedactions({
            textContent,
            pageTransactions,
            visibleTxIds: visibleTxIdsForRedactor,
            bank: statement?.bank || '',
            paymentMethod: statement?.paymentMethod || '',
            pageWidth: baseViewport.width,
            hideOtherExpenses,
            hideConfidentialData
          });
          drawRedactionsOnCanvas(ctx, redactions, baseViewport, viewport, dpr);
        }
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          console.error('Error renderizando PDF:', err);
          setError(err.message || 'No se pudo mostrar esta página.');
        }
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      if (loadedDoc) {
        loadedDoc.destroy().catch(() => {});
      }
    };
  }, [
    isVisible,
    fileName,
    pageNumber,
    scale,
    hideOtherExpenses,
    hideConfidentialData,
    visibleTxIdsForRedactor,
    pageTransactions,
    statement
  ]);

  const approxWidth = Math.floor(pageSize.width * scale);
  const approxHeight = Math.floor(pageSize.height * scale);

  const auditedCountOnPage = useMemo(() => {
    if (!highlightedTxIds || highlightedTxIds.size === 0) return 0;
    return pageTransactions.filter(
      tx => highlightedTxIds.has(tx.id) || (tx.catalogId && highlightedTxIds.has(tx.catalogId))
    ).length;
  }, [pageTransactions, highlightedTxIds]);

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full">
      {showStatementHeader && (
        <div
          style={{ maxWidth: `${approxWidth}px` }}
          className="w-full mb-2 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                statement?.bank === 'AMEX'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              }`}
            >
              {statement?.bank || 'PDF'} · {statement?.paymentMethod === 'credito' ? 'Crédito' : 'Débito'}
            </span>
            <span className="text-xs font-bold text-white">
              {statement?.accountName} — {statement?.periodLabel || fileName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {auditedCountOnPage > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {auditedCountOnPage} {auditedCountOnPage === 1 ? 'cargo subrayado' : 'cargos subrayados'}
              </span>
            )}
            <span className="text-xs font-mono text-neutral-400">
              Página {pageNumber} {statement?.numPages ? `de ${statement.numPages}` : ''}
            </span>
          </div>
        </div>
      )}

      {!isVisible ? (
        <div
          style={{ width: `${approxWidth}px`, height: `${approxHeight}px` }}
          className="bg-neutral-900/60 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-500 text-xs"
        >
          Cargando página {pageNumber}...
        </div>
      ) : error ? (
        <div className="bg-red-950/30 border border-red-800/50 text-red-300 p-6 rounded-xl max-w-md text-center my-6">
          <p className="font-semibold mb-1">No se pudo mostrar la página {pageNumber}</p>
          <p className="text-xs text-red-400">{error}</p>
        </div>
      ) : (
        <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden border border-neutral-700 bg-white">
          <canvas ref={canvasRef} className="block" />

          {rendering && (
            <div className="absolute inset-0 bg-neutral-950/35 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-neutral-900/90 border border-neutral-700 px-3 py-1.5 rounded-full text-xs text-neutral-200 flex items-center gap-2 shadow-lg">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-400" />
                <span>Renderizando página {pageNumber}...</span>
              </div>
            </div>
          )}

          {/* Interactive Underlines & Highlights Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {pageTransactions.map((tx) => {
              if (!tx.y) return null;

              const isAuditedMatch = Boolean(
                highlightedTxIds &&
                highlightedTxIds.size > 0 &&
                (highlightedTxIds.has(tx.id) || (tx.catalogId && highlightedTxIds.has(tx.catalogId)))
              );
              const isFocused = Boolean(
                selectedTxId && (tx.id === selectedTxId || tx.catalogId === selectedTxId)
              );

              // If other expenses are hidden, don't render hover boxes over redacted rows!
              if (hideOtherExpenses && !isAuditedMatch && !isFocused) {
                return null;
              }

              const pHeight = tx.pageHeight || pageSize.height || 792;
              const topPt = Math.max(0, pHeight - tx.y - 11.5);
              const boxHeightPt = 15.5;

              const topPct = (topPt / pHeight) * 100;
              const heightPct = (boxHeightPt / pHeight) * 100;

              const cat = tx.bucket ? categoriesMap.get(tx.bucket) : null;
              const accentColor = cat?.color || '#f59e0b';

              // When privacy mode hides running balances on BBVA Débito, stop highlight width before SALDO column (x=470 / 612 ≈ 76.5%)
              const isBbvaDebito = statement?.bank === 'BBVA' && statement?.paymentMethod === 'debito';
              const boxWidthPct = (hideConfidentialData && isBbvaDebito) ? 75.5 : 96;

              return (
                <div
                  key={tx.id || tx.catalogId}
                  id={`pdf-tx-anchor-${tx.id}`}
                  onClick={() => onSelectTransaction(tx)}
                  style={{
                    top: `${topPct}%`,
                    height: `${heightPct}%`,
                    left: '2%',
                    width: `${boxWidthPct}%`,
                    ...(isFocused
                      ? {
                          backgroundColor: 'rgba(245, 158, 11, 0.30)',
                          borderBottom: `3px solid #f59e0b`,
                          boxShadow: '0 0 0 2px #f59e0b, 0 0 18px rgba(245, 158, 11, 0.55)'
                        }
                      : isAuditedMatch
                        ? {
                            backgroundColor: `${accentColor}26`,
                            borderBottom: `2.5px solid ${accentColor}`,
                            boxShadow: `inset 3px 0 0 ${accentColor}`
                          }
                        : {})
                  }}
                  className={`absolute rounded-sm transition-all pointer-events-auto cursor-pointer ${
                    isFocused
                      ? 'z-30'
                      : isAuditedMatch
                        ? 'z-20 hover:brightness-110'
                        : 'z-10 hover:bg-blue-500/15 border border-transparent hover:border-blue-500/50'
                  }`}
                  title={`${cat ? `[${cat.name}] ` : ''}${tx.title || tx.concept} — $${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                >
                  {/* Tag Badge for Focused or Audited Charge */}
                  {(isFocused || isAuditedMatch) && (
                    <div
                      style={{
                        backgroundColor: isFocused ? '#f59e0b' : accentColor,
                        color: '#000'
                      }}
                      className={`absolute right-0 px-2 py-0.5 rounded shadow-md flex items-center gap-1.5 whitespace-nowrap font-bold leading-none ${
                        isFocused
                          ? '-top-6 text-[11px] z-30 ring-2 ring-black/40'
                          : '-top-4 text-[9.5px] opacity-95'
                      }`}
                    >
                      {cat && (
                        <span className="uppercase tracking-wider bg-black/15 px-1 py-0.5 rounded text-[8.5px]">
                          {cat.name}
                        </span>
                      )}
                      <span className="max-w-[210px] truncate">
                        {tx.title || tx.concept}
                      </span>
                      <span className="font-mono">
                        {tx.type === 'cargo' ? '-' : '+'}$
                        {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatementPdfModal({
  isOpen,
  onClose,
  initialTransaction = null,
  initialStatementFile = null,
  initialAuditedCategoryIds = [],
  initialPrivacyMode = false,
  allTransactions = [],
  statements = [],
  categories = [],
  onTitleChange,
  onCategoryChange
}) {
  const [auditedCategoryIds, setAuditedCategoryIds] = useState(() =>
    Array.isArray(initialAuditedCategoryIds) ? initialAuditedCategoryIds : []
  );

  const isCategoryAuditActive = auditedCategoryIds.length > 0;

  // Privacy / Redaction Switch State
  const [privacyMode, setPrivacyMode] = useState(Boolean(initialPrivacyMode));
  const [hideOtherExpenses, setHideOtherExpenses] = useState(Boolean(initialPrivacyMode));
  const [hideConfidentialData, setHideConfidentialData] = useState(Boolean(initialPrivacyMode));

  const toggleMasterPrivacy = () => {
    const next = !privacyMode;
    setPrivacyMode(next);
    setHideOtherExpenses(next);
    setHideConfidentialData(next);
  };

  // Display mode: 'continuous' (all pages with charges across included statements) or 'single' (page-by-page)
  const [viewerLayout, setViewerLayout] = useState(
    initialAuditedCategoryIds && initialAuditedCategoryIds.length > 0 ? 'continuous' : 'single'
  );

  // Filter within continuous audit mode: 'ALL' or a specific fileName
  const [auditStatementFilter, setAuditStatementFilter] = useState('ALL');

  const initialPage = initialTransaction?.page || (initialStatementFile ? 2 : 1);
  const [activeFile, setActiveFile] = useState(
    initialTransaction?.statementFile || initialStatementFile || statements[0]?.fileName || ''
  );
  const [selectedTxId, setSelectedTxId] = useState(initialTransaction?.id || null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 1480 ? 1.12 : 1.28
  );

  const [searchInStmt, setSearchInStmt] = useState('');
  const [filterTypeInStmt, setFilterTypeInStmt] = useState('all');
  const [editingTxId, setEditingTxId] = useState(null);
  const [editingTitleVal, setEditingTitleVal] = useState('');

  const scrollAreaRef = useRef(null);

  const categoriesMap = useMemo(() => {
    const m = new Map();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const statementsMap = useMemo(() => {
    const m = new Map();
    statements.forEach(s => m.set(s.fileName, s));
    return m;
  }, [statements]);

  // All transactions matching the audited categories (across ALL statements)
  const auditedTransactions = useMemo(() => {
    if (!isCategoryAuditActive) return [];
    const catSet = new Set(auditedCategoryIds);
    return allTransactions
      .filter(tx => tx.bucket && catSet.has(tx.bucket) && tx.statementFile)
      .sort((a, b) => {
        const stmtA = statementsMap.get(a.statementFile);
        const stmtB = statementsMap.get(b.statementFile);
        const cutCmp = (stmtA?.cutoffDate || '').localeCompare(stmtB?.cutoffDate || '');
        if (cutCmp !== 0) return cutCmp;
        if ((a.page || 0) !== (b.page || 0)) return (a.page || 0) - (b.page || 0);
        return (b.y || 0) - (a.y || 0);
      });
  }, [allTransactions, auditedCategoryIds, isCategoryAuditActive, statementsMap]);

  const highlightedTxIds = useMemo(() => {
    const s = new Set();
    auditedTransactions.forEach(tx => {
      if (tx.id) s.add(tx.id);
      if (tx.catalogId) s.add(tx.catalogId);
    });
    return s;
  }, [auditedTransactions]);

  // Statements that contain at least 1 transaction in the audited categories
  const includedStatements = useMemo(() => {
    if (!isCategoryAuditActive) return statements;
    const filesWithHits = new Set(auditedTransactions.map(t => t.statementFile));
    return statements.filter(s => filesWithHits.has(s.fileName));
  }, [isCategoryAuditActive, auditedTransactions, statements]);

  // Ordered list of { fileName, statement, pageNumber } pages that contain audited charges
  const continuousAuditPages = useMemo(() => {
    if (!isCategoryAuditActive) return [];
    const seen = new Set();
    const pages = [];

    for (const stmt of includedStatements) {
      if (auditStatementFilter !== 'ALL' && stmt.fileName !== auditStatementFilter) continue;
      const txsInStmt = auditedTransactions.filter(t => t.statementFile === stmt.fileName);
      const pageNums = [...new Set(txsInStmt.map(t => t.page || 1))].sort((a, b) => a - b);
      for (const pNum of pageNums) {
        const key = `${stmt.fileName}::${pNum}`;
        if (!seen.has(key)) {
          seen.add(key);
          pages.push({
            key,
            fileName: stmt.fileName,
            statement: stmt,
            pageNumber: pNum
          });
        }
      }
    }
    return pages;
  }, [isCategoryAuditActive, includedStatements, auditedTransactions, auditStatementFilter]);

  const activeStatement = useMemo(() => {
    return statementsMap.get(activeFile) || includedStatements[0] || null;
  }, [statementsMap, activeFile, includedStatements]);

  const effectiveActiveFile = activeStatement?.fileName || activeFile;
  const numPagesInActive = activeStatement?.numPages || 1;

  // Sidebar transactions: either audited movements (when auditing categories) or all movements of active statement
  const baseSidebarTxs = useMemo(() => {
    if (isCategoryAuditActive) {
      if (viewerLayout === 'continuous') {
        return auditStatementFilter === 'ALL'
          ? auditedTransactions
          : auditedTransactions.filter(t => t.statementFile === auditStatementFilter);
      }
      return auditedTransactions.filter(t => t.statementFile === effectiveActiveFile);
    }

    if (!effectiveActiveFile) return [];
    return allTransactions
      .filter(tx => tx.statementFile === effectiveActiveFile)
      .sort((a, b) => {
        if ((a.page || 0) !== (b.page || 0)) return (a.page || 0) - (b.page || 0);
        return (b.y || 0) - (a.y || 0);
      });
  }, [
    isCategoryAuditActive,
    viewerLayout,
    auditStatementFilter,
    auditedTransactions,
    effectiveActiveFile,
    allTransactions
  ]);

  const filteredSidebarTxs = useMemo(() => {
    return baseSidebarTxs.filter(tx => {
      if (filterTypeInStmt !== 'all' && tx.type !== filterTypeInStmt) return false;
      if (searchInStmt.trim()) {
        const q = searchInStmt.toLowerCase();
        return (
          (tx.title || '').toLowerCase().includes(q) ||
          (tx.concept || '').toLowerCase().includes(q) ||
          String(tx.amount).includes(q)
        );
      }
      return true;
    });
  }, [baseSidebarTxs, filterTypeInStmt, searchInStmt]);

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null;
    return allTransactions.find(t => t.id === selectedTxId) ||
      (initialTransaction?.id === selectedTxId ? initialTransaction : null);
  }, [allTransactions, selectedTxId, initialTransaction]);

  // Audit totals
  const auditTotals = useMemo(() => {
    const source = isCategoryAuditActive ? auditedTransactions : baseSidebarTxs;
    let cargos = 0;
    let abonos = 0;
    source.forEach(t => {
      if (t.type === 'abono') abonos += Number(t.amount || 0);
      else cargos += Number(t.amount || 0);
    });
    return { cargos, abonos, count: source.length };
  }, [isCategoryAuditActive, auditedTransactions, baseSidebarTxs]);

  const toggleCategoryInAudit = (catId) => {
    setAuditedCategoryIds(prev => {
      const exists = prev.includes(catId);
      const next = exists ? prev.filter(id => id !== catId) : [...prev, catId];
      if (next.length > 0) {
        setViewerLayout('continuous');
        setAuditStatementFilter('ALL');
      } else {
        setViewerLayout('single');
      }
      return next;
    });
  };

  const handleSelectTransaction = (tx) => {
    setSelectedTxId(tx.id);
    if (viewerLayout === 'single') {
      if (tx.statementFile && tx.statementFile !== effectiveActiveFile) {
        setActiveFile(tx.statementFile);
      }
      if (tx.page) {
        setCurrentPage(tx.page);
      }
    }

    setTimeout(() => {
      const el = document.getElementById(`pdf-tx-anchor-${tx.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 70);
  };

  // Scroll to initialTransaction when modal opens
  useEffect(() => {
    if (!isOpen || !selectedTxId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`pdf-tx-anchor-${selectedTxId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [isOpen, selectedTxId, viewerLayout]);

  const handleSaveRename = (txId) => {
    if (editingTitleVal.trim() && onTitleChange) {
      onTitleChange(txId, editingTitleVal.trim());
    }
    setEditingTxId(null);
  };

  if (!isOpen) return null;

  const categoriesWithPdfTxs = categories.filter(c =>
    allTransactions.some(tx => tx.bucket === c.id && tx.statementFile)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-1.5 sm:p-3">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-[1800px] h-[96dvh] flex flex-col overflow-hidden shadow-2xl">

        {/* ROW 1: Top Toolbar — Title, Statement/Mode Switcher, Privacy Switch, Zoom & Close */}
        <div className="px-3.5 py-2.5 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-white text-sm whitespace-nowrap">
                {isCategoryAuditActive ? 'Auditoría de Categorías en PDF' : 'Visor de Estado de Cuenta'}
              </span>
            </div>

            {/* Layout Mode Toggle when Auditing Categories */}
            {isCategoryAuditActive && (
              <div className="flex bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setViewerLayout('continuous')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    viewerLayout === 'continuous'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Ver todas las páginas que incluyen cargos de estas categorías seguidas y subrayadas"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Todos los PDFs ({includedStatements.length} PDFs · {continuousAuditPages.length} págs.)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (includedStatements.length > 0 && !includedStatements.some(s => s.fileName === effectiveActiveFile)) {
                      setActiveFile(includedStatements[0].fileName);
                      setCurrentPage(2);
                    }
                    setViewerLayout('single');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    viewerLayout === 'single'
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Página por Página</span>
                </button>
              </div>
            )}

            {/* Statement Dropdown in Single Mode */}
            {viewerLayout === 'single' && (
              <select
                value={effectiveActiveFile}
                onChange={(e) => {
                  setActiveFile(e.target.value);
                  setSelectedTxId(null);
                  setCurrentPage(2);
                }}
                className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2.5 py-1.5 max-w-[340px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(isCategoryAuditActive ? includedStatements : statements).map(s => (
                  <option key={s.fileName} value={s.fileName}>
                    {s.bank} · {s.paymentMethod === 'credito' ? 'Crédito' : 'Débito'} — {s.periodLabel} ({s.txCount} movs)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Right Controls: PRIVACY SWITCH + Page/Zoom + Open + Close */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Master Privacy / Redaction Switch */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all ${
                privacyMode || hideOtherExpenses || hideConfidentialData
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-neutral-800/90 border-neutral-700 text-neutral-300'
              }`}
            >
              <button
                type="button"
                onClick={toggleMasterPrivacy}
                className="flex items-center gap-2 text-xs font-semibold cursor-pointer"
                title="Ocultar sobre el PDF los demás gastos y tus datos confidenciales (nombre, RFC, cuenta, dirección y saldos)"
              >
                {privacyMode || hideOtherExpenses || hideConfidentialData ? (
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                )}
                <span>Modo Privacidad</span>
                <span
                  className={`w-8 h-4 rounded-full relative transition-colors inline-flex items-center p-0.5 ${
                    privacyMode || hideOtherExpenses || hideConfidentialData ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      privacyMode || hideOtherExpenses || hideConfidentialData ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>

              {(privacyMode || hideOtherExpenses || hideConfidentialData) && (
                <div className="flex items-center gap-2 pl-2 border-l border-emerald-500/30 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hideOtherExpenses;
                      setHideOtherExpenses(next);
                      setPrivacyMode(next || hideConfidentialData);
                    }}
                    className={`flex items-center gap-1 ${hideOtherExpenses ? 'text-emerald-300 font-semibold' : 'text-neutral-400'}`}
                    title="Ocultar los demás gastos que no son de las categorías seleccionadas"
                  >
                    {hideOtherExpenses ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    <span>Otros gastos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hideConfidentialData;
                      setHideConfidentialData(next);
                      setPrivacyMode(next || hideOtherExpenses);
                    }}
                    className={`flex items-center gap-1 ${hideConfidentialData ? 'text-emerald-300 font-semibold' : 'text-neutral-400'}`}
                    title="Ocultar Nombre, RFC, Dirección, Cuentas/CLABE y Saldos bancarios"
                  >
                    {hideConfidentialData ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    <span>Datos y saldos</span>
                  </button>
                </div>
              )}
            </div>

            {/* Page Switcher (only in single-page mode) */}
            {viewerLayout === 'single' && (
              <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 text-neutral-300 hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-neutral-200 px-1.5 font-mono whitespace-nowrap">
                  Pág. {currentPage}/{numPagesInActive}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(numPagesInActive, p + 1))}
                  disabled={currentPage >= numPagesInActive}
                  className="p-1 text-neutral-300 hover:text-white disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Zoom */}
            <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-1 py-0.5">
              <button
                type="button"
                onClick={() => setScale(s => Math.max(0.75, Number((s - 0.15).toFixed(2))))}
                className="p-1 text-neutral-300 hover:text-white"
                title="Alejar"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-neutral-200 px-1.5 font-mono">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale(s => Math.min(2.2, Number((s + 0.15).toFixed(2))))}
                className="p-1 text-neutral-300 hover:text-white"
                title="Acercar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {viewerLayout === 'single' && activeStatement?.url && (
              <a
                href={activeStatement.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                title="Abrir PDF original sin censura en nueva pestaña"
              >
                <ExternalLink className="w-3.5 h-3.5" /> PDF
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Cerrar visor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ROW 2: Multi-Category Audit Selector Strip */}
        {categoriesWithPdfTxs.length > 0 && (
          <div className="px-3.5 py-2 bg-neutral-900/60 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider shrink-0">
              Subrayar Categorías:
            </span>

            {categoriesWithPdfTxs.map(cat => {
              const selected = auditedCategoryIds.includes(cat.id);
              const count = allTransactions.filter(tx => tx.bucket === cat.id && tx.statementFile).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategoryInAudit(cat.id)}
                  style={
                    selected
                      ? {
                          backgroundColor: `${cat.color || '#f59e0b'}28`,
                          borderColor: cat.color || '#f59e0b',
                          color: '#fff'
                        }
                      : undefined
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ${
                    selected
                      ? 'shadow-sm font-semibold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || '#3b82f6' }}
                  />
                  <span>{cat.name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}

            {isCategoryAuditActive && (
              <button
                type="button"
                onClick={() => {
                  setAuditedCategoryIds([]);
                  setViewerLayout('single');
                }}
                className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 shrink-0 font-medium"
              >
                Limpiar selección
              </button>
            )}
          </div>
        )}

        {/* ROW 3: Included Statements Quick Filter Tabs (when in Continuous Multi-PDF Mode) */}
        {isCategoryAuditActive && viewerLayout === 'continuous' && includedStatements.length > 1 && (
          <div className="px-3.5 py-1.5 bg-neutral-950 border-b border-neutral-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <span className="text-[10px] font-semibold text-neutral-500 uppercase shrink-0 mr-1">
              Estados incluidos:
            </span>
            <button
              type="button"
              onClick={() => setAuditStatementFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                auditStatementFilter === 'ALL'
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              Todos ({includedStatements.length} PDFs)
            </button>
            {includedStatements.map(s => {
              const hits = auditedTransactions.filter(t => t.statementFile === s.fileName).length;
              const active = auditStatementFilter === s.fileName;
              return (
                <button
                  key={s.fileName}
                  type="button"
                  onClick={() => setAuditStatementFilter(s.fileName)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors border ${
                    active
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {s.bank} {s.paymentMethod === 'credito' ? 'Créd.' : 'Déb.'} · {s.periodLabel} ({hits})
                </button>
              );
            })}
          </div>
        )}

        {/* ROW 4: Focused Single Cargo Banner (when a specific movement is selected) */}
        {selectedTx && (
          <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 bg-amber-500 text-black text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                <Crosshair className="w-3 h-3" /> Pág. {selectedTx.page || currentPage}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  {selectedTx.title || selectedTx.concept}
                </p>
                <p className="text-[11px] text-neutral-300 truncate font-mono">
                  {formatFriendlyDate(selectedTx.isoDate, selectedTx.date)} · {selectedTx.bank} {selectedTx.paymentMethod === 'credito' ? 'Crédito' : 'Débito'} · PDF: {selectedTx.concept}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Button to audit this transaction's entire category if not yet auditing it */}
              {selectedTx.bucket && !auditedCategoryIds.includes(selectedTx.bucket) && (
                <button
                  type="button"
                  onClick={() => {
                    setAuditedCategoryIds([selectedTx.bucket]);
                    setViewerLayout('continuous');
                    setAuditStatementFilter('ALL');
                  }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
                >
                  Auditar toda la categoría &ldquo;{categoriesMap.get(selectedTx.bucket)?.name}&rdquo;
                </button>
              )}

              {onCategoryChange && (
                <select
                  value={selectedTx.bucket || ''}
                  onChange={(e) => onCategoryChange(selectedTx.id, e.target.value || null)}
                  className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">Sin Clasificar</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              <span
                className={`text-sm font-extrabold font-mono px-2.5 py-0.5 rounded-lg ${
                  selectedTx.type === 'abono'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {selectedTx.type === 'cargo' ? '-' : '+'}$
                {Number(selectedTx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* MAIN SPLIT BODY: Left Sidebar + Right PDF Feed */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

          {/* Left Sidebar: Movements list with complete readable names */}
          <div className="w-full lg:w-[350px] xl:w-[390px] bg-neutral-900/90 border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col max-h-[32dvh] lg:max-h-none shrink-0">
            <div className="p-3 border-b border-neutral-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  {isCategoryAuditActive
                    ? `Cargos Auditados (${filteredSidebarTxs.length})`
                    : `Movimientos del PDF (${filteredSidebarTxs.length})`}
                </span>
                <div className="text-right font-mono text-xs">
                  {auditTotals.cargos > 0 && (
                    <span className="text-rose-400 font-bold">
                      -${auditTotals.cargos.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {auditTotals.abonos > 0 && (
                    <span className="text-emerald-400 font-bold ml-2">
                      +${auditTotals.abonos.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInStmt}
                    onChange={(e) => setSearchInStmt(e.target.value)}
                    placeholder="Filtrar movimientos..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterTypeInStmt}
                  onChange={(e) => setFilterTypeInStmt(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-300"
                >
                  <option value="all">Todos</option>
                  <option value="cargo">Cargos</option>
                  <option value="abono">Abonos</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredSidebarTxs.map((tx) => {
                const isSelected = tx.id === selectedTxId;
                const cat = tx.bucket ? categoriesMap.get(tx.bucket) : null;
                const isRenamed = Boolean(tx.title && tx.title.trim() !== '' && tx.title !== tx.concept);
                const stmt = statementsMap.get(tx.statementFile);

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleSelectTransaction(tx)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                        : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/60'
                    }`}
                  >
                    {/* Row 1: Bank + Page + Category + Amount */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center flex-wrap gap-1">
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            tx.bank === 'AMEX'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {tx.bank} {tx.paymentMethod === 'credito' ? 'Créd' : 'Déb'}
                        </span>
                        {tx.page && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              isSelected ? 'bg-amber-400 text-black font-bold' : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            Pág. {tx.page}
                          </span>
                        )}
                        {cat && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{
                              backgroundColor: `${cat.color || '#3b82f6'}25`,
                              color: cat.color || '#60a5fa',
                              border: `1px solid ${cat.color || '#3b82f6'}50`
                            }}
                          >
                            {cat.name}
                          </span>
                        )}
                      </div>

                      <span className={`text-xs font-bold font-mono shrink-0 ${tx.type === 'abono' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'cargo' ? '-' : '+'}$
                        {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Row 2: Full Multi-line Title (Never chopped off) */}
                    {editingTxId === tx.id ? (
                      <div className="flex items-center gap-1 my-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitleVal}
                          onChange={e => setEditingTitleVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename(tx.id);
                            if (e.key === 'Escape') setEditingTxId(null);
                          }}
                          autoFocus
                          className="w-full bg-neutral-900 border border-blue-500 rounded px-2 py-0.5 text-xs text-white"
                        />
                        <button onClick={() => handleSaveRename(tx.id)} className="text-emerald-400 p-1">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1 group">
                        <p className={`text-xs font-semibold leading-snug break-words line-clamp-2 ${isSelected ? 'text-amber-300' : 'text-neutral-100'}`}>
                          {tx.title || tx.concept}
                        </p>
                        {onTitleChange && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTxId(tx.id);
                              setEditingTitleVal(tx.title || tx.concept);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-white p-0.5 shrink-0"
                            title="Renombrar gasto"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {isRenamed && (
                      <p className="text-[10px] text-neutral-400 leading-tight break-words line-clamp-2 mt-0.5">
                        PDF: {tx.concept}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1">
                      <span>{formatFriendlyDate(tx.isoDate, tx.date)}</span>
                      {isCategoryAuditActive && stmt && (
                        <span className="truncate max-w-[160px]">{stmt.periodLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredSidebarTxs.length === 0 && (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No hay movimientos que coincidan con el filtro.
                </div>
              )}
            </div>
          </div>

          {/* Right Area: Continuous Multi-PDF Audit Feed OR Single Page Canvas */}
          <div
            ref={scrollAreaRef}
            className="flex-1 bg-neutral-950 overflow-auto p-3 sm:p-6 flex flex-col items-center gap-8"
          >
            {isCategoryAuditActive && viewerLayout === 'continuous' ? (
              continuousAuditPages.length === 0 ? (
                <div className="text-center py-20 text-neutral-400 text-sm">
                  Las categorías seleccionadas aún no tienen movimientos ligados a un PDF.
                </div>
              ) : (
                continuousAuditPages.map((pg, index) => {
                  const pageTxs = allTransactions.filter(
                    tx => tx.statementFile === pg.fileName && tx.page === pg.pageNumber && tx.y
                  );
                  return (
                    <PdfPageCanvasCard
                      key={pg.key}
                      statement={pg.statement}
                      fileName={pg.fileName}
                      pageNumber={pg.pageNumber}
                      scale={scale}
                      pageTransactions={pageTxs}
                      highlightedTxIds={highlightedTxIds}
                      selectedTxId={selectedTxId}
                      categoriesMap={categoriesMap}
                      hideOtherExpenses={hideOtherExpenses}
                      hideConfidentialData={hideConfidentialData}
                      onSelectTransaction={handleSelectTransaction}
                      lazy={index > 1}
                      showStatementHeader={true}
                    />
                  );
                })
              )
            ) : (
              <PdfPageCanvasCard
                key={`${effectiveActiveFile}::${currentPage}`}
                statement={activeStatement}
                fileName={effectiveActiveFile}
                pageNumber={currentPage}
                scale={scale}
                pageTransactions={allTransactions.filter(
                  tx => tx.statementFile === effectiveActiveFile && tx.page === currentPage && tx.y
                )}
                highlightedTxIds={highlightedTxIds}
                selectedTxId={selectedTxId}
                categoriesMap={categoriesMap}
                hideOtherExpenses={hideOtherExpenses}
                hideConfidentialData={hideConfidentialData}
                onSelectTransaction={handleSelectTransaction}
                lazy={false}
                showStatementHeader={true}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
