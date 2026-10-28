import { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceArea
} from 'recharts';
import { Plus, Trash2, Crosshair, CreditCard, Landmark, TrendingUp, Filter } from 'lucide-react';
import { createPersonalExpensePeriod, deletePersonalExpensePeriod } from '../../lib/api/personalExpenses';

const COLORS = ['#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#14b8a6', '#06b6d4'];

const MONTH_LABELS = {
  '2025-11': 'Nov 2025',
  '2025-12': 'Dic 2025',
  '2026-01': 'Ene 2026',
  '2026-02': 'Feb 2026',
  '2026-03': 'Mar 2026',
  '2026-04': 'Abr 2026',
  '2026-05': 'May 2026',
  '2026-06': 'Jun 2026',
  '2026-07': 'Jul 2026',
  '2026-08': 'Ago 2026',
  '2026-09': 'Sep 2026',
  '2026-10': 'Oct 2026',
  '2026-11': 'Nov 2026',
  '2026-12': 'Dic 2026'
};

export default function ExpenseCharts({
  transactions,
  categories,
  periods = [],
  onPeriodsChange,
  onOpenPdf
}) {
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ name: '', start_date: '', end_date: '', color: '#ef4444' });
  const [analysisMode, setAnalysisMode] = useState('gastos_reales'); // 'gastos_reales' | 'todos_cargos' | 'abonos'

  const handleAddPeriod = async (e) => {
    e.preventDefault();
    if (!newPeriod.name || !newPeriod.start_date || !newPeriod.end_date) return;

    try {
      const added = await createPersonalExpensePeriod(newPeriod);
      if (onPeriodsChange) {
        onPeriodsChange([...periods, added]);
      }
      setIsAddingPeriod(false);
      setNewPeriod({ name: '', start_date: '', end_date: '', color: '#ef4444' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePeriod = async (id) => {
    try {
      await deletePersonalExpensePeriod(id);
      if (onPeriodsChange) {
        onPeriodsChange(periods.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Global summary across all passed transactions (before analysisMode filter)
  const globalBreakdown = useMemo(() => {
    const summary = {
      amexCreditoCargos: 0,
      amexCreditoCount: 0,
      bbvaCreditoCargos: 0,
      bbvaCreditoCount: 0,
      bbvaDebitoGastosReales: 0,
      bbvaDebitoGastosCount: 0,
      bbvaDebitoPagosTdc: 0,
      bbvaDebitoIngresos: 0,
      totalCredito: 0,
      totalDebitoReal: 0
    };

    transactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.bank === 'AMEX') {
        if (tx.type === 'cargo') {
          summary.amexCreditoCargos += amt;
          summary.amexCreditoCount++;
        }
      } else if (tx.bank === 'BBVA' && tx.paymentMethod === 'credito') {
        if (tx.type === 'cargo') {
          summary.bbvaCreditoCargos += amt;
          summary.bbvaCreditoCount++;
        }
      } else if (tx.bank === 'BBVA' && tx.paymentMethod === 'debito') {
        if (tx.type === 'cargo') {
          if (tx.subType === 'pago_tdc' || tx.subType === 'inversion') {
            if (tx.subType === 'pago_tdc') summary.bbvaDebitoPagosTdc += amt;
          } else {
            summary.bbvaDebitoGastosReales += amt;
            summary.bbvaDebitoGastosCount++;
          }
        } else if (tx.type === 'abono' && tx.subType !== 'inversion') {
          summary.bbvaDebitoIngresos += amt;
        }
      }
    });

    summary.totalCredito = summary.amexCreditoCargos + summary.bbvaCreditoCargos;
    summary.totalDebitoReal = summary.bbvaDebitoGastosReales;
    return summary;
  }, [transactions]);

  // Scoped transactions according to analysisMode
  const scopedTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (analysisMode === 'gastos_reales') {
        return tx.type === 'cargo' && tx.subType !== 'pago_tdc' && tx.subType !== 'inversion' && tx.subType !== 'msi_ajuste';
      }
      if (analysisMode === 'todos_cargos') {
        return tx.type === 'cargo';
      }
      if (analysisMode === 'abonos') {
        return tx.type === 'abono';
      }
      return true;
    });
  }, [transactions, analysisMode]);

  const { pieData, barData, monthlyBankData, topExpenses } = useMemo(() => {
    // 1. Pie Chart Data by Category
    const categoryTotals = {};
    let unclassifiedTotal = 0;

    scopedTransactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.bucket) {
        if (!categoryTotals[tx.bucket]) {
          const cat = categories.find(c => c.id === tx.bucket);
          categoryTotals[tx.bucket] = {
            name: cat ? cat.name : 'Desconocido',
            value: 0
          };
        }
        categoryTotals[tx.bucket].value += amount;
      } else {
        unclassifiedTotal += amount;
      }
    });

    const pData = Object.values(categoryTotals).sort((a, b) => b.value - a.value);
    if (unclassifiedTotal > 0) {
      pData.push({ name: 'Sin Clasificar', value: unclassifiedTotal });
    }

    // 2. Chronological Daily Timeline Data (using isoDate YYYY-MM-DD)
    const dateTotals = {};
    scopedTransactions.forEach(tx => {
      const iso = tx.isoDate || '2026-01-01';
      if (!dateTotals[iso]) {
        dateTotals[iso] = { date: iso, amount: 0 };
      }

      const amount = Number(tx.amount) || 0;
      dateTotals[iso].amount += amount;

      const catKey = tx.bucket || 'unclassified';
      dateTotals[iso][catKey] = (dateTotals[iso][catKey] || 0) + amount;
    });

    const bData = Object.values(dateTotals).sort((a, b) => a.date.localeCompare(b.date));

    // 3. Monthly Evolution by Bank & Payment Method
    const monthTotals = {};
    scopedTransactions.forEach(tx => {
      const ym = (tx.isoDate || '2026-01-01').slice(0, 7);
      if (!monthTotals[ym]) {
        monthTotals[ym] = {
          monthKey: ym,
          monthLabel: MONTH_LABELS[ym] || ym,
          amexCredito: 0,
          bbvaCredito: 0,
          bbvaDebito: 0,
          total: 0
        };
      }
      const amt = Number(tx.amount) || 0;
      if (tx.bank === 'AMEX') {
        monthTotals[ym].amexCredito += amt;
      } else if (tx.bank === 'BBVA' && tx.paymentMethod === 'credito') {
        monthTotals[ym].bbvaCredito += amt;
      } else {
        monthTotals[ym].bbvaDebito += amt;
      }
      monthTotals[ym].total += amt;
    });

    const mData = Object.values(monthTotals).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // 4. Top 10 Movements
    const tExpenses = [...scopedTransactions]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 10);

    return {
      pieData: pData,
      barData: bData,
      monthlyBankData: mData,
      topExpenses: tExpenses
    };
  }, [scopedTransactions, categories]);

  if (transactions.length === 0) {
    return (
      <div className="text-center p-10 text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
        No hay datos para graficar con los filtros actuales.
      </div>
    );
  }

  const formatCurrency = (val) =>
    `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalRealSpend = globalBreakdown.totalCredito + globalBreakdown.totalDebitoReal;
  const creditoPct = totalRealSpend > 0 ? Math.round((globalBreakdown.totalCredito / totalRealSpend) * 100) : 0;
  const debitoPct = totalRealSpend > 0 ? 100 - creditoPct : 0;

  return (
    <div className="space-y-8">
      {/* Scope Selector Bar */}
      <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Filter className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Modo de Análisis Financiero</h3>
            <p className="text-xs text-neutral-400">
              Separa tus gastos reales de los pagos internos entre cuentas (BBVA Débito a TDC Amex/BBVA) y depósitos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setAnalysisMode('gastos_reales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              analysisMode === 'gastos_reales'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Gastos Reales (Sin Pagos TDC)
          </button>
          <button
            onClick={() => setAnalysisMode('todos_cargos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              analysisMode === 'todos_cargos'
                ? 'bg-rose-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos los Cargos
          </button>
          <button
            onClick={() => setAnalysisMode('abonos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              analysisMode === 'abonos'
                ? 'bg-emerald-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Abonos / Depósitos
          </button>
        </div>
      </div>

      {/* Bank & Credit vs Debit Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* AMEX Crédito */}
        <div className="bg-neutral-900 border border-indigo-500/30 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              AMEX · Crédito
            </span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {formatCurrency(globalBreakdown.amexCreditoCargos)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {globalBreakdown.amexCreditoCount} cargos en Amex Gold Elite
          </p>
        </div>

        {/* BBVA Crédito */}
        <div className="bg-neutral-900 border border-amber-500/30 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              BBVA · Crédito
            </span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {formatCurrency(globalBreakdown.bbvaCreditoCargos)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {globalBreakdown.bbvaCreditoCount} cargos en BBVA Tarjeta Oro
          </p>
        </div>

        {/* BBVA Débito (Gastos Directos) */}
        <div className="bg-neutral-900 border border-emerald-500/30 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              BBVA · Débito (Gastos)
            </span>
            <Landmark className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {formatCurrency(globalBreakdown.bbvaDebitoGastosReales)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {globalBreakdown.bbvaDebitoGastosCount} gastos directos (+ {formatCurrency(globalBreakdown.bbvaDebitoPagosTdc)} pagos TDC)
          </p>
        </div>

        {/* Comparativa Crédito vs Débito */}
        <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-amber-300">Crédito ({creditoPct}%)</span>
              <span className="text-emerald-300">Débito ({debitoPct}%)</span>
            </div>
            <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-indigo-500 to-amber-500 h-full"
                style={{ width: `${creditoPct}%` }}
                title={`Crédito: ${formatCurrency(globalBreakdown.totalCredito)}`}
              />
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${debitoPct}%` }}
                title={`Débito: ${formatCurrency(globalBreakdown.totalDebitoReal)}`}
              />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-neutral-800 flex justify-between text-xs">
            <div>
              <span className="text-neutral-500 block">Total Crédito</span>
              <span className="text-white font-mono font-semibold">{formatCurrency(globalBreakdown.totalCredito)}</span>
            </div>
            <div className="text-right">
              <span className="text-neutral-500 block">Total Débito (Sin TDC)</span>
              <span className="text-white font-mono font-semibold">{formatCurrency(globalBreakdown.totalDebitoReal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Evolution by Bank & Method */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl h-[420px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Evolución Mensual por Banco y Método de Pago
            </h3>
            <p className="text-xs text-neutral-400">
              Comparativa mes a mes entre AMEX Crédito, BBVA Crédito y BBVA Débito
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-neutral-400 block">Total en Vista Actual ({scopedTransactions.length} movs.)</span>
            <span className="text-xl font-bold text-white font-mono">
              {formatCurrency(scopedTransactions.reduce((s, t) => s + Number(t.amount || 0), 0))}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyBankData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis dataKey="monthLabel" stroke="#888" tick={{ fill: '#aaa', fontSize: 12 }} />
              <YAxis
                stroke="#888"
                tick={{ fill: '#aaa', fontSize: 12 }}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: '#262626' }}
                contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '10px', color: '#fff' }}
                formatter={(value, name) => [formatCurrency(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="amexCredito" name="AMEX Crédito" stackId="bank" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="bbvaCredito" name="BBVA Crédito" stackId="bank" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="bbvaDebito" name="BBVA Débito" stackId="bank" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Chronological Timeline */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl h-[480px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Línea del Tiempo Cronológica</h3>
              <p className="text-xs text-neutral-400">Ordenada por fecha exacta ISO (YYYY-MM-DD)</p>
            </div>
            <button
              onClick={() => setIsAddingPeriod(!isAddingPeriod)}
              className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Añadir Periodo (Viaje/Evento)
            </button>
          </div>

          {isAddingPeriod && (
            <form onSubmit={handleAddPeriod} className="flex flex-wrap gap-3 mb-4 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              <input
                type="text"
                placeholder="Nombre (ej. Viaje)"
                value={newPeriod.name}
                onChange={e => setNewPeriod({ ...newPeriod, name: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 text-white text-xs rounded-lg px-3 py-1.5 flex-1 min-w-[150px]"
                required
              />
              <input
                type="date"
                value={newPeriod.start_date}
                onChange={e => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 text-white text-xs rounded-lg px-2 py-1.5"
                required
              />
              <input
                type="date"
                value={newPeriod.end_date}
                onChange={e => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 text-white text-xs rounded-lg px-2 py-1.5"
                required
              />
              <input
                type="color"
                value={newPeriod.color}
                onChange={e => setNewPeriod({ ...newPeriod, color: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 rounded-lg w-8 h-8 p-0.5 cursor-pointer"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                Guardar
              </button>
            </form>
          )}

          {periods.length > 0 && !isAddingPeriod && (
            <div className="flex flex-wrap gap-2 mb-3">
              {periods.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 px-3 py-1 rounded-full text-xs text-neutral-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                  {p.name}
                  <button onClick={() => handleDeletePeriod(p.id)} className="text-neutral-500 hover:text-red-400 ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#888"
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickMargin={8}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#888"
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  cursor={{ fill: '#262626' }}
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value, name) => {
                    const catName = name === 'unclassified' ? 'Sin Clasificar' : categories.find(c => c.id === name)?.name || name;
                    return [formatCurrency(value), catName];
                  }}
                />
                <Bar dataKey="unclassified" stackId="a" fill="#525252" />
                {categories.map(cat => (
                  <Bar key={cat.id} dataKey={cat.id} stackId="a" fill={cat.color || '#3b82f6'} />
                ))}
                {periods.map(period => (
                  <ReferenceArea
                    key={period.id}
                    x1={period.start_date}
                    x2={period.end_date}
                    strokeOpacity={0.3}
                    fill={period.color}
                    fillOpacity={0.15}
                    label={{ position: 'top', value: period.name, fill: period.color, fontSize: 11 }}
                  />
                ))}
                <Brush dataKey="date" height={26} stroke="#404040" fill="#171717" tickFormatter={() => ''} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories / Pie Chart */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl h-[480px] flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-2">Distribución por Categoría</h3>
          <p className="text-xs text-neutral-400 mb-4">Proporción del gasto según tus categorías asignadas</p>
          <div className="flex-1 min-h-0">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => {
                      const color = entry.name === 'Sin Clasificar'
                        ? '#525252'
                        : (categories.find(c => c.name === entry.name)?.color || COLORS[index % COLORS.length]);
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value) => [formatCurrency(value), 'Total']}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#ccc', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-500">
                Clasifica gastos para ver la distribución
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top 10 Movements Table with Direct PDF Pointer */}
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-1">Top 10 Movimientos en esta Vista</h3>
        <p className="text-xs text-neutral-400 mb-4">
          Haz clic en &ldquo;Señalar en PDF&rdquo; para abrir el estado de cuenta y resaltar el renglón exacto.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 text-xs uppercase">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Banco / Método</th>
                <th className="py-2.5 px-3">Concepto / Nombre</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
                <th className="py-2.5 px-3 text-right">Estado de Cuenta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {topExpenses.map(tx => (
                <tr key={tx.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="py-2.5 px-3 whitespace-nowrap text-xs text-neutral-300 font-mono">
                    {tx.isoDate || tx.date}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          tx.bank === 'AMEX'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {tx.bank || 'MANUAL'}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                          tx.paymentMethod === 'credito'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {tx.paymentMethod === 'credito' ? 'Crédito' : 'Débito'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 max-w-md">
                    <p className="text-white font-medium truncate">{tx.title || tx.concept}</p>
                    {tx.title && tx.title !== tx.concept && (
                      <p className="text-[11px] text-neutral-500 truncate">PDF: {tx.concept}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {tx.statementFile && onOpenPdf ? (
                      <button
                        onClick={() => onOpenPdf(tx)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Señalar en PDF (Pág. {tx.page || 1})</span>
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
