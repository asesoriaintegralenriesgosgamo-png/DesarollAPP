import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Edit2, Check, X } from 'lucide-react';

export default function ExpenseCard({ transaction, onTitleChange, onRightClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(transaction.title || transaction.concept);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: transaction.id,
    data: transaction
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  const displayTitle = transaction.title || transaction.concept;
  const isCustomTitle = !!transaction.title && transaction.title !== transaction.concept;

  const handleSave = () => {
    if (tempTitle.trim() && tempTitle.trim() !== transaction.title) {
      if (onTitleChange) {
        onTitleChange(transaction.id, tempTitle.trim());
      }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempTitle(transaction.title || transaction.concept);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 shadow-md flex items-center gap-3 hover:bg-neutral-700 transition-colors group"
      onContextMenu={(e) => {
        if (onRightClick) {
          e.preventDefault();
          onRightClick(transaction);
        }
      }}
      {...attributes}
    >
      <div 
        className="cursor-grab text-neutral-500 hover:text-white shrink-0" 
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
              className="w-full bg-neutral-900 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
            />
            <button onClick={handleSave} className="text-green-400 hover:text-green-300">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate" title={displayTitle}>
                  {displayTitle}
                </p>
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-white transition-opacity shrink-0"
                  title="Editar nombre"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              
              {isCustomTitle && (
                <p className="text-[10px] text-neutral-500 truncate mt-0.5" title={`Original: ${transaction.concept}`}>
                  {transaction.concept}
                </p>
              )}
              <p className="text-xs text-neutral-400 mt-0.5">{transaction.date}</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${transaction.type === 'abono' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {transaction.type === 'cargo' ? '-' : '+'}${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
