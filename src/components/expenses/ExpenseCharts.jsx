import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceArea
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { createPersonalExpensePeriod, deletePersonalExpensePeriod } from '../../lib/api/personalExpenses';

const COLORS = ['#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#14b8a6', '#06b6d4'];

export default function ExpenseCharts({ transactions, categories, periods = [], onPeriodsChange }) {
  const [isAddingPeriod, setIsAddingPeriod] = React.useState(false);
  const [newPeriod, setNewPeriod] = React.useState({ name: '', start_date: '', end_date: '', color: '#ef4444' });

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

  const { pieData, barData, topExpenses } = React.useMemo(() => {
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

    // Process Bar Chart Data (Timeline with categories)
    const dateTotals = {};
    transactions.forEach(tx => {
      const date = tx.date || 'Desconocida';
      if (!dateTotals[date]) {
        dateTotals[date] = { date, amount: 0, _rawDate: date };
      }
      
      const amount = Number(tx.amount) || 0;
      dateTotals[date].amount += amount;
      
      const catKey = tx.bucket || 'unclassified';
      dateTotals[date][catKey] = (dateTotals[date][catKey] || 0) + amount;
    });

    // Sort dates
    const bData = Object.values(dateTotals).sort((a, b) => a._rawDate.localeCompare(b._rawDate));

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
              <p className="text-sm text-neutral-300 truncate mt-1" title={topExpenses[0].title || topExpenses[0].concept}>{topExpenses[0].title || topExpenses[0].concept}</p>
            </div>
          ) : <p className="text-neutral-500">N/A</p>}
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl overflow-y-auto max-h-32">
          <h3 className="text-neutral-400 text-sm font-semibold uppercase tracking-wider mb-2">Top 3 Gastos</h3>
          <div className="space-y-2">
            {topExpenses.slice(0, 3).map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-sm">
                <span className="text-neutral-300 truncate pr-2 max-w-[150px]" title={tx.title || tx.concept}>{tx.title || tx.concept}</span>
                <span className="text-white font-medium">{formatCurrency(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Timeline / Bar Chart */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl h-[500px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Línea del Tiempo</h3>
            <button 
              onClick={() => setIsAddingPeriod(!isAddingPeriod)}
              className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Añadir Periodo (Viaje/Evento)
            </button>
          </div>
          
          {isAddingPeriod && (
            <form onSubmit={handleAddPeriod} className="flex flex-wrap gap-3 mb-6 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
              <input 
                type="text" 
                placeholder="Nombre (ej. Viaje a Cancún)" 
                value={newPeriod.name}
                onChange={e => setNewPeriod({...newPeriod, name: e.target.value})}
                className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg px-3 py-2 flex-1 min-w-[200px]"
                required
              />
              <input 
                type="date" 
                value={newPeriod.start_date}
                onChange={e => setNewPeriod({...newPeriod, start_date: e.target.value})}
                className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg px-3 py-2"
                required
              />
              <input 
                type="date" 
                value={newPeriod.end_date}
                onChange={e => setNewPeriod({...newPeriod, end_date: e.target.value})}
                className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg px-3 py-2"
                required
              />
              <input 
                type="color" 
                value={newPeriod.color}
                onChange={e => setNewPeriod({...newPeriod, color: e.target.value})}
                className="bg-neutral-900 border border-neutral-800 rounded-lg w-10 h-10 p-1 cursor-pointer"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Guardar
              </button>
            </form>
          )}

          {periods.length > 0 && !isAddingPeriod && (
            <div className="flex flex-wrap gap-2 mb-4">
              {periods.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-full text-xs text-neutral-300">
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
              <ComposedChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
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
                  formatter={(value, name) => {
                    const catName = name === 'unclassified' ? 'Sin Clasificar' : categories.find(c => c.id === name)?.name || name;
                    return [formatCurrency(value), catName];
                  }}
                />
                
                {/* Bars stacked by category */}
                <Bar dataKey="unclassified" stackId="a" fill="#525252" />
                {categories.map(cat => (
                  <Bar key={cat.id} dataKey={cat.id} stackId="a" fill={cat.color || '#3b82f6'} />
                ))}
                
                
                {/* Referencias de periodos */}
                {periods.map(period => (
                  <ReferenceArea 
                    key={period.id}
                    x1={period.start_date} 
                    x2={period.end_date} 
                    strokeOpacity={0.3} 
                    fill={period.color} 
                    fillOpacity={0.15} 
                    label={{ position: 'top', value: period.name, fill: period.color, fontSize: 12 }} 
                  />
                ))}

                <Brush 
                  dataKey="date" 
                  height={30} 
                  stroke="#404040" 
                  fill="#171717"
                  tickFormatter={() => ''} 
                />
              </ComposedChart>
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
    </div>
  );
}
