import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { renderCategoryIcon } from './CategoryIcons';
import { Edit2, GripHorizontal } from 'lucide-react';

export default function CategoryBucket({ category, transactions, onEditCategory, dragHandleListeners, dragHandleAttributes, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: category.id,
  });

  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div
      ref={setNodeRef}
      className={`bg-neutral-900 border rounded-xl flex flex-col overflow-hidden transition-colors ${
        isOver ? 'bg-neutral-800' : ''
      }`}
      style={{ 
        minHeight: '300px', 
        borderColor: isOver ? (category.color || '#3b82f6') : '#262626'
      }}
    >
      <div 
        className="p-4 border-b flex justify-between items-center"
        style={{ 
          borderColor: category.color ? `${category.color}40` : '#262626',
          backgroundColor: category.color ? `${category.color}10` : 'transparent'
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {dragHandleListeners && (
            <div 
              className="cursor-grab text-neutral-500 hover:text-white shrink-0 mr-1"
              {...dragHandleListeners}
              {...dragHandleAttributes}
            >
              <GripHorizontal className="w-5 h-5" />
            </div>
          )}
          {category.icon && (
            <div className="shrink-0">
              {renderCategoryIcon(category.icon, category.color)}
            </div>
          )}
          <h3 className="font-semibold text-white truncate" title={category.name}>{category.name}</h3>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span className="font-bold text-neutral-300">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <button 
            onClick={() => onEditCategory(category)}
            className="text-neutral-500 hover:text-white transition-colors"
            title="Editar Categoría"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
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
