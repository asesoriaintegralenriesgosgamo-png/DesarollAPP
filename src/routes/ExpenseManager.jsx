import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, useDroppable } from '@dnd-kit/core';
import { Plus, Loader2, BarChart2, LayoutDashboard, X, Search, Filter } from 'lucide-react';
import PdfUploader from '../components/expenses/PdfUploader';
import ExpenseCard from '../components/expenses/ExpenseCard';
import CategoryBucket from '../components/expenses/CategoryBucket';
import ControlsBar from '../components/expenses/ControlsBar';
import ExpenseCharts from '../components/expenses/ExpenseCharts';
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
  updatePersonalExpenseTitle
} from '../lib/api/personalExpenses';

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
          Todo está clasificado o no hay coincidencias.
        </div>
      )}
    </div>
  );
}

function parseDateString(dateStr) {
  if (!dateStr) return new Date(0);
  // Amex format: "20 de Febrero"
  const amexMatch = dateStr.match(/(\d{1,2})\s+de\s+([A-Za-z]+)/i);
  if (amexMatch) {
    const day = parseInt(amexMatch[1], 10);
    const monthStr = amexMatch[2].toLowerCase();
    const months = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11,
                     ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
    const month = months[monthStr] !== undefined ? months[monthStr] : 0;
    const year = new Date().getFullYear();
    return new Date(year, month, day);
  }
  
  // BBVA format: "06-ene-2026" or similar
  const bbvaMatch = dateStr.match(/(\d{1,2})-([a-z]{3})-(\d{4})/i);
  if (bbvaMatch) {
    const day = parseInt(bbvaMatch[1], 10);
    const monthStr = bbvaMatch[2].toLowerCase();
    const months = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
    const month = months[monthStr] !== undefined ? months[monthStr] : 0;
    const year = parseInt(bbvaMatch[3], 10);
    return new Date(year, month, day);
  }
  return new Date(0);
}

