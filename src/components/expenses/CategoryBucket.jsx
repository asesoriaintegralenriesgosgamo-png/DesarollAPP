import { useDroppable } from '@dnd-kit/core';
import { renderCategoryIcon } from './CategoryIcons';
import { Edit2, GripHorizontal, FileSearch, CheckSquare, Square } from 'lucide-react';

export default function CategoryBucket({
  category,
  transactions,
  onEditCategory,
  isSelectedForAudit = false,
  onToggleSelectAudit,
  onAuditCategoryPdf,
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
  const linkedPdfCount = new Set(transactions.map(t => t.statementFile).filter(Boolean)).size;

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: transactions.length === 0 ? '180px' : '300px',
        maxHeight: '640px',
        containerType: 'inline-size',
        borderColor: isSelectedForAudit
          ? '#f59e0b'
          : isOver
            ? (category.color || '#3b82f6')
            : '#262626'
      }}
      className={`bg-neutral-900 border rounded-2xl flex flex-col overflow-hidden transition-all ${
        isSelectedForAudit
          ? 'ring-2 ring-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
          : isOver
            ? 'bg-neutral-800/80 ring-2 ring-blue-500/40'
            : ''
      }`}
    >
      {/* Spacious Two-Row Header: Never truncates category names on laptops */}
      <div
        className="p-3 border-b shrink-0 space-y-2"
        style={{
          borderColor: category.color ? `${category.color}40` : '#262626',
          backgroundColor: isSelectedForAudit
            ? 'rgba(245, 158, 11, 0.10)'
            : category.color
              ? `${category.color}12`
              : 'transparent'
        }}
      >
        {/* Row 1: Drag + Audit Select Checkbox + Icon + FULL Category Name + Edit */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            {dragHandleListeners && (
              <div
                className="cursor-grab text-neutral-500 hover:text-white shrink-0 mt-0.5"
                {...dragHandleListeners}
                {...dragHandleAttributes}
                title="Reordenar categoría"
              >
                <GripHorizontal className="w-4 h-4" />
              </div>
            )}

            {onToggleSelectAudit && (
              <button
                type="button"
                onClick={() => onToggleSelectAudit(category.id)}
                className={`mt-0.5 shrink-0 transition-colors ${
                  isSelectedForAudit ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'
                }`}
                title={
                  isSelectedForAudit
                    ? 'Quitar categoría de la selección de auditoría'
                    : 'Seleccionar categoría para auditar en estados de cuenta'
                }
              >
                {isSelectedForAudit ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            )}

            {category.icon && (
              <div className="shrink-0 mt-0.5">
                {renderCategoryIcon(category.icon, category.color)}
              </div>
            )}

            <h3
              className="font-bold text-white text-[14px] leading-snug break-words line-clamp-2 flex-1"
              title={category.name}
            >
              {category.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onEditCategory(category)}
            className="text-neutral-500 hover:text-white transition-colors p-1 shrink-0"
            title="Editar Categoría"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2: Movement Count & Audit PDF Button (Left) + Crisp Total (Right) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-800/90 text-neutral-300 border border-neutral-700/60">
              {transactions.length} {transactions.length === 1 ? 'mov.' : 'movs.'}
            </span>

            {linkedPdfCount > 0 && onAuditCategoryPdf && (
              <button
                type="button"
                onClick={() => onAuditCategoryPdf(category.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
                title={`Auditar "${category.name}" en sus ${linkedPdfCount} estados de cuenta con todo subrayado`}
              >
                <FileSearch className="w-3 h-3 shrink-0" />
                <span>Auditar ({linkedPdfCount} PDF{linkedPdfCount === 1 ? '' : 's'})</span>
              </button>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="font-bold text-sm font-mono text-white block leading-tight">
              ${displayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {cargosTotal > 0 && abonosTotal > 0 && (
              <span className="text-[10px] text-emerald-400 font-mono block leading-tight">
                +${abonosTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} abonos
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="p-2.5 flex-1 overflow-y-auto flex flex-col gap-2">
        {children}
        {transactions.length === 0 && (
          <div className="h-full flex items-center justify-center text-neutral-600 text-xs italic py-6">
            Arrastra gastos aquí
          </div>
        )}
      </div>
    </div>
  );
}
