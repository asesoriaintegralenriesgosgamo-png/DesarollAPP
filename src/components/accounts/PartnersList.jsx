import { useMemo, useState } from "react";
import { Plus, Users, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { computePartnerStatus } from "../../lib/accounts/calc";
import { fmtMoney, fmtMoneyCompact, nextPartnerColor } from "../../lib/accounts/format";
import { PartnerDrawer } from "./PartnerDrawer";

export function PartnersList({
  projectId,
  canEdit,
  userId,
  partners,
  contributions,
  transfers,
  contracts,
  accounts,
  onChanged,
}) {
  const [drawerPartner, setDrawerPartner] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo(
    () =>
      partners.map((p) => ({
        ...p,
        status: computePartnerStatus(p, contributions, transfers),
      })),
    [partners, contributions, transfers]
  );

  const openNew = () => {
    const usedColors = partners.map((p) => p.color).filter(Boolean);
    setDrawerPartner({
      nombre: "",
      tipo_persona: "fisica",
      moneda: "MXN",
      activo: true,
      color: nextPartnerColor(usedColors),
      porcentaje_contractual: 0,
      monto_comprometido: 0,
    });
    setDrawerOpen(true);
  };

  const openEdit = (p) => {
    setDrawerPartner(p);
    setDrawerOpen(true);
  };

  const handleClose = () => {
    setDrawerOpen(false);
    // Small delay to let animation finish before clearing
    setTimeout(() => setDrawerPartner(null), 250);
  };

  if (partners.length === 0) {
    return (
      <>
        <EmptyState
          icon={Users}
          title="Sin socios financieros"
          description="Registra a los socios del proyecto: porcentaje contractual, capital comprometido, datos fiscales y contratos."
          action={
            canEdit && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4" />
                Nuevo socio
              </Button>
            )
          }
        />
        {drawerOpen && (
          <PartnerDrawer
            open={drawerOpen}
            partner={drawerPartner}
            projectId={projectId}
            userId={userId}
            canEdit={canEdit}
            contributions={contributions}
            contracts={contracts}
            accounts={accounts}
            onClose={handleClose}
            onSaved={() => {
              handleClose();
              onChanged?.();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={openNew} size="sm">
              <Plus className="w-3.5 h-3.5" />
              Nuevo socio
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => (
            <PartnerCard
              key={p.id}
              partner={p}
              status={p.status}
              onClick={() => openEdit(p)}
            />
          ))}
        </div>
      </div>

      {drawerOpen && (
        <PartnerDrawer
          open={drawerOpen}
          partner={drawerPartner}
          projectId={projectId}
          userId={userId}
          canEdit={canEdit}
          contributions={contributions}
          contracts={contracts}
          accounts={accounts}
          onClose={handleClose}
          onSaved={() => {
            handleClose();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function PartnerCard({ partner, status, onClick }) {
  const color = partner.color || "#78716c";
  const pct = Math.min(status.porcentaje_avance, 100);

  return (
    <button
      onClick={onClick}
      className="bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-400 hover:shadow-sm transition-all text-left flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ backgroundColor: color }}
          >
            {initials(partner.nombre)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-900 truncate">
              {partner.nombre}
            </div>
            {partner.rol_en_proyecto && (
              <div className="text-[11px] text-stone-500 truncate">
                {partner.rol_en_proyecto}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-stone-500">
            % contractual
          </div>
          <div className="text-base font-semibold text-stone-900 tabular-nums">
            {(status.porcentaje_contractual_actual || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-[11px] text-stone-500 mb-1">
          <span>Aportado</span>
          <span className="tabular-nums text-stone-700">
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Mini label="Comprometido" value={fmtMoneyCompact(status.comprometido, partner.moneda)} />
        <Mini label="Aportado" value={fmtMoneyCompact(status.aportado, partner.moneda)} tone="positive" />
        <Mini label="Falta" value={fmtMoneyCompact(status.faltante, partner.moneda)} tone={status.faltante > 0 ? "warn" : "neutral"} />
      </div>

      <div className="flex items-center justify-between text-[11px] text-stone-500">
        <span>{status.numero_aportaciones} aportación{status.numero_aportaciones === 1 ? "" : "es"}</span>
        <span className="inline-flex items-center gap-1 text-stone-600">
          Ver detalle <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

function Mini({ label, value, tone }) {
  const color =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : "text-stone-900";
  return (
    <div className="bg-stone-50 border border-stone-100 rounded px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`text-xs font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