export default function ExpenseManager() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeId, setActiveId] = useState(null);
  
  // UI State
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'analytics'
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [selectedTxForModal, setSelectedTxForModal] = useState(null);
  
  // Manual Transaction State
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTx, setNewTx] = useState({ concept: '', amount: '', date: '', type: 'cargo' });
  const [isSavingTx, setIsSavingTx] = useState(false);

  // Filters State
  const [sortBy, setSortBy] = useState('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBucket, setFilterBucket] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, exps] = await Promise.all([
        listPersonalCategories(),
        listPersonalExpenses()
      ]);
      setCategories(cats);
      setTransactions(exps.map(e => ({ ...e, bucket: e.category_id })));
    } catch (err) {
      toast.error(err.message || 'Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionsExtracted = async (newTxs) => {
    if (!newTxs.length) return;
    
    const payload = newTxs.map(tx => ({
      user_id: user.id,
      date: tx.date,
      concept: tx.concept,
      amount: tx.amount,
      type: tx.type,
      original_line: tx.originalLine,
      category_id: null
    }));

    try {
      const saved = await insertPersonalExpenses(payload);
      const mapped = saved.map(e => ({ ...e, bucket: e.category_id }));
      setTransactions(prev => [...mapped, ...prev]);
      toast.success(`${saved.length} gastos guardados`);
    } catch (err) {
      toast.error(err.message || 'Error al guardar gastos');
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const transactionId = active.id;
    const overId = over.id; 
    const newCategoryId = overId === 'unclassified' ? null : overId;

    setTransactions((prev) => 
      prev.map(tx => {
        if (tx.id === transactionId) {
          return { ...tx, bucket: newCategoryId };
        }
        return tx;
      })
    );

    try {
      await updatePersonalExpenseCategory(transactionId, newCategoryId);
    } catch (err) {
      toast.error('No se pudo actualizar la categoría');
      loadData();
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
    try {
      await updatePersonalExpenseTitle(expenseId, newTitle);
    } catch (err) {
      toast.error('Error al actualizar el título');
      loadData();
    }
  };

  const submitNewTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.concept || !newTx.amount || !newTx.date) return;

    setIsSavingTx(true);
    try {
      const payload = [{
        user_id: user.id,
        date: newTx.date, // Native YYYY-MM-DD works fine
        concept: newTx.concept,
        title: newTx.concept, // By default set title as concept
        amount: Number(newTx.amount) || 0,
        type: newTx.type,
        original_line: 'Registro manual',
        category_id: null
      }];
      
      const saved = await insertPersonalExpenses(payload);
      const mapped = saved.map(item => ({ ...item, bucket: item.category_id }));
      setTransactions(prev => [...mapped, ...prev]);
      
      toast.success('Registro añadido');
      setIsAddingTransaction(false);
      setNewTx({ concept: '', amount: '', date: '', type: 'cargo' });
    } catch (err) {
      toast.error(err.message || 'Error al guardar el registro');
    } finally {
      setIsSavingTx(false);
    }
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(tx => 
        (tx.concept && tx.concept.toLowerCase().includes(q)) || 
        (tx.title && tx.title.toLowerCase().includes(q))
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

    // 3. Date Range
    if (dateStart || dateEnd) {
      // Local time bounds for user input
      const startMs = dateStart ? new Date(dateStart + "T00:00:00").getTime() : 0;
      const endMs = dateEnd ? new Date(dateEnd + "T23:59:59").getTime() : Infinity;
      
      filtered = filtered.filter(tx => {
        const txTime = parseDateString(tx.date).getTime();
        return txTime >= startMs && txTime <= endMs;
      });
    }

    // 4. Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      } else if (sortBy === 'concept') {
        const strA = a.title || a.concept || '';
        const strB = b.title || b.concept || '';
        return strA.localeCompare(strB);
      } else {
        const timeA = parseDateString(a.date).getTime();
        const timeB = parseDateString(b.date).getTime();
        return timeA - timeB;
      }
    });
  }, [transactions, sortBy, searchQuery, filterBucket, dateStart, dateEnd]);

  const unclassified = filteredAndSortedTransactions.filter(tx => !tx.bucket);
  const activeTx = transactions.find(tx => tx.id === activeId);

  return (
    <AppShell breadcrumbs={[{ label: 'Gastos', to: '/expenses' }]}>
      <div className="bg-black text-white p-6 md:p-10 font-sans rounded-xl border border-neutral-800 min-h-screen">
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          
          <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-neutral-800 pb-6">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                Expense Manager
              </h1>
              <p className="text-neutral-400 mt-1">Organiza y visualiza tus estados de cuenta.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
              
              {/* Buscador Global */}
              <div className="relative flex-1 sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por concepto o título..."
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-1 overflow-x-auto">
                <select 
                  value={filterBucket}
                  onChange={e => setFilterBucket(e.target.value)}
                  className="bg-transparent text-sm text-neutral-300 focus:outline-none cursor-pointer pl-2 pr-1 border-r border-neutral-800"
                >
                  <option value="all" className="bg-neutral-900 text-white">Todas las Categorías</option>
                  <option value="unclassified" className="bg-neutral-900 text-white">Sin Clasificar</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className="bg-neutral-900 text-white">{c.name}</option>
                  ))}
                </select>
                
                <div className="flex items-center gap-1 px-2 text-sm text-neutral-400 whitespace-nowrap">
                  <input 
                    type="date"
                    value={dateStart}
                    onChange={e => setDateStart(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-text w-[110px]"
                    title="Fecha Inicial"
                  />
                  <span>-</span>
                  <input 
                    type="date"
                    value={dateEnd}
                    onChange={e => setDateEnd(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-text w-[110px]"
                    title="Fecha Final"
                  />
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800 shrink-0">
                <button 
                  onClick={() => setViewMode('board')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'board' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                  title="Tablero"
                >
                  <LayoutDashboard className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('analytics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'analytics' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                  title="Analítica"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
              </div>

              {/* Add Record Button */}
              <button 
                onClick={() => setIsAddingTransaction(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
                title="Añadir Registro Manual"
              >
                <Plus className="w-4 h-4" /> Registro
              </button>
            </div>
          </header>

          {loading ? (
             <div className="flex justify-center py-20">
               <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
             </div>
          ) : transactions.length === 0 ? (
            <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
              <p className="text-neutral-400 text-lg">Aún no tienes gastos registrados.</p>
              <PdfUploader onTransactionsExtracted={handleTransactionsExtracted} />
            </div>
          ) : viewMode === 'analytics' ? (
            <ExpenseCharts transactions={filteredAndSortedTransactions} categories={categories} />
          ) : (
            <DndContext 
              collisionDetection={closestCorners} 
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* Columna Izquierda: No clasificados */}
                <div className="xl:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col h-[calc(100vh-200px)] sticky top-6">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-lg font-semibold text-white">No Clasificados</h2>
                    <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2 rounded-full font-bold">
                      {unclassified.length}
                    </span>
                  </div>
                  
                  <div className="shrink-0 mb-4">
                    <PdfUploader onTransactionsExtracted={handleTransactionsExtracted} />
                  </div>

                  <div className="shrink-0 mb-2">
                    <ControlsBar sortBy={sortBy} setSortBy={setSortBy} />
                  </div>
                  
                  <UnclassifiedList transactions={unclassified}>
                    {unclassified.map(tx => (
                      <ExpenseCard key={tx.id} transaction={tx} onTitleChange={handleTitleChange} onRightClick={setSelectedTxForModal} />
                    ))}
                  </UnclassifiedList>
                </div>

                {/* Columna Derecha: Buckets (Categorías) */}
                <div className="xl:col-span-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 className="text-xl font-semibold text-white">Categorías (Buckets)</h2>
                    
                    {isAddingCategory ? (
                      <form onSubmit={submitNewCategory} className="flex items-center gap-2">
                        <input 
                          type="text" 
                          autoFocus
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nombre de categoría"
                          className="bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button 
                          type="submit" 
                          disabled={isSavingCategory || !newCategoryName.trim()}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-lg font-medium border border-blue-500/20"
                      >
                        <Plus className="w-4 h-4" /> Nueva Categoría
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map(cat => {
                      // Solo procesamos las transacciones filtradas para esta categoría.
                      // Ojo, si el filtro global no es 'all' o la categoría actual, 
                      // la categoría podría quedar vacía.
                      const catTxs = filteredAndSortedTransactions.filter(tx => tx.bucket === cat.id);
                      
                      // Si hay un filtro global de bucket y no es éste, ocultamos la categoría entera.
                      if (filterBucket !== 'all' && filterBucket !== cat.id) return null;

                      return (
                        <CategoryBucket key={cat.id} category={cat} transactions={catTxs}>
                          {catTxs.map(tx => (
                            <ExpenseCard key={tx.id} transaction={tx} onTitleChange={handleTitleChange} onRightClick={setSelectedTxForModal} />
                          ))}
                        </CategoryBucket>
                      );
                    })}
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
                  <div className="opacity-80 rotate-2 scale-105 transition-transform cursor-grabbing shadow-xl">
                    <ExpenseCard transaction={activeTx} onTitleChange={handleTitleChange} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Modal de Detalles del Gasto */}
          {selectedTxForModal && (
            <Modal
              title="Detalles del Gasto"
              onClose={() => setSelectedTxForModal(null)}
              size="md"
            >
              <div className="space-y-4 text-stone-800">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase">Concepto Original (PDF)</label>
                  <p className="text-sm font-medium bg-stone-100 p-2 rounded mt-1 break-words">
                    {selectedTxForModal.concept}
                  </p>
                </div>
                {selectedTxForModal.title && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Título Personalizado</label>
                    <p className="text-sm font-medium bg-blue-50 text-blue-900 p-2 rounded mt-1 break-words">
                      {selectedTxForModal.title}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Monto</label>
                    <p className="text-lg font-bold text-stone-900 mt-1">
                      ${Number(selectedTxForModal.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Fecha</label>
                    <p className="text-sm font-medium text-stone-900 mt-1">
                      {selectedTxForModal.date}
                    </p>
                  </div>
                </div>
                {selectedTxForModal.original_line && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase">Texto crudo extraído</label>
                    <p className="text-xs text-stone-600 bg-stone-100 p-2 rounded mt-1 font-mono break-words">
                      {selectedTxForModal.original_line}
                    </p>
                  </div>
                )}
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
                    onChange={e => setNewTx({...newTx, concept: e.target.value})}
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
                        onChange={e => setNewTx({...newTx, amount: e.target.value})}
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
                      onChange={e => setNewTx({...newTx, date: e.target.value})}
                      className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de Movimiento</label>
                  <div className="flex bg-stone-100 rounded-lg p-1 border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setNewTx({...newTx, type: 'cargo'})}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${newTx.type === 'cargo' ? 'bg-white shadow text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Cargo (Gasto)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTx({...newTx, type: 'abono'})}
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

        </div>
      </div>
    </AppShell>
  );
}
