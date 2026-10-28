import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  FileText,
  CreditCard,
  Landmark,
  Search,
  Edit2,
  Check,
  Sparkles,
  Crosshair
} from 'lucide-react';
import { getStatementPdfData } from '../../lib/statementStore';

export default function StatementPdfModal({
  isOpen,
  onClose,
  initialTransaction,
  initialStatementFile,
  allTransactions = [],
  statements = [],
  categories = [],
  onTitleChange,
  onCategoryChange
}) {
  const [activeFile, setActiveFile] = useState(
    initialTransaction?.statementFile || initialStatementFile || ''
  );
  const [selectedTxId, setSelectedTxId] = useState(initialTransaction?.id || null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(initialTransaction?.page || 1);
  const [scale, setScale] = useState(1.35);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [pageViewportSize, setPageViewportSize] = useState({ width: 612, height: 792 });
  const [searchInStmt, setSearchInStmt] = useState('');
  const [filterTypeInStmt, setFilterTypeInStmt] = useState('all');

  // Inline editing inside sidebar
  const [editingTxId, setEditingTxId] = useState(null);
  const [editingTitleVal, setEditingTitleVal] = useState('');

  const canvasRef = useRef(null);
  const highlightRef = useRef(null);
  const pdfScrollContainerRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (initialTransaction) {
      if (initialTransaction.statementFile) {
        setActiveFile(initialTransaction.statementFile);
      }
      setSelectedTxId(initialTransaction.id);
      if (initialTransaction.page) {
        setCurrentPage(initialTransaction.page);
      }
    } else if (initialStatementFile) {
      setActiveFile(initialStatementFile);
      setSelectedTxId(null);
      setCurrentPage(2); // Most statements start movements on page 2
    }
  }, [initialTransaction, initialStatementFile]);

  const activeStatement = useMemo(() => {
    return statements.find(s => s.fileName === activeFile) || null;
  }, [statements, activeFile]);

  const statementTransactions = useMemo(() => {
    if (!activeFile) return [];
    return allTransactions
      .filter(tx => tx.statementFile === activeFile)
      .sort((a, b) => {
        if ((a.page || 0) !== (b.page || 0)) return (a.page || 0) - (b.page || 0);
        return (b.y || 0) - (a.y || 0); // Top to bottom on PDF page
      });
  }, [allTransactions, activeFile]);

  const filteredSidebarTxs = useMemo(() => {
    return statementTransactions.filter(tx => {
      if (filterTypeInStmt !== 'all' && tx.type !== filterTypeInStmt) return false;
      if (searchInStmt.trim()) {
        const q = searchInStmt.toLowerCase();
        const matchTitle = (tx.title || '').toLowerCase().includes(q);
        const matchConcept = (tx.concept || '').toLowerCase().includes(q);
        const matchAmt = String(tx.amount).includes(q);
        return matchTitle || matchConcept || matchAmt;
      }
      return true;
    });
  }, [statementTransactions, filterTypeInStmt, searchInStmt]);

  const selectedTx = useMemo(() => {
    return statementTransactions.find(t => t.id === selectedTxId) ||
      (initialTransaction?.id === selectedTxId ? initialTransaction : null);
  }, [statementTransactions, selectedTxId, initialTransaction]);

  const currentPageTransactions = useMemo(() => {
    return statementTransactions.filter(tx => tx.page === currentPage && tx.y);
  }, [statementTransactions, currentPage]);

  // Load PDF document when activeFile changes
  useEffect(() => {
    if (!isOpen || !activeFile) return;
    let cancelled = false;

    async function loadPdf() {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const source = await getStatementPdfData(activeFile);
        if (!source) {
          throw new Error('No se encontró el archivo PDF del estado de cuenta.');
        }

        const loadingTask = source.type === 'buffer'
          ? pdfjsLib.getDocument({ data: new Uint8Array(source.data.slice(0)) })
          : pdfjsLib.getDocument(source.url);

        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);

        const targetPage = (selectedTx && selectedTx.statementFile === activeFile && selectedTx.page)
          ? Math.min(selectedTx.page, doc.numPages)
          : Math.min(currentPage || 2, doc.numPages);
        setCurrentPage(targetPage);
      } catch (err) {
        if (!cancelled) {
          console.error('Error cargando PDF:', err);
          setPdfError(err.message || 'No se pudo abrir el estado de cuenta PDF.');
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeFile]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !isOpen) return;
    let cancelled = false;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1.0 });
        setPageViewportSize({ width: baseViewport.width, height: baseViewport.height });

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Scroll to highlighted transaction if on this page
        setTimeout(() => {
          if (!cancelled && highlightRef.current) {
            highlightRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 80);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Error renderizando página PDF:', err);
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale, isOpen, selectedTxId]);

  const handleSelectTransaction = (tx) => {
    setSelectedTxId(tx.id);
    if (tx.statementFile && tx.statementFile !== activeFile) {
      setActiveFile(tx.statementFile);
    }
    if (tx.page && tx.page !== currentPage) {
      setCurrentPage(tx.page);
    } else if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSaveRename = (txId) => {
    if (editingTitleVal.trim() && onTitleChange) {
      onTitleChange(txId, editingTitleVal.trim());
    }
    setEditingTxId(null);
  };

  if (!isOpen) return null;

  const bankBadgeColor = activeStatement?.bank === 'AMEX'
    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
    : 'bg-sky-500/20 text-sky-300 border-sky-500/40';

  const methodBadgeColor = activeStatement?.paymentMethod === 'credito'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-[1650px] h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Top Header */}
        <div className="px-4 py-3 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white text-base">Visor de Estado de Cuenta</span>
            </div>

            {/* Selector de Estado de Cuenta */}
            <select
              value={activeFile}
              onChange={(e) => {
                setActiveFile(e.target.value);
                setSelectedTxId(null);
                setCurrentPage(2);
              }}
              className="bg-neutral-800 border border-neutral-700 text-white text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {statements.map(s => (
                <option key={s.fileName} value={s.fileName}>
                  {s.bank} · {s.paymentMethod === 'credito' ? 'Crédito' : 'Débito'} ({s.accountName}) — {s.periodLabel} [{s.txCount} movs]
                </option>
              ))}
            </select>

            {activeStatement && (
              <div className="hidden md:flex items-center gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${bankBadgeColor}`}>
                  {activeStatement.bank}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${methodBadgeColor}`}>
                  {activeStatement.paymentMethod === 'credito' ? (
                    <><CreditCard className="w-3 h-3" /> Crédito</>
                  ) : (
                    <><Landmark className="w-3 h-3" /> Débito</>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Controles de Página y Zoom */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-1 py-0.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 text-neutral-300 hover:text-white disabled:opacity-40"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-neutral-200 px-2 font-medium whitespace-nowrap">
                Pág. {currentPage} / {numPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="p-1 text-neutral-300 hover:text-white disabled:opacity-40"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-1 py-0.5">
              <button
                onClick={() => setScale(s => Math.max(0.75, Number((s - 0.2).toFixed(2))))}
                className="p-1 text-neutral-300 hover:text-white"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-neutral-200 px-2 font-mono">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(s => Math.min(2.2, Number((s + 0.2).toFixed(2))))}
                className="p-1 text-neutral-300 hover:text-white"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {activeStatement?.url && (
              <a
                href={activeStatement.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                title="Abrir PDF original en pestaña nueva"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir PDF
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selected Cargo Banner */}
        {selectedTx && (
          <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center gap-1 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                <Crosshair className="w-3.5 h-3.5" /> Cargo Señalado (Pág. {selectedTx.page || currentPage})
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {selectedTx.title || selectedTx.concept}
                </p>
                <p className="text-xs text-neutral-300 truncate font-mono">
                  {selectedTx.date} ({selectedTx.isoDate}) · PDF: {selectedTx.rawOriginalLine || selectedTx.concept}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Quick Category Selector right in the PDF banner */}
              {onCategoryChange && (
                <select
                  value={selectedTx.bucket || ''}
                  onChange={(e) => onCategoryChange(selectedTx.id, e.target.value || null)}
                  className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">Sin Clasificar</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              <span className={`text-base font-extrabold px-3 py-1 rounded-lg ${
                selectedTx.type === 'abono'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {selectedTx.type === 'cargo' ? '-' : '+'}$
                {Number(selectedTx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>

              {selectedTx.page && selectedTx.page !== currentPage && (
                <button
                  onClick={() => setCurrentPage(selectedTx.page)}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Ir a Pág. {selectedTx.page}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Content: Sidebar + PDF Canvas */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Sidebar: All movements in this statement */}
          <div className="w-full lg:w-[390px] xl:w-[430px] bg-neutral-900/90 border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col max-h-[38vh] lg:max-h-none shrink-0">
            <div className="p-3 border-b border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Movimientos en este Estado ({filteredSidebarTxs.length})
                </span>
                {activeStatement && (
                  <span className="text-xs text-rose-400 font-semibold">
                    Cargos: ${Number(activeStatement.totalCargos || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInStmt}
                    onChange={(e) => setSearchInStmt(e.target.value)}
                    placeholder="Filtrar cargos en este PDF..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterTypeInStmt}
                  onChange={(e) => setFilterTypeInStmt(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-300"
                >
                  <option value="all">Todos</option>
                  <option value="cargo">Cargos (-)</option>
                  <option value="abono">Abonos (+)</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredSidebarTxs.map((tx) => {
                const isSelected = tx.id === selectedTxId;
                const cat = categories.find(c => c.id === tx.bucket);
                const isRenamed = tx.title && tx.title !== tx.concept;

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleSelectTransaction(tx)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow-lg ring-1 ring-amber-400/50'
                        : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editingTxId === tx.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
                            <button
                              onClick={() => handleSaveRename(tx.id)}
                              className="text-emerald-400 p-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className={`text-xs font-semibold truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                              {tx.title || tx.concept}
                            </span>
                            {onTitleChange && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTxId(tx.id);
                                  setEditingTitleVal(tx.title || tx.concept);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-white p-0.5"
                                title="Renombrar gasto"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}

                        {isRenamed && (
                          <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                            PDF: {tx.concept}
                          </p>
                        )}

                        <div className="flex items-center flex-wrap gap-1.5 mt-1">
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {tx.date}
                          </span>
                          {tx.page && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              isSelected ? 'bg-amber-400 text-black font-bold' : 'bg-neutral-800 text-neutral-300'
                            }`}>
                              Pág. {tx.page}
                            </span>
                          )}
                          {cat && (
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded-full font-medium"
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
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${tx.type === 'abono' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.type === 'cargo' ? '-' : '+'}$
                          {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredSidebarTxs.length === 0 && (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No se encontraron movimientos en este estado de cuenta.
                </div>
              )}
            </div>
          </div>

          {/* Right Area: Interactive PDF Canvas with Highlight Overlays */}
          <div
            ref={pdfScrollContainerRef}
            className="flex-1 bg-neutral-950 overflow-auto p-4 sm:p-8 flex justify-center items-start relative"
          >
            {loadingPdf ? (
              <div className="flex flex-col items-center justify-center py-24 text-neutral-400 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                <p className="text-sm">Abriendo estado de cuenta y localizando cargo...</p>
              </div>
            ) : pdfError ? (
              <div className="bg-red-950/30 border border-red-800/50 text-red-300 p-6 rounded-xl max-w-md text-center my-12">
                <p className="font-semibold mb-1">No se pudo mostrar el PDF</p>
                <p className="text-xs text-red-400">{pdfError}</p>
              </div>
            ) : (
              <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden border border-neutral-700 bg-white">
                <canvas ref={canvasRef} className="block" />

                {/* Interactive Highlight Overlays for all transactions on this page */}
                <div className="absolute inset-0 pointer-events-none">
                  {currentPageTransactions.map((tx) => {
                    const pHeight = tx.pageHeight || pageViewportSize.height || 792;
                    // PDF Y is measured from bottom (0) to top (pHeight).
                    // Text sits ~10pt above baseline and ~4pt below baseline.
                    const topPt = Math.max(0, pHeight - tx.y - 12);
                    const hasExtraLines = tx.detailLines && tx.detailLines.length > 0;
                    const boxHeightPt = hasExtraLines ? 26 : 16;

                    const topPct = (topPt / pHeight) * 100;
                    const heightPct = (boxHeightPt / pHeight) * 100;
                    const isTarget = selectedTx && (
                      tx.id === selectedTx.id ||
                      (tx.catalogId && tx.catalogId === selectedTx.catalogId) ||
                      (tx.y === selectedTx.y && Math.abs(tx.amount - selectedTx.amount) < 0.01)
                    );

                    return (
                      <div
                        key={tx.id || tx.catalogId}
                        ref={isTarget ? highlightRef : null}
                        onClick={() => handleSelectTransaction(tx)}
                        style={{
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                          left: '2%',
                          width: '96%'
                        }}
                        className={`absolute rounded transition-all pointer-events-auto cursor-pointer ${
                          isTarget
                            ? 'bg-amber-400/35 border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.65)] z-20 animate-pulse'
                            : 'hover:bg-blue-500/20 border border-transparent hover:border-blue-500/60 z-10'
                        }`}
                        title={`${tx.title || tx.concept} — $${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      >
                        {isTarget && (
                          <div className="absolute -top-7 right-0 bg-amber-500 text-black text-[11px] font-extrabold px-2.5 py-0.5 rounded-md shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                            <span>👉 {tx.title || tx.concept}</span>
                            <span>
                              ({tx.type === 'cargo' ? '-' : '+'}$
                              {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })})
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

        </div>
      </div>
    </div>
  );
}
