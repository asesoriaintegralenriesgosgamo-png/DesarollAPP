import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';

export default function ExpenseCard({ transaction }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: transaction.id,
    data: transaction
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 shadow-md flex items-center gap-3 cursor-grab hover:bg-neutral-700 transition-colors"
      {...listeners}
      {...attributes}
    >
      <GripVertical className="text-neutral-500 h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate" title={transaction.concept}>
          {transaction.concept}
        </p>
        <p className="text-xs text-neutral-400">{transaction.date}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-white">
          ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
