import React, { useMemo } from 'react';
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
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#14b8a6', '#06b6d4'];

export default function ExpenseCharts({ transactions, categories }) {
  const { pieData, barData, topExpenses } = useMemo(() => {
    // Process Pie Chart Data (Only classified expenses)
    const categoryTotals = {};
    let unclassifiedTotal = 0;

    transactions.forEach(tx => {
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

    // Process Bar Chart Data (Timeline)
    const dateTotals = {};
    transactions.forEach(tx => {
      const date = tx.date || 'Desconocida';
      if (!dateTotals[date]) {
        dateTotals[date] = { date, amount: 0 };
      }
      dateTotals[date].amount += Number(tx.amount) || 0;
    });

    // Attempt to sort dates if they follow basic patterns, otherwise alphabetical
    const bData = Object.values(dateTotals).sort((a, b) => a.date.localeCompare(b.date));

    // Get Top Expenses
    const tExpenses = [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 5);

    return { pieData: pData, barData: bData, topExpenses: tExpenses };
  }, [transactions, categories]);

  if (transactions.length === 0) {
    return (
      <div className="text-center p-10 text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
        No hay datos para graficar.
      </div>
    );
  }

  const formatCurrency = (val) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-8">
      {/* Top Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl">
          <h3 className="text-neutral-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Analizado</h3>
          <p className="text-3xl font-bold text-white">
            {formatCurrency(transactions.reduce((sum, tx) => sum + Number(tx.amount), 0))}
          </p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl">
          <h3 className="text-neutral-400 text-sm font-semibold uppercase tracking-wider mb-2">Mayor Gasto</h3>
          {topExpenses.length > 0 ? (
            <div>
              <p className="text-2xl font-bold text-rose-400">{formatCurrency(topExpenses[0].amount)}</p>
              <p className="text-sm text-neutral-300 truncate mt-1" title={topExpenses[0].concept}>{topExpenses[0].concept}</p>
            </div>
          ) : <p className="text-neutral-500">N/A</p>}
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl overflow-y-auto max-h-32">
          <h3 className="text-neutral-400 text-sm font-semibold uppercase tracking-wider mb-2">Top 3 Gastos</h3>
          <div className="space-y-2">
            {topExpenses.slice(0, 3).map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-sm">
                <span className="text-neutral-300 truncate pr-2 max-w-[150px]" title={tx.concept}>{tx.concept}</span>
                <span className="text-white font-medium">{formatCurrency(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Timeline / Bar Chart */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Línea del Tiempo</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 12 }}
                  tickMargin={10}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 12 }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  cursor={{ fill: '#333' }}
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [formatCurrency(value), 'Monto']}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories / Pie Chart */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Distribución por Categoría</h3>
          <div className="flex-1 min-h-0">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Sin Clasificar' ? '#525252' : COLORS[index % COLORS.length]} />
                    ))}
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
    </div>
  );
}
