import React, { useState, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import PdfUploader from '../components/expenses/PdfUploader';
import ExpenseCard from '../components/expenses/ExpenseCard';
import CategoryBucket from '../components/expenses/CategoryBucket';
import ControlsBar from '../components/expenses/ControlsBar';

import { AppShell } from '../components/AppShell';

// Categorías por defecto
const DEFAULT_CATEGORIES = [
  { id: 'cat-groceries', name: 'Supermercado' },
  { id: 'cat-transport', name: 'Transporte' },
  { id: 'cat-dining', name: 'Comida/Restaurantes' },
  { id: 'cat-utilities', name: 'Servicios' },
  { id: 'cat-entertainment', name: 'Entretenimiento' },
];

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
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeId, setActiveId] = useState(null);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'amount', 'concept'

  const handleTransactionsExtracted = (newTxs) => {
    setTransactions((prev) => [...prev, ...newTxs]);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const transactionId = active.id;
    const overId = over.id;

    setTransactions((prev) => 
      prev.map(tx => {
        if (tx.id === transactionId) {
          return { ...tx, bucket: overId === 'unclassified' ? null : overId };
        }
        return tx;
      })
    );
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      } else if (sortBy === 'concept') {
        return a.concept.localeCompare(b.concept);
      } else {
        // Orden original o por fecha básica
        return (a.date || '').localeCompare(b.date || '');
      }
    });
  }, [transactions, sortBy]);

  const unclassified = sortedTransactions.filter(tx => !tx.bucket);
  const activeTx = transactions.find(tx => tx.id === activeId);

  return (
    <AppShell breadcrumbs={[{ label: 'Gastos', to: '/expenses' }]}>
      <div className="bg-black text-white p-6 md:p-10 font-sans rounded-xl border border-neutral-800">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                Expense Manager
              </h1>
              <p className="text-neutral-400 mt-1">Sube tus estados de cuenta y organiza tus gastos arrastrándolos.</p>
            </div>
            {transactions.length > 0 && (
              <div className="bg-neutral-900 rounded-lg p-3 px-6 border border-neutral-800 text-center shadow-lg">
                <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-1">Total Extraído</p>
                <p className="text-2xl font-bold text-white">
                  ${transactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </header>

          {transactions.length === 0 ? (
            <div className="max-w-2xl mx-auto mt-12">
              <PdfUploader onTransactionsExtracted={handleTransactionsExtracted} />
            </div>
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
                  
                  <div className="shrink-0">
                    <ControlsBar sortBy={sortBy} setSortBy={setSortBy} />
                  </div>
                  
                  <UnclassifiedList transactions={unclassified}>
                    {unclassified.map(tx => (
                      <ExpenseCard key={tx.id} transaction={tx} />
                    ))}
                  </UnclassifiedList>
                </div>

                {/* Columna Derecha: Buckets (Categorías) */}
                <div className="xl:col-span-3">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white">Categorías (Buckets)</h2>
                    <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-lg font-medium border border-blue-500/20">
                      <Plus className="w-4 h-4" /> Nueva Categoría
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map(cat => {
                      const catTxs = sortedTransactions.filter(tx => tx.bucket === cat.id);
                      return (
                        <CategoryBucket key={cat.id} category={cat} transactions={catTxs}>
                          {catTxs.map(tx => (
                            <ExpenseCard key={tx.id} transaction={tx} />
                          ))}
                        </CategoryBucket>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DragOverlay>
                {activeId && activeTx ? (
                  <div className="opacity-80 rotate-2 scale-105 transition-transform cursor-grabbing shadow-xl">
                    <ExpenseCard transaction={activeTx} />
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
