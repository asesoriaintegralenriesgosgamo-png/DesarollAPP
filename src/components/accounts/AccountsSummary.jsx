import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  AlertTriangle,
  Info,
  AlertCircle,
  Users,
  PieChart as PieIcon,
  ChartLine,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  computeProjectFinancialSummary,
  computePartnerStatus,
  computeBudgetExecution,
  computeAccountBalance,
  computeCashFlow,
  distinctMonedas,
} from "../../lib/accounts/calc";
import {
  fmtMoney,
  fmtMoneyCompact,
} from "../../lib/accounts/format";

export function AccountsSummary({
  partners,
  contributions,
  expenses,
  accounts,
  payees,
  categories,
  transfers,
}) {
  // Detectar monedas en uso; MXN como default
  const monedas = useMemo(() => {
    const m = new Set(["MXN"]);
    distinctMonedas(partners).forEach((x) => m.add(x));
    distinctMonedas(contributions).forEach((x) => m.add(x));
    distinctMonedas(expenses).forEach((x) => m.add(x));
    return [...m];
  }, [partners, contributions, expenses]);

  return (
    <div className="flex flex-col gap-5">
      {monedas.map((moneda) => (
        <CurrencyBlock
          key={moneda}
          moneda={moneda}
          partners={partners}
          contributions={contributions}
          expenses={expenses}
          accounts={accounts}
          categories={categories}
          transfers={transfers}
        />
      ))}
    </div>
  );
}

