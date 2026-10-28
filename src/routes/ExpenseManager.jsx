import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, pointerWithin, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Loader2,
  BarChart2,
  LayoutDashboard,
  X,
  Search,
  FileText,
  CreditCard,
  Landmark,
  Crosshair,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  FolderCheck,
  Sparkles
} from 'lucide-react';
import PdfUploader from '../components/expenses/PdfUploader';
import ExpenseCard from '../components/expenses/ExpenseCard';
import CategoryBucket from '../components/expenses/CategoryBucket';
import ControlsBar from '../components/expenses/ControlsBar';
import ExpenseCharts from '../components/expenses/ExpenseCharts';
import StatementPdfModal from '../components/expenses/StatementPdfModal';
import { AppShell } from '../components/AppShell';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  listPersonalCategories,
  listPersonalExpenses,
  insertPersonalExpenses,
  createPersonalCategory,
  updatePersonalExpenseCategory,
  updatePersonalCategory,
  updatePersonalExpenseTitle,
  updatePersonalExpenseFields,
  deletePersonalExpense,
  listDeletedPersonalExpenses,
  restorePersonalExpense,
  hardDeletePersonalExpense,
  reorderPersonalCategories,
  listPersonalExpensePeriods
} from '../lib/api/personalExpenses';
import {
  unpackExpenseRow,
  packOriginalLineWithMeta,
  reconcileAndLinkExpenses,
  getAllCatalogAndUploadedData
} from '../lib/statementStore';
import CategoryEditModal from '../components/expenses/CategoryEditModal';

function SortableCategory({ category, transactions, onEditCategory, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `category-${category.id}`,
    data: { type: 'category', category }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryBucket
        category={category}
        transactions={transactions}
        onEditCategory={onEditCategory}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      >
        {children}
      </CategoryBucket>
    </div>
  );
}

