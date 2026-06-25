import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export default function CategoryBucket({ category, transactions, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: category.id,
  });

  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div
      ref={setNodeRef}
      className={`bg-neutral-900 border rounded-xl flex flex-col overflow-hidden transition-colors ${
        isOver ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-800'
      }`}
      style={{ minHeight: '300px' }}
    >
      <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
        <h3 className="font-semibold text-white truncate" title={category.name}>{category.name}</h3>
        <span className="font-bold text-blue-400 shrink-0 ml-2">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
        {children}
        {transactions.length === 0 && (
          <div className="h-full flex items-center justify-center text-neutral-600 text-sm italic py-8">
            Arrastra gastos aquí
          </div>
        )}
      </div>
    </div>
  );
}
