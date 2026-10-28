import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { renderCategoryIcon } from './CategoryIcons';
import { Edit2, GripHorizontal } from 'lucide-react';

export default function CategoryBucket({
  category,
  transactions,
  onEditCategory,
  dragHandleListeners,
  dragHandleAttributes,
  children
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: category.id,
  });

  const cargosTotal = transactions
    .filter(tx => tx.type !== 'abono')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const abonosTotal = transactions
    .filter(tx => tx.type === 'abono')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const displayTotal = cargosTotal > 0 ? cargosTotal : abonosTotal;

  return (
    <div
      ref={setNodeRef}
      className={`bg-neutral-900 border rounded-xl flex flex-col overflow-hidden transition-colors ${
        isOver ? 'bg-neutral-800/80 ring-2 ring-blue-500/40' : ''
      }`}
      style={{
        minHeight: '320px',
        maxHeight: '620px',
        borderColor: isOver ? (category.color || '#3b82f6') : '#262626'
      }}
    >
      <div
        className="p-3.5 border-b flex justify-between items-center gap-2 shrink-0"
        style={{
          borderColor: category.color ? `${category.color}40` : '#262626',
          backgroundColor: category.color ? `${category.color}12` : 'transparent'
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          {dragHandleListeners && (
            <div
              className="cursor-grab text-neutral-500 hover:text-white shrink-0"
              {...dragHandleListeners}
              {...dragHandleAttributes}
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
          )}
          {category.icon && (
            <div className="shrink-0">
              {renderCategoryIcon(category.icon, category.color)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-white text-sm truncate" title={category.name}>
                {category.name}
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                {transactions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="font-bold text-sm font-mono text-neutral-200 block">
              ${displayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {cargosTotal > 0 && abonosTotal > 0 && (
              <span className="text-[10px] text-emerald-400 font-mono block">
                +${abonosTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} abonos
              </span>
            )}
          </div>
          <button
            onClick={() => onEditCategory(category)}
            className="text-neutral-500 hover:text-white transition-colors p-1"
            title="Editar Categoría"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2.5 flex-1 overflow-y-auto flex flex-col gap-2">
        {children}
        {transactions.length === 0 && (
          <div className="h-full flex items-center justify-center text-neutral-600 text-xs italic py-8">
            Arrastra gastos aquí
          </div>
        )}
      </div>
    </div>
  );
}