function CurrencyBlock({
  moneda,
  partners,
  contributions,
  expenses,
  accounts,
  categories,
  transfers,
}) {
  const summary = useMemo(
    () =>
      computeProjectFinancialSummary({
        partners,
        contributions,
        expenses,
        categories,
        accounts,
        moneda,
      }),
    [partners, contributions, expenses, categories, accounts, moneda]
  );

  const partnersMoneda = useMemo(
    () => partners.filter((p) => p.moneda === moneda),
    [partners, moneda]
  );

  // Datos para pie chart de aportaciones por socio
  const pieData = useMemo(() => {
    return partnersMoneda
      .map((p) => {
        const aportado = contributions
          .filter((c) => c.partner_id === p.id && c.moneda === moneda)
          .reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
        return {
          name: p.nombre,
          value: aportado,
          color: p.color || "#78716c",
        };
      })
      .filter((p) => p.value > 0);
  }, [partnersMoneda, contributions, moneda]);

  // Bar chart de presupuesto vs ejecutado por categoría top-level
  const budgetData = useMemo(() => {
    return categories
      .filter((c) => !c.parent_id && c.moneda === moneda)
      .map((c) => {
        const exec = computeBudgetExecution(c, categories, expenses);
        return {
          name: c.nombre.length > 14 ? c.nombre.slice(0, 12) + "…" : c.nombre,
          Presupuesto: Math.round(exec.presupuesto),
          Ejecutado: Math.round(exec.ejecutado),
          color: c.color,
        };
      })
      .filter((b) => b.Presupuesto > 0 || b.Ejecutado > 0);
  }, [categories, expenses, moneda]);

  // Cash flow line chart
  const cashFlowData = useMemo(
    () => computeCashFlow({ contributions, expenses, moneda }),
    [contributions, expenses, moneda]
  );

  // Cuentas bancarias en esta moneda
  const accountsMoneda = accounts.filter((a) => a.moneda === moneda);

  // Status por socio
  const partnerRows = useMemo(
    () =>
      partnersMoneda
        .map((p) => ({
          partner: p,
          status: computePartnerStatus(p, contributions, transfers),
        }))
        .sort((a, b) => b.status.aportado - a.status.aportado),
    [partnersMoneda, contributions, transfers]
  );

  const hasAnyData =
    partners.length > 0 ||
    contributions.length > 0 ||
    expenses.length > 0;

  if (!hasAnyData) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
        <PieIcon className="w-8 h-8 text-stone-300 mx-auto mb-2" />
        <p className="text-sm text-stone-600">
          Aún no hay datos para mostrar. Empieza creando un socio o registrando un egreso.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header de moneda si hay más de una */}
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold text-stone-900">Resumen</h2>
        <span className="text-xs text-stone-500">en {moneda}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={Wallet}
          label="Comprometido"
          value={fmtMoneyCompact(summary.comprometido_total, moneda)}
          sub={`${partnersMoneda.filter((p) => p.activo).length} socio${partnersMoneda.length === 1 ? "" : "s"}`}
        />
        <Kpi
          icon={TrendingUp}
          label="Aportado"
          value={fmtMoneyCompact(summary.aportado_total, moneda)}
          sub={`${summary.porcentaje_aportacion_global.toFixed(1)}% del compromiso`}
          tone="positive"
        />
        <Kpi
          icon={TrendingDown}
          label="Egresado"
          value={fmtMoneyCompact(summary.egresado_total, moneda)}
          sub={summary.por_pagar > 0 ? `+${fmtMoneyCompact(summary.por_pagar, moneda)} programado` : "—"}
          tone="negative"
        />
        <Kpi
          icon={Landmark}
          label="Saldo disponible"
          value={fmtMoneyCompact(summary.saldo_total, moneda)}
          sub={`${accountsMoneda.length} cuenta${accountsMoneda.length === 1 ? "" : "s"}`}
          tone={summary.saldo_total >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Alertas */}
      {summary.alertas.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-2">
            Alertas
          </div>
          <ul className="flex flex-col gap-1.5">
            {summary.alertas.map((a, i) => (
              <Alert key={i} alert={a} />
            ))}
          </ul>
        </div>
      )}

      {/* Socios: progress bars + datos */}
      {partnerRows.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-3">
            <Users className="w-3 h-3" />
            Aportación por socio
          </div>
          <div className="flex flex-col gap-3">
            {partnerRows.map(({ partner, status }) => {
              const pct = Math.min(status.porcentaje_avance, 100);
              return (
                <div key={partner.id}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: partner.color }}
                      />
                      <span className="text-sm text-stone-900 font-medium truncate">{partner.nombre}</span>
                      <span className="text-[10px] text-stone-500">
                        {(status.porcentaje_contractual_actual || 0).toFixed(1)}% contractual
                      </span>
                    </div>
                    <div className="text-xs tabular-nums text-stone-600 shrink-0">
                      <span className="text-stone-900 font-medium">{fmtMoney(status.aportado, partner.moneda)}</span>
                      <span className="text-stone-400"> / {fmtMoney(status.comprometido, partner.moneda)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: partner.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {pieData.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-3">
              <PieIcon className="w-3 h-3" />
              Aportaciones por socio
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtMoney(v, moneda)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {budgetData.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-3">
              <PieIcon className="w-3 h-3" />
              Presupuesto vs ejecutado
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={budgetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" stroke="#78716c" fontSize={11} />
                <YAxis
                  stroke="#78716c"
                  fontSize={11}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                />
                <Tooltip formatter={(v) => fmtMoney(v, moneda)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Presupuesto" fill="#a8a29e" />
                <Bar dataKey="Ejecutado" fill="#0891b2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {cashFlowData.length > 1 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-3">
            <ChartLine className="w-3 h-3" />
            Flujo acumulado
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="fecha" stroke="#78716c" fontSize={11} />
              <YAxis
                stroke="#78716c"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip formatter={(v) => fmtMoney(v, moneda)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="aportaciones_acum" name="Aportaciones" stroke="#059669" strokeWidth={2} />
              <Line type="monotone" dataKey="egresos_acum" name="Egresos" stroke="#dc2626" strokeWidth={2} />
              <Line type="monotone" dataKey="saldo" name="Saldo neto" stroke="#0891b2" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cuentas bancarias compactas */}
      {accountsMoneda.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-3">
            <Landmark className="w-3 h-3" />
            Cuentas
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {accountsMoneda.map((a) => {
              const saldo = computeAccountBalance(a, contributions, expenses);
              return (
                <div
                  key={a.id}
                  className="bg-stone-50 border border-stone-100 rounded-md p-2"
                >
                  <div className="text-xs text-stone-700 truncate">{a.nombre}</div>
                  <div
                    className={`text-sm font-semibold tabular-nums ${
                      saldo >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {fmtMoney(saldo, a.moneda)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  const color =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
      ? "text-rose-700"
      : "text-stone-900";
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-2">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Alert({ alert }) {
  const cfg = {
    danger: {
      Icon: AlertCircle,
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
    },
    warning: {
      Icon: AlertTriangle,
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    info: {
      Icon: Info,
      bg: "bg-sky-50",
      text: "text-sky-700",
      border: "border-sky-200",
    },
  }[alert.nivel] || {
    Icon: Info,
    bg: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-200",
  };
  const Icon = cfg.Icon;
  return (
    <li
      className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {alert.mensaje}
    </li>
  );
}
