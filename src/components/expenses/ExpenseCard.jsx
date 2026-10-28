import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Edit2, Check, X, Crosshair, CreditCard, Landmark, Info } from 'lucide-react';
import { formatFriendlyDate } from '../../lib/statementStore';

const SUBTYPE_BADGES = {
  pago_tdc: { label: 'Pago TDC', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  msi_ajuste: { label: 'Dif. MSI', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  msi_cargo: { label: 'MSI', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  reembolso: { label: 'Reembolso', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  ingreso: { label: 'Abono', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  inversion: { label: 'Inversión', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  comision: { label: 'Comisión', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
};

export default function ExpenseCard({ transaction, onTitleChange, onRightClick, onOpenPdf }) {
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

  const displayTitle = transaction.title || transaction.concept || 'Sin concepto';
  const isCustomTitle = Boolean(
    transaction.title &&
    transaction.title.trim() !== '' &&
    transaction.title.trim() !== (transaction.concept || '').trim()
  );

  const startEditing = (e) => {
    e.stopPropagation();
    setTempTitle(transaction.title || transaction.concept || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (tempTitle.trim() && tempTitle.trim() !== transaction.title) {
      if (onTitleChange) {
        onTitleChange(transaction.id, tempTitle.trim());
      }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempTitle(transaction.title || transaction.concept || '');
    setIsEditing(false);
  };

  const bank = transaction.bank || 'MANUAL';
  const paymentMethod = transaction.paymentMethod || 'debito';
  const hasPdfLink = Boolean(transaction.statementFile);
  const subTypeBadge = SUBTYPE_BADGES[transaction.subType] || null;
  const friendlyDate = formatFriendlyDate(transaction.isoDate, transaction.date);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, containerType: 'inline-size' }}
      className="bg-neutral-800/90 border border-neutral-700/80 rounded-xl p-2.5 shadow-sm hover:border-neutral-500 hover:bg-neutral-800 transition-all group"
      onContextMenu={(e) => {
        if (onRightClick) {
          e.preventDefault();
          onRightClick(transaction);
        }
      }}
      {...attributes}
    >
      {/* Top Row: Grip + Badges (Left) & Amount (Right) */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center flex-wrap gap-1 min-w-0">
          <div
            className="cursor-grab active:cursor-grabbing text-neutral-500 hover:text-white shrink-0 -ml-0.5 p-0.5"
            {...listeners}
            title="Arrastrar a una categoría"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          {bank !== 'MANUAL' ? (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide leading-none ${
                bank === 'AMEX'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              }`}
              title={transaction.accountName || bank}
            >
              {bank}
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-neutral-700/50 text-neutral-300 border-neutral-600 uppercase leading-none">
              Manual
            </span>
          )}

          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 leading-none ${
              paymentMethod === 'credito'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}
          >
            {paymentMethod === 'credito' ? (
              <CreditCard className="w-2.5 h-2.5 shrink-0" />
            ) : (
              <Landmark className="w-2.5 h-2.5 shrink-0" />
            )}
            <span>{paymentMethod === 'credito' ? 'Crédito' : 'Débito'}</span>
          </span>

          {subTypeBadge && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none ${subTypeBadge.cls}`}>
              {subTypeBadge.label}
            </span>
          )}
        </div>

        <span
          className={`text-[13px] font-bold font-mono shrink-0 whitespace-nowrap ${
            transaction.type === 'abono' ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {transaction.type === 'cargo' ? '-' : '+'}$
          {Number(transaction.amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </span>
      </div>

      {/* Middle Row: Full-Width Complete Concept / Custom Title */}
      {isEditing ? (
        <div className="flex items-center gap-1.5 my-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
            className="w-full bg-neutral-950 border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
          />
          <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300 p-1 shrink-0" title="Guardar">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleCancel} className="text-rose-400 hover:text-rose-300 p-1 shrink-0" title="Cancelar">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="pl-1">
          <div className="flex items-start justify-between gap-1.5">
            <p
              className="text-[13px] font-semibold text-neutral-100 leading-snug break-words line-clamp-3 cursor-pointer hover:text-blue-300 transition-colors flex-1"
              title={displayTitle}
              onClick={() => {
                if (hasPdfLink && onOpenPdf) {
                  onOpenPdf(transaction);
                } else if (onRightClick) {
                  onRightClick(transaction);
                }
              }}
            >
              {displayTitle}
            </p>
            <button
              type="button"
              onClick={startEditing}
              className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-white transition-opacity p-0.5 shrink-0 mt-0.5"
              title="Renombrar gasto"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>

          {isCustomTitle && (
            <p
              className="text-[11px] text-neutral-400 leading-tight break-words line-clamp-2 mt-1 bg-neutral-900/70 px-1.5 py-0.5 rounded border border-neutral-700/50"
              title={`Original en PDF: ${transaction.concept}`}
            >
              <span className="text-blue-400 font-medium">PDF:</span> {transaction.concept}
            </p>
          )}
        </div>
      )}

      {/* Bottom Row: Crisp Date + PDF Pointer + Details */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-neutral-700/50 pl-1">
        <span className="text-[11px] text-neutral-400 font-medium whitespace-nowrap" title={`Fecha original: ${transaction.date}`}>
          {friendlyDate}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {hasPdfLink && onOpenPdf && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPdf(transaction);
              }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors whitespace-nowrap"
              title={`Abrir y señalar en PDF (${transaction.statementFile} · Página ${transaction.page || 1})`}
            >
              <Crosshair className="w-2.5 h-2.5 shrink-0" />
              <span>PDF Pág. {transaction.page || 1}</span>
            </button>
          )}

          {onRightClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRightClick(transaction);
              }}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              title="Ver detalles completos"
            >
              <Info className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
