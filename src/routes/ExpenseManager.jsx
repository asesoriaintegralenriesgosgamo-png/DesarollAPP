import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, useDroppable } from '@dnd-kit/core';
import { Plus, Loader2, BarChart2, LayoutDashboard, X } from 'lucide-react';
import PdfUploader from '../components/expenses/PdfUploader';
import ExpenseCard from '../components/expenses/ExpenseCard';
import CategoryBucket from '../components/expenses/CategoryBucket';
import ControlsBar from '../components/expenses/ControlsBar';
import ExpenseCharts from '../components/expenses/ExpenseCharts';
import { AppShell } from '../components/AppShell';
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
          Todo está clasificado.
        </div>
      )}
    </div>
  );
}

export default function ExpenseManager() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  
  // UI State
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'analytics'
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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
    // Update local state optimistically
    setTransactions(prev => prev.map(tx => 
      tx.id === expenseId ? { ...tx, title: newTitle } : tx
    ));

    try {
      await updatePersonalExpenseTitle(expenseId, newTitle);
    } catch (err) {
      toast.error('Error al actualizar el título');
      // On error, we could revert, but for now just reload
      loadData();
    }
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      } else if (sortBy === 'concept') {
        return a.concept.localeCompare(b.concept);
      } else {
        return (a.date || '').localeCompare(b.date || '');
      }
    });
  }, [transactions, sortBy]);

  const unclassified = sortedTransactions.filter(tx => !tx.bucket);
  const activeTx = transactions.find(tx => tx.id === activeId);

  return (
    <AppShell breadcrumbs={[{ label: 'Gastos', to: '/expenses' }]}>
      <div className="bg-black text-white p-6 md:p-10 font-sans rounded-xl border border-neutral-800 min-h-screen">
        <div className="w-full max-w-[1600px] mx-auto space-y-8">
          
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                Expense Manager
              </h1>
              <p className="text-neutral-400 mt-1">Organiza y visualiza tus estados de cuenta.</p>
            </div>
            
            <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800 self-start md:self-auto">
              <button 
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'board' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
              >
                <LayoutDashboard className="w-4 h-4" /> Clasificación
              </button>
              <button 
                onClick={() => setViewMode('analytics')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'analytics' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
              >
                <BarChart2 className="w-4 h-4" /> Analítica
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
            <ExpenseCharts transactions={transactions} categories={categories} />
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
                      <ExpenseCard key={tx.id} transaction={tx} onTitleChange={handleTitleChange} />
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
                      const catTxs = sortedTransactions.filter(tx => tx.bucket === cat.id);
                      return (
                        <CategoryBucket key={cat.id} category={cat} transactions={catTxs}>
                          {catTxs.map(tx => (
                            <ExpenseCard key={tx.id} transaction={tx} onTitleChange={handleTitleChange} />
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
        </div>
      </div>
    </AppShell>
  );
}