function UnclassifiedList({ transactions, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unclassified',
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto pr-2 pb-4 flex flex-col gap-2 rounded-lg transition-colors ${
        isOver ? 'bg-neutral-800/50' : ''
      }`}
    >
      {children}
      {transactions.length === 0 && (
        <div className="text-center p-8 text-neutral-500 text-sm italic">
          Todo está clasificado o no hay coincidencias con los filtros.
        </div>
      )}
    </div>
  );
}

export default function ExpenseManager() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [syncingStatements, setSyncingStatements] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [deletedTransactions, setDeletedTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [statements, setStatements] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // UI State
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'statements' | 'analytics' | 'trash'
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [selectedTxForModal, setSelectedTxForModal] = useState(null);

  // PDF Statement Viewer Modal State
  const [pdfModalState, setPdfModalState] = useState({
    isOpen: false,
    transaction: null,
    statementFile: null
  });

  // Category Edit State
  const [categoryBeingEdited, setCategoryBeingEdited] = useState(null);

  // Manual Transaction State
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTx, setNewTx] = useState({
    concept: '',
    amount: '',
    date: '',
    type: 'cargo',
    bank: 'MANUAL',
    paymentMethod: 'debito'
  });
  const [isSavingTx, setIsSavingTx] = useState(false);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Filters State
  const [sortBy, setSortBy] = useState('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBucket, setFilterBucket] = useState('all');
  const [filterBank, setFilterBank] = useState('all'); // 'all' | 'AMEX' | 'BBVA'
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all'); // 'all' | 'credito' | 'debito'
  const [filterMovementType, setFilterMovementType] = useState('all'); // 'all' | 'gastos_reales' | 'cargo' | 'abono' | 'pago_tdc' | 'renamed'
  const [filterStatement, setFilterStatement] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    if (user) {
      loadData(true);
    }
  }, [user]);

  const loadData = async (autoReconcile = false) => {
    setLoading(true);
    try {
      const [{ statements: allStmts, transactions: catalogTxs }, cats, exps, deletedExps, perData] = await Promise.all([
        getAllCatalogAndUploadedData(),
        listPersonalCategories(),
        listPersonalExpenses(),
        listDeletedPersonalExpenses(),
        listPersonalExpensePeriods()
      ]);

      setCategories(cats);
      setStatements(allStmts);
      setPeriods(perData);

      const unpacked = exps.map(e => unpackExpenseRow(e, catalogTxs));
      const unpackedDeleted = deletedExps.map(e => unpackExpenseRow(e, catalogTxs));

      // Check if we should run automatic reconciliation to link PDFs, remove duplicates, or insert missing movements
      const needsSync =
        autoReconcile &&
        (unpacked.length < catalogTxs.length - unpackedDeleted.length ||
          unpacked.some(tx => !tx.hasMetaPacked && tx.bank !== 'MANUAL'));

      if (needsSync) {
        setSyncingStatements(true);
        const result = await reconcileAndLinkExpenses({
          existingExpenses: exps,
          deletedExpenses: deletedExps,
          userId: user.id,
          insertPersonalExpenses,
          updatePersonalExpenseFields,
          hardDeletePersonalExpense
        });

        setSyncSummary(result.stats);
        const freshExps = await listPersonalExpenses();
        const freshUnpacked = freshExps.map(e => unpackExpenseRow(e, catalogTxs));
        setTransactions(freshUnpacked);
        setDeletedTransactions(unpackedDeleted);
        setSyncingStatements(false);

        if (result.stats.inserted > 0 || result.stats.deduplicated > 0 || result.stats.updated > 0) {
          toast.success(
            `Estados de cuenta vinculados: ${result.stats.totalStatements} PDFs (${result.stats.preservedRenames} nombres personalizados conservados)`
          );
        }
      } else {
        setTransactions(unpacked);
        setDeletedTransactions(unpackedDeleted);
      }
    } catch (err) {
      toast.error(err.message || 'Error al cargar gastos');
      setSyncingStatements(false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualReconcile = async () => {
    if (!user || syncingStatements) return;
    setSyncingStatements(true);
    try {
      const [exps, deletedExps, { statements: allStmts, transactions: catalogTxs }] = await Promise.all([
        listPersonalExpenses(),
        listDeletedPersonalExpenses(),
        getAllCatalogAndUploadedData()
      ]);

      const result = await reconcileAndLinkExpenses({
        existingExpenses: exps,
        deletedExpenses: deletedExps,
        userId: user.id,
        insertPersonalExpenses,
        updatePersonalExpenseFields,
        hardDeletePersonalExpense
      });

      setSyncSummary(result.stats);
      setStatements(allStmts);

      const freshExps = await listPersonalExpenses();
      setTransactions(freshExps.map(e => unpackExpenseRow(e, catalogTxs)));
      setDeletedTransactions(deletedExps.map(e => unpackExpenseRow(e, catalogTxs)));

      toast.success(
        `Sincronización completa: ${result.stats.inserted} añadidos, ${result.stats.deduplicated} duplicados limpiados, ${result.stats.preservedRenames} renombrados intactos.`
      );
    } catch (err) {
      toast.error(err.message || 'Error al sincronizar estados de cuenta');
    } finally {
      setSyncingStatements(false);
    }
  };

  const handleTransactionsExtracted = async (newTxs, uploadedStatements = []) => {
    if (uploadedStatements.length > 0) {
      const { statements: refreshedStmts } = await getAllCatalogAndUploadedData();
      setStatements(refreshedStmts);
    }

    if (!newTxs.length) return;

    // Build signatures of existing transactions to avoid duplicates
    const existingSigs = {};
    transactions.forEach(tx => {
      const rawLine = (tx.rawOriginalLine || tx.original_line || '').trim();
      const sig = `${tx.date}|${Number(tx.amount).toFixed(2)}|${tx.type}|${rawLine}`;
      existingSigs[sig] = (existingSigs[sig] || 0) + 1;
    });

    const uniqueNewTxs = [];
    newTxs.forEach(tx => {
      const rawLine = (tx.originalLine || '').trim();
      const sig = `${tx.date}|${Number(tx.amount).toFixed(2)}|${tx.type}|${rawLine}`;
      if (existingSigs[sig] && existingSigs[sig] > 0) {
        existingSigs[sig] -= 1;
      } else {
        uniqueNewTxs.push(tx);
      }
    });

    if (uniqueNewTxs.length === 0) {
      toast.info('El PDF se guardó y todos sus movimientos ya estaban registrados (sin duplicados).');
      return;
    }

    const payload = uniqueNewTxs.map(tx => ({
      user_id: user.id,
      date: tx.date,
      concept: tx.concept,
      title: tx.concept,
      amount: tx.amount,
      type: tx.type,
      original_line: tx.packedOriginalLine || packOriginalLineWithMeta(tx.originalLine, tx),
      category_id: null
    }));

    try {
      const saved = await insertPersonalExpenses(payload);
      const { transactions: catalogTxs } = await getAllCatalogAndUploadedData();
      const mapped = saved.map(e => unpackExpenseRow(e, catalogTxs));
      setTransactions(prev => [...mapped, ...prev]);
      toast.success(`${saved.length} movimientos nuevos guardados y vinculados a su PDF`);
    } catch (err) {
      toast.error(err.message || 'Error al guardar gastos');
    }
  };

  const handleOpenPdfForTransaction = (tx) => {
    setPdfModalState({
      isOpen: true,
      transaction: tx,
      statementFile: tx.statementFile || null
    });
  };

  const handleOpenPdfForStatement = (fileName) => {
    const firstTx = transactions.find(t => t.statementFile === fileName) || null;
    setPdfModalState({
      isOpen: true,
      transaction: firstTx,
      statementFile: fileName
    });
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    if (active.data.current?.type === 'category') {
      if (active.id !== over.id) {
        setCategories((items) => {
          const oldIndex = items.findIndex((i) => `category-${i.id}` === active.id);
          const newIndex = items.findIndex((i) => `category-${i.id}` === over.id);
          const newItems = arrayMove(items, oldIndex, newIndex);

          reorderPersonalCategories(newItems.map(i => i.id)).catch(() => {
            toast.error('Error al guardar el nuevo orden');
          });

          return newItems;
        });
      }
      return;
    }

    const transactionId = active.id;
    const overId = over.id;
    const newCategoryId = overId === 'unclassified' ? null : overId;

    await handleCategoryChange(transactionId, newCategoryId);
  };

  const handleCategoryChange = async (transactionId, newCategoryId) => {
    setTransactions((prev) =>
      prev.map(tx => {
        if (tx.id === transactionId) {
          return { ...tx, bucket: newCategoryId, category_id: newCategoryId };
        }
        return tx;
      })
    );

    try {
      await updatePersonalExpenseCategory(transactionId, newCategoryId);
    } catch (err) {
      toast.error('No se pudo actualizar la categoría');
      loadData(false);
    }
  };

  const submitNewCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSavingCategory(true);
    try {
      const newCat = await createPersonalCategory({ name: newCategoryName.trim(), userId: user.id });
      setCategories(prev => [...prev, newCat]);
      setNewCategoryName('');
      setIsAddingCategory(false);
      toast.success('Categoría creada');
    } catch (err) {
      toast.error(err.message || 'Error al crear categoría');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleTitleChange = async (expenseId, newTitle) => {
    setTransactions(prev => prev.map(tx =>
      tx.id === expenseId ? { ...tx, title: newTitle } : tx
    ));
    if (selectedTxForModal?.id === expenseId) {
      setSelectedTxForModal(prev => prev ? { ...prev, title: newTitle } : null);
    }
    try {
      await updatePersonalExpenseTitle(expenseId, newTitle);
      toast.success('Nombre guardado');
    } catch (err) {
      toast.error('Error al actualizar el título');
      loadData(false);
    }
  };

  const submitNewTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.concept || !newTx.amount || !newTx.date) return;

    setIsSavingTx(true);
    try {
      const meta = {
        bank: newTx.bank || 'MANUAL',
        paymentMethod: newTx.paymentMethod || 'debito',
        accountName: newTx.bank === 'AMEX'
          ? 'Amex Gold Elite'
          : newTx.bank === 'BBVA'
            ? (newTx.paymentMethod === 'credito' ? 'BBVA Tarjeta Oro' : 'BBVA Libretón Premium')
            : 'Registro Manual',
        isoDate: newTx.date
      };

      const payload = [{
        user_id: user.id,
        date: newTx.date,
        concept: newTx.concept,
        title: newTx.concept,
        amount: Number(newTx.amount) || 0,
        type: newTx.type,
        original_line: packOriginalLineWithMeta('Registro manual', meta),
        category_id: null
      }];

      const saved = await insertPersonalExpenses(payload);
      const mapped = saved.map(item => unpackExpenseRow(item));
      setTransactions(prev => [...mapped, ...prev]);

      toast.success('Registro manual añadido');
      setIsAddingTransaction(false);
      setNewTx({ concept: '', amount: '', date: '', type: 'cargo', bank: 'MANUAL', paymentMethod: 'debito' });
    } catch (err) {
      toast.error(err.message || 'Error al guardar el registro');
    } finally {
      setIsSavingTx(false);
    }
  };

  const handleDeleteTransaction = async (expenseId) => {
    if (!window.confirm('¿Estás seguro de que quieres enviar este movimiento a la papelera?')) return;
    setIsDeletingTx(true);
    try {
      await deletePersonalExpense(expenseId);
      setTransactions(prev => prev.filter(tx => tx.id !== expenseId));
      setSelectedTxForModal(null);
      toast.success('Movimiento enviado a la papelera');
      loadData(false);
    } catch (err) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setIsDeletingTx(false);
    }
  };

  // Global metrics for top summary cards
  const globalStats = useMemo(() => {
    let amexCargos = 0;
    let amexCount = 0;
    let bbvaCreditoCargos = 0;
    let bbvaCreditoCount = 0;
    let bbvaDebitoGastos = 0;
    let bbvaDebitoCount = 0;
    let bbvaDebitoPagosTdc = 0;
    let renamedCount = 0;
    let classifiedCount = 0;

    transactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.title && tx.title.trim() !== '' && tx.title.trim() !== (tx.concept || '').trim()) {
        renamedCount++;
      }
      if (tx.bucket) {
        classifiedCount++;
      }

      if (tx.bank === 'AMEX' && tx.type === 'cargo') {
        amexCargos += amt;
        amexCount++;
      } else if (tx.bank === 'BBVA' && tx.paymentMethod === 'credito' && tx.type === 'cargo') {
        bbvaCreditoCargos += amt;
        bbvaCreditoCount++;
      } else if (tx.bank === 'BBVA' && tx.paymentMethod === 'debito' && tx.type === 'cargo') {
        if (tx.subType === 'pago_tdc') {
          bbvaDebitoPagosTdc += amt;
        } else {
          bbvaDebitoGastos += amt;
          bbvaDebitoCount++;
        }
      }
    });

    return {
      amexCargos,
      amexCount,
      bbvaCreditoCargos,
      bbvaCreditoCount,
      bbvaDebitoGastos,
      bbvaDebitoCount,
      bbvaDebitoPagosTdc,
      renamedCount,
      classifiedCount
    };
  }, [transactions]);

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        (tx.concept && tx.concept.toLowerCase().includes(q)) ||
        (tx.title && tx.title.toLowerCase().includes(q)) ||
        (tx.accountName && tx.accountName.toLowerCase().includes(q)) ||
        (tx.statementFile && tx.statementFile.toLowerCase().includes(q)) ||
        String(tx.amount).includes(q)
      );
    }

    // 2. Bucket Filter
    if (filterBucket !== 'all') {
      if (filterBucket === 'unclassified') {
        filtered = filtered.filter(tx => !tx.bucket);
      } else {
        filtered = filtered.filter(tx => tx.bucket === filterBucket);
      }
    }

    // 3. Bank Filter
    if (filterBank !== 'all') {
      filtered = filtered.filter(tx => tx.bank === filterBank);
    }

    // 4. Payment Method Filter (Crédito vs Débito)
    if (filterPaymentMethod !== 'all') {
      filtered = filtered.filter(tx => tx.paymentMethod === filterPaymentMethod);
    }

    // 5. Movement Type / SubType Filter
    if (filterMovementType !== 'all') {
      if (filterMovementType === 'gastos_reales') {
        filtered = filtered.filter(tx => tx.type === 'cargo' && tx.subType !== 'pago_tdc');
      } else if (filterMovementType === 'cargo') {
        filtered = filtered.filter(tx => tx.type === 'cargo');
      } else if (filterMovementType === 'abono') {
        filtered = filtered.filter(tx => tx.type === 'abono');
      } else if (filterMovementType === 'pago_tdc') {
        filtered = filtered.filter(tx => tx.subType === 'pago_tdc');
      } else if (filterMovementType === 'renamed') {
        filtered = filtered.filter(
          tx => tx.title && tx.title.trim() !== '' && tx.title.trim() !== (tx.concept || '').trim()
        );
      }
    }

    // 6. Statement File Filter
    if (filterStatement !== 'all') {
      filtered = filtered.filter(tx => tx.statementFile === filterStatement);
    }

    // 7. Chronological ISO Date Range Filter
    if (dateStart || dateEnd) {
      filtered = filtered.filter(tx => {
        const iso = tx.isoDate || '2026-01-01';
        if (dateStart && iso < dateStart) return false;
        if (dateEnd && iso > dateEnd) return false;
        return true;
      });
    }

    // 8. Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'amount') {
        return Number(b.amount) - Number(a.amount);
      } else if (sortBy === 'concept') {
        const strA = a.title || a.concept || '';
        const strB = b.title || b.concept || '';
        return strA.localeCompare(strB);
      } else {
        const isoA = a.isoDate || '2026-01-01';
        const isoB = b.isoDate || '2026-01-01';
        return isoB.localeCompare(isoA); // Newest first
      }
    });
  }, [
    transactions,
    sortBy,
    searchQuery,
    filterBucket,
    filterBank,
    filterPaymentMethod,
    filterMovementType,
    filterStatement,
    dateStart,
    dateEnd
  ]);

  const unclassified = filteredAndSortedTransactions.filter(tx => !tx.bucket);
  const activeTx = transactions.find(tx => tx.id === activeId);

  const handleRestore = async (id) => {
    try {
      await restorePersonalExpense(id);
      toast.success('Movimiento restaurado');
      loadData(false);
    } catch (err) {
      toast.error('Error al restaurar');
    }
  };

  const handleHardDelete = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar este movimiento definitivamente? Esta acción no se puede deshacer.')) return;
    try {
      await hardDeletePersonalExpense(id);
      toast.success('Movimiento eliminado permanentemente');
      loadData(false);
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const getDaysLeft = (deletedAt) => {
    if (!deletedAt) return 0;
    const deletedDate = new Date(deletedAt);
    const expirationDate = new Date(deletedDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = expirationDate - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const validDeletedTxs = deletedTransactions.filter(tx => getDaysLeft(tx.deleted_at) > 0);

  const hasActiveFilters =
    filterBucket !== 'all' ||
    filterBank !== 'all' ||
    filterPaymentMethod !== 'all' ||
    filterMovementType !== 'all' ||
    filterStatement !== 'all' ||
    Boolean(dateStart) ||
    Boolean(dateEnd) ||
    Boolean(searchQuery.trim());

  const clearAllFilters = () => {
    setFilterBucket('all');
    setFilterBank('all');
    setFilterPaymentMethod('all');
    setFilterMovementType('all');
    setFilterStatement('all');
    setDateStart('');
    setDateEnd('');
    setSearchQuery('');
  };

  const formatMoney = (n) =>
    `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppShell breadcrumbs={[{ label: 'Gastos y Estados de Cuenta', to: '/expenses' }]}>
      <div className="bg-black text-white p-4 md:p-8 font-sans rounded-xl border border-neutral-800 min-h-screen">
        <div className="w-full mx-auto space-y-6">

          {/* Top Header */}
          <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">
                  Control de Gastos y Estados de Cuenta
                </h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {statements.length} PDFs Guardados · {transactions.length} Movimientos
                </span>
              </div>
              <p className="text-neutral-400 text-sm mt-1">
                Haz clic en <span className="text-amber-300 font-medium">PDF Pág. X</span> en cualquier cargo para abrir su estado de cuenta y señalar el renglón exacto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Mode Switcher */}
              <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800">
                <button
                  onClick={() => setViewMode('board')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    viewMode === 'board'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Tablero</span>
                </button>
                <button
                  onClick={() => setViewMode('statements')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    viewMode === 'statements'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Estados de Cuenta ({statements.length})</span>
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    viewMode === 'analytics'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Analítica</span>
                </button>
                <button
                  onClick={() => setViewMode('trash')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    viewMode === 'trash'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Papelera"
                >
                  <span>Papelera ({validDeletedTxs.length})</span>
                </button>
              </div>

              {/* Re-sync button */}
              <button
                onClick={handleManualReconcile}
                disabled={syncingStatements}
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                title="Vincular todos los gastos con los 28 PDFs sin perder nombres ni categorías"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingStatements ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
                <span>{syncingStatements ? 'Vinculando...' : 'Verificar Vínculos PDF'}</span>
              </button>

              {/* Manual Record Button */}
              <button
                onClick={() => setIsAddingTransaction(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Registro Manual
              </button>
            </div>
          </header>

          {/* Interactive Bank & Credit/Debit Quick-Filter KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {/* Todos */}
            <button
              type="button"
              onClick={() => {
                setFilterBank('all');
                setFilterPaymentMethod('all');
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                filterBank === 'all' && filterPaymentMethod === 'all'
                  ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/30'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  Vista General
                </span>
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {transactions.length} movs.
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {globalStats.renamedCount} renombrados · {globalStats.classifiedCount} con categoría
              </p>
            </button>

            {/* AMEX Crédito */}
            <button
              type="button"
              onClick={() => {
                if (filterBank === 'AMEX') {
                  setFilterBank('all');
                  setFilterPaymentMethod('all');
                } else {
                  setFilterBank('AMEX');
                  setFilterPaymentMethod('credito');
                }
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                filterBank === 'AMEX'
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-indigo-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  AMEX · Crédito
                </span>
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {formatMoney(globalStats.amexCargos)}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {globalStats.amexCount} cargos · Amex Gold Elite (8 PDFs)
              </p>
            </button>

            {/* BBVA Crédito */}
            <button
              type="button"
              onClick={() => {
                if (filterBank === 'BBVA' && filterPaymentMethod === 'credito') {
                  setFilterBank('all');
                  setFilterPaymentMethod('all');
                } else {
                  setFilterBank('BBVA');
                  setFilterPaymentMethod('credito');
                }
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                filterBank === 'BBVA' && filterPaymentMethod === 'credito'
                  ? 'bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/40'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  BBVA · Crédito
                </span>
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {formatMoney(globalStats.bbvaCreditoCargos)}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {globalStats.bbvaCreditoCount} cargos · BBVA Tarjeta Oro (10 PDFs)
              </p>
            </button>

            {/* BBVA Débito */}
            <button
              type="button"
              onClick={() => {
                if (filterBank === 'BBVA' && filterPaymentMethod === 'debito') {
                  setFilterBank('all');
                  setFilterPaymentMethod('all');
                } else {
                  setFilterBank('BBVA');
                  setFilterPaymentMethod('debito');
                }
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                filterBank === 'BBVA' && filterPaymentMethod === 'debito'
                  ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  BBVA · Débito
                </span>
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {formatMoney(globalStats.bbvaDebitoGastos)}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {globalStats.bbvaDebitoCount} gastos directos · Libretón (10 PDFs)
              </p>
            </button>

            {/* Biblioteca de Estados de Cuenta */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'statements' ? 'board' : 'statements')}
              className={`text-left p-4 rounded-2xl border transition-all ${
                viewMode === 'statements'
                  ? 'bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/40'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  Biblioteca PDF
                </span>
                <FolderCheck className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-bold text-white">
                {statements.length} Estados
              </p>
              <p className="text-[11px] text-amber-300/90 mt-0.5">
                Ver estados de cuenta y subir nuevos →
              </p>
            </button>
          </div>

          {/* Comprehensive Filter Bar */}
          {viewMode !== 'trash' && (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre renombrado, concepto PDF, monto..."
                  className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Banco */}
              <select
                value={filterBank}
                onChange={e => setFilterBank(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos los Bancos</option>
                <option value="AMEX">AMEX (American Express)</option>
                <option value="BBVA">BBVA México</option>
              </select>

              {/* Crédito vs Débito */}
              <select
                value={filterPaymentMethod}
                onChange={e => setFilterPaymentMethod(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Crédito y Débito</option>
                <option value="credito">Solo Tarjeta de Crédito</option>
                <option value="debito">Solo Tarjeta de Débito</option>
              </select>

              {/* Tipo de Movimiento */}
              <select
                value={filterMovementType}
                onChange={e => setFilterMovementType(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todos los Movimientos</option>
                <option value="gastos_reales">Gastos Reales (Sin Pagos TDC)</option>
                <option value="cargo">Todos los Cargos (-)</option>
                <option value="abono">Solo Abonos / Depósitos (+)</option>
                <option value="pago_tdc">Solo Pagos a Tarjetas (TDC)</option>
                <option value="renamed">Solo Gastos Renombrados ({globalStats.renamedCount})</option>
              </select>

              {/* Estado de Cuenta específico */}
              <select
                value={filterStatement}
                onChange={e => setFilterStatement(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500 max-w-[230px]"
              >
                <option value="all">Todos los Estados de Cuenta ({statements.length})</option>
                {statements.map(s => (
                  <option key={s.fileName} value={s.fileName}>
                    {s.bank} {s.paymentMethod === 'credito' ? 'Crédito' : 'Débito'} · {s.periodLabel} ({s.fileName})
                  </option>
                ))}
              </select>

              {/* Categoría */}
              <select
                value={filterBucket}
                onChange={e => setFilterBucket(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Todas las Categorías</option>
                <option value="unclassified">Sin Clasificar</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Rango de Fechas */}
              <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-400">
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="bg-transparent text-neutral-200 focus:outline-none w-[110px]"
                  title="Fecha Inicial"
                />
                <span>—</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="bg-transparent text-neutral-200 focus:outline-none w-[110px]"
                  title="Fecha Final"
                />
              </div>

              {filterStatement !== 'all' && (
                <button
                  onClick={() => handleOpenPdfForStatement(filterStatement)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Abrir este PDF</span>
                </button>
              )}

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar filtros ({filteredAndSortedTransactions.length})</span>
                </button>
              )}
            </div>
          )}

          {/* Main Content Area */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-neutral-400">
                {syncingStatements
                  ? 'Vinculando los 28 estados de cuenta y conservando tus gastos renombrados...'
                  : 'Cargando gastos y estados de cuenta...'}
              </p>
            </div>
          ) : viewMode === 'statements' ? (
            /* BIBLIOTECA DE ESTADOS DE CUENTA (28 PDFs + Nuevos subidos) */
            <div className="space-y-8">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-1 max-w-2xl">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FolderCheck className="w-6 h-6 text-emerald-400" />
                    Estados de Cuenta Guardados y Vinculados ({statements.length})
                  </h2>
                  <p className="text-sm text-neutral-400">
                    Todos los archivos de tu carpeta <code className="text-neutral-200 bg-neutral-800 px-1.5 py-0.5 rounded text-xs">estados de cuenta</code> están guardados permanentemente y cada uno de sus cargos está ligado a la página y coordenada exacta del PDF. Si subes un nuevo PDF aquí, también quedará guardado en el navegador.
                  </p>
                </div>
                <div className="w-full lg:w-96 shrink-0">
                  <PdfUploader onTransactionsExtracted={handleTransactionsExtracted} />
                </div>
              </div>

              {[
                {
                  title: 'American Express · Gold Elite Credit Card (Crédito)',
                  badge: 'AMEX · Crédito',
                  badgeCls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                  items: statements.filter(s => s.bank === 'AMEX')
                },
                {
                  title: 'BBVA México · Tarjeta Oro (Crédito)',
                  badge: 'BBVA · Crédito',
                  badgeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  items: statements.filter(s => s.bank === 'BBVA' && s.paymentMethod === 'credito')
                },
                {
                  title: 'BBVA México · Libretón Premium (Débito)',
                  badge: 'BBVA · Débito',
                  badgeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                  items: statements.filter(s => s.bank === 'BBVA' && s.paymentMethod === 'debito')
                }
              ].map(group => (
                <div key={group.title} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded border ${group.badgeCls}`}>
                        {group.badge}
                      </span>
                      <span>{group.title}</span>
                    </h3>
                    <span className="text-xs text-neutral-400">{group.items.length} estados de cuenta</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {group.items.map(stmt => {
                      const stmtTxs = transactions.filter(t => t.statementFile === stmt.fileName);
                      const classifiedInStmt = stmtTxs.filter(t => t.bucket).length;
                      const renamedInStmt = stmtTxs.filter(
                        t => t.title && t.title.trim() !== '' && t.title.trim() !== (t.concept || '').trim()
                      ).length;

                      return (
                        <div
                          key={stmt.fileName}
                          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <span className="text-sm font-bold text-white block">
                                  {stmt.periodLabel}
                                </span>
                                <span className="text-[11px] text-neutral-400 font-mono block truncate" title={stmt.fileName}>
                                  Archivo: {stmt.fileName}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 shrink-0">
                                {stmt.numPages} págs.
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs">
                              <div>
                                <span className="text-neutral-500 block text-[10px] uppercase">Cargos ({stmt.cargosCount})</span>
                                <span className="text-rose-400 font-mono font-bold">
                                  {formatMoney(stmt.cargosTotal)}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block text-[10px] uppercase">Abonos ({stmt.abonosCount})</span>
                                <span className="text-emerald-400 font-mono font-bold">
                                  {formatMoney(stmt.abonosTotal)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-neutral-400">
                              <span>{stmtTxs.length} movimientos</span>
                              <span>
                                {classifiedInStmt} clasificados · {renamedInStmt} renombrados
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                            <button
                              onClick={() => handleOpenPdfForStatement(stmt.fileName)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
                            >
                              <Crosshair className="w-3.5 h-3.5" />
                              <span>Abrir y Señalar PDF</span>
                            </button>
                            <button
                              onClick={() => {
                                setFilterStatement(stmt.fileName);
                                setViewMode('board');
                              }}
                              className="py-2 px-3 rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                              title="Ver solo los movimientos de este estado de cuenta en el Tablero"
                            >
                              Filtrar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'trash' ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-bold text-white">Papelera de Reciclaje</h2>
                <span className="text-neutral-400 text-sm ml-2">(Se conservan por 365 días)</span>
              </div>

              {validDeletedTxs.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  La papelera está vacía.
                </div>
              ) : (
                <div className="space-y-3">
                  {validDeletedTxs.map(tx => (
                    <div key={tx.id} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white font-medium">{tx.title || tx.concept}</p>
                        <div className="flex gap-4 text-xs text-neutral-400 mt-1">
                          <span>{tx.date}</span>
                          <span className={tx.type === 'abono' ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                            {tx.type === 'cargo' ? '-' : '+'}{formatMoney(tx.amount)}
                          </span>
                          <span className="text-amber-400">
                            {getDaysLeft(tx.deleted_at)} días restantes
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestore(tx.id)}
                          className="bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Restaurar
                        </button>
                        <button
                          onClick={() => handleHardDelete(tx.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Eliminar Definitivamente
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'analytics' ? (
            <ExpenseCharts
              transactions={filteredAndSortedTransactions}
              categories={categories}
              periods={periods}
              onPeriodsChange={setPeriods}
              onOpenPdf={handleOpenPdfForTransaction}
            />
          ) : (
            <DndContext
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Columna Izquierda: No clasificados */}
                <div className="xl:col-span-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col h-[calc(100vh-180px)] sticky top-6">
                  <div className="flex justify-between items-center mb-3 shrink-0">
                    <div>
                      <h2 className="text-base font-bold text-white">No Clasificados</h2>
                      <p className="text-[11px] text-neutral-400">
                        Arrastra a una categoría o abre su PDF
                      </p>
                    </div>
                    <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full font-bold">
                      {unclassified.length}
                    </span>
                  </div>

                  <div className="shrink-0 mb-3">
                    <PdfUploader onTransactionsExtracted={handleTransactionsExtracted} />
                  </div>

                  <div className="shrink-0 mb-2">
                    <ControlsBar sortBy={sortBy} setSortBy={setSortBy} />
                  </div>

                  <UnclassifiedList transactions={unclassified}>
                    {unclassified.map(tx => (
                      <ExpenseCard
                        key={tx.id}
                        transaction={tx}
                        onTitleChange={handleTitleChange}
                        onRightClick={setSelectedTxForModal}
                        onOpenPdf={handleOpenPdfForTransaction}
                      />
                    ))}
                  </UnclassifiedList>
                </div>

                {/* Columna Derecha: Buckets (Categorías) */}
                <div className="xl:col-span-9">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">Categorías (Buckets)</h2>
                      <p className="text-xs text-neutral-400">
                        Cada gasto muestra su banco (AMEX / BBVA), si fue con Crédito o Débito y el botón para señalarlo en su PDF.
                      </p>
                    </div>

                    {isAddingCategory ? (
                      <form onSubmit={submitNewCategory} className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nombre de categoría"
                          className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={isSavingCategory || !newCategoryName.trim()}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                          className="p-2 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setIsAddingCategory(true)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-3.5 py-2 rounded-xl font-semibold border border-blue-500/20"
                      >
                        <Plus className="w-4 h-4" /> Nueva Categoría
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    <SortableContext
                      items={categories.map(c => `category-${c.id}`)}
                      strategy={rectSortingStrategy}
                    >
                      {categories.map(cat => {
                        const catTxs = filteredAndSortedTransactions.filter(tx => tx.bucket === cat.id);
                        if (filterBucket !== 'all' && filterBucket !== cat.id) return null;

                        return (
                          <SortableCategory
                            key={cat.id}
                            category={cat}
                            transactions={catTxs}
                            onEditCategory={setCategoryBeingEdited}
                          >
                            {catTxs.map(tx => (
                              <ExpenseCard
                                key={tx.id}
                                transaction={tx}
                                onTitleChange={handleTitleChange}
                                onRightClick={setSelectedTxForModal}
                                onOpenPdf={handleOpenPdfForTransaction}
                              />
                            ))}
                          </SortableCategory>
                        );
                      })}
                    </SortableContext>
                    {categories.length === 0 && (
                      <div className="col-span-full p-10 text-center border-2 border-dashed border-neutral-800 rounded-xl text-neutral-500">
                        Aún no tienes categorías. Crea una arriba a la derecha.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DragOverlay>
                {activeId && activeTx ? (
                  <div className="opacity-90 rotate-1 scale-105 transition-transform cursor-grabbing shadow-2xl">
                    <ExpenseCard transaction={activeTx} onTitleChange={handleTitleChange} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Modal de Detalles del Gasto */}
          {selectedTxForModal && (
            <Modal
              title="Detalles y Vínculo con Estado de Cuenta"
              onClose={() => setSelectedTxForModal(null)}
              size="md"
            >
              <div className="space-y-4 text-stone-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-stone-900 text-white">
                    {selectedTxForModal.bank || 'MANUAL'}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-stone-200 text-stone-800">
                    {selectedTxForModal.paymentMethod === 'credito' ? 'Tarjeta de Crédito' : 'Tarjeta de Débito'}
                  </span>
                  {selectedTxForModal.accountName && (
                    <span className="text-xs text-stone-600 font-medium">
                      {selectedTxForModal.accountName}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase">Concepto Original (PDF)</label>
                  <p className="text-sm font-medium bg-stone-100 p-2.5 rounded-lg mt-1 break-words">
                    {selectedTxForModal.concept}
                  </p>
                </div>

                {selectedTxForModal.title && selectedTxForModal.title !== selectedTxForModal.concept && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Nombre Personalizado</label>
                    <p className="text-sm font-semibold bg-blue-50 text-blue-900 p-2.5 rounded-lg mt-1 break-words">
                      {selectedTxForModal.title}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Monto</label>
                    <p className="text-lg font-bold text-stone-900 mt-1 font-mono">
                      {selectedTxForModal.type === 'cargo' ? '-' : '+'}
                      {formatMoney(selectedTxForModal.amount)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Fecha</label>
                    <p className="text-sm font-medium text-stone-900 mt-1">
                      {selectedTxForModal.date} ({selectedTxForModal.isoDate})
                    </p>
                  </div>
                </div>

                {selectedTxForModal.statementFile && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-amber-900">
                      <p className="font-bold">Estado de Cuenta: {selectedTxForModal.statementFile}</p>
                      <p>
                        Periodo: {selectedTxForModal.periodLabel || 'N/A'} · Página {selectedTxForModal.page || 1}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const tx = selectedTxForModal;
                        setSelectedTxForModal(null);
                        handleOpenPdfForTransaction(tx);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shrink-0 transition-colors"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Señalar en PDF</span>
                    </button>
                  </div>
                )}

                {selectedTxForModal.rawOriginalLine && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Renglón extraído del PDF</label>
                    <p className="text-xs text-stone-600 bg-stone-100 p-2 rounded-lg mt-1 font-mono break-words">
                      {selectedTxForModal.rawOriginalLine}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-stone-200 flex justify-between gap-2 mt-4">
                  <button
                    onClick={() => handleDeleteTransaction(selectedTxForModal.id)}
                    disabled={isDeletingTx}
                    className="px-4 py-2 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeletingTx ? 'Eliminando...' : 'Enviar a Papelera'}
                  </button>
                  <button
                    onClick={() => setSelectedTxForModal(null)}
                    className="px-4 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Modal para Añadir Registro Manual */}
          {isAddingTransaction && (
            <Modal
              title="Añadir Registro Manual"
              onClose={() => setIsAddingTransaction(false)}
              size="md"
            >
              <form onSubmit={submitNewTransaction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Concepto / Título</label>
                  <input
                    type="text"
                    required
                    value={newTx.concept}
                    onChange={e => setNewTx({ ...newTx, concept: e.target.value })}
                    placeholder="Ej. Supermercado, Sueldo..."
                    className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Monto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newTx.amount}
                        onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      required
                      value={newTx.date}
                      onChange={e => setNewTx({ ...newTx, date: e.target.value })}
                      className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Banco</label>
                    <select
                      value={newTx.bank}
                      onChange={e => setNewTx({ ...newTx, bank: e.target.value })}
                      className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="MANUAL">Efectivo / Manual</option>
                      <option value="AMEX">AMEX</option>
                      <option value="BBVA">BBVA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Método de Pago</label>
                    <select
                      value={newTx.paymentMethod}
                      onChange={e => setNewTx({ ...newTx, paymentMethod: e.target.value })}
                      className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="debito">Débito / Efectivo</option>
                      <option value="credito">Crédito</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de Movimiento</label>
                  <div className="flex bg-stone-100 rounded-lg p-1 border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setNewTx({ ...newTx, type: 'cargo' })}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${newTx.type === 'cargo' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Cargo (Gasto)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTx({ ...newTx, type: 'abono' })}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${newTx.type === 'abono' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Abono (Ingreso)
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTransaction(false)}
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTx}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSavingTx ? 'Guardando...' : 'Guardar Registro'}
                  </button>
                </div>
              </form>
            </Modal>
          )}

          {categoryBeingEdited && (
            <CategoryEditModal
              isOpen={true}
              category={categoryBeingEdited}
              onClose={() => setCategoryBeingEdited(null)}
              onSave={async (updates) => {
                try {
                  const updated = await updatePersonalCategory(categoryBeingEdited.id, updates);
                  setCategories(categories.map(c => c.id === updated.id ? updated : c));
                  setCategoryBeingEdited(null);
                  toast.success('Categoría actualizada');
                } catch (err) {
                  toast.error('Error al actualizar categoría');
                }
              }}
            />
          )}

          {/* Visor PDF Interactivo con Puntero al Cargo */}
          <StatementPdfModal
            isOpen={pdfModalState.isOpen}
            onClose={() => setPdfModalState({ isOpen: false, transaction: null, statementFile: null })}
            initialTransaction={pdfModalState.transaction}
            initialStatementFile={pdfModalState.statementFile}
            allTransactions={transactions}
            statements={statements}
            categories={categories}
            onTitleChange={handleTitleChange}
            onCategoryChange={handleCategoryChange}
          />

        </div>
      </div>
    </AppShell>
  );
}
