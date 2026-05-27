// Cálculos puros de cuentas. Sin side effects, fáciles de memoizar con useMemo.
// Convención: todos los montos asumen moneda compatible entre items que se suman.
// Cuando hay monedas mezcladas, el caller debe agruparlas por moneda antes.

const num = (v) => (v == null ? 0 : Number(v) || 0);

/**
 * Suma aportaciones de un socio (en monto, sin distinguir moneda — caller filtra).
 */
export function sumPartnerContributions(partnerId, contributions, moneda = null) {
  return contributions
    .filter((c) => c.partner_id === partnerId)
    .filter((c) => !moneda || c.moneda === moneda)
    .reduce((acc, c) => acc + num(c.monto), 0);
}

/**
 * Estado de un socio: cuánto comprometió, cuánto aportó, faltante y % avance.
 * Las transferencias entre socios ajustan el % contractual y monto comprometido.
 */
export function computePartnerStatus(partner, contributions, transfers = []) {
  const aportado = sumPartnerContributions(partner.id, contributions, partner.moneda);

  // Transferencias hacia/desde este socio (porcentaje)
  const cedido = transfers
    .filter((t) => t.from_partner_id === partner.id && t.tipo === "cesion_porcentaje")
    .reduce((acc, t) => acc + num(t.porcentaje_transferido), 0);
  const recibido = transfers
    .filter((t) => t.to_partner_id === partner.id && t.tipo === "cesion_porcentaje")
    .reduce((acc, t) => acc + num(t.porcentaje_transferido), 0);

  const porcentaje_contractual_actual = num(partner.porcentaje_contractual) - cedido + recibido;
  const comprometido = num(partner.monto_comprometido);
  const faltante = Math.max(0, comprometido - aportado);
  const porcentaje_avance = comprometido > 0 ? (aportado / comprometido) * 100 : 0;

  const aportaciones = contributions.filter((c) => c.partner_id === partner.id);
  const ultima = aportaciones.length
    ? aportaciones.reduce((a, b) =>
        new Date(a.fecha) > new Date(b.fecha) ? a : b
      )
    : null;

  return {
    aportado,
    comprometido,
    faltante,
    porcentaje_avance: Math.min(porcentaje_avance, 999), // cap visual
    porcentaje_contractual_original: num(partner.porcentaje_contractual),
    porcentaje_contractual_actual,
    cedido,
    recibido,
    ultima_aportacion: ultima,
    numero_aportaciones: aportaciones.length,
  };
}

/**
 * % real de aportación del total (cuánto del capital aportado del proyecto vino de este socio).
 */
export function computePartnerRealPercentage(partnerId, contributions, moneda = "MXN") {
  const total = contributions
    .filter((c) => c.moneda === moneda)
    .reduce((acc, c) => acc + num(c.monto), 0);
  if (total === 0) return 0;
  const propio = contributions
    .filter((c) => c.partner_id === partnerId && c.moneda === moneda)
    .reduce((acc, c) => acc + num(c.monto), 0);
  return (propio / total) * 100;
}

/**
 * Saldo de cuenta bancaria = saldo_inicial + Σ aportaciones a esta cuenta − Σ egresos pagados/conciliados de esta cuenta.
 */
export function computeAccountBalance(account, contributions, expenses) {
  const entradas = contributions
    .filter((c) => c.account_id === account.id && c.moneda === account.moneda)
    .reduce((acc, c) => acc + num(c.monto), 0);
  const salidas = expenses
    .filter((e) => e.account_id === account.id && e.moneda === account.moneda)
    .filter((e) => e.estado === "pagado" || e.estado === "conciliado")
    .reduce((acc, e) => acc + num(e.monto), 0);
  return num(account.saldo_inicial) + entradas - salidas;
}

/**
 * Suma de egresos por categoría incluyendo subcategorías (recursivo de 1 nivel).
 */
export function sumExpensesByCategory(categoryId, allCategories, expenses) {
  const childIds = allCategories
    .filter((c) => c.parent_id === categoryId)
    .map((c) => c.id);
  const matchIds = new Set([categoryId, ...childIds]);
  return expenses
    .filter((e) => matchIds.has(e.category_id))
    .filter((e) => e.estado === "pagado" || e.estado === "conciliado")
    .reduce((acc, e) => acc + num(e.monto), 0);
}

/**
 * Presupuesto vs ejecutado para una categoría top-level (incluye subcategorías).
 */
export function computeBudgetExecution(category, allCategories, expenses) {
  const subs = allCategories.filter((c) => c.parent_id === category.id);
  const presupuestoPropio = num(category.presupuesto_inicial);
  const presupuestoSubs = subs.reduce(
    (acc, s) => acc + num(s.presupuesto_inicial),
    0
  );
  const presupuesto = presupuestoPropio + presupuestoSubs;
  const ejecutado = sumExpensesByCategory(category.id, allCategories, expenses);
  const falta = presupuesto - ejecutado;
  const porcentaje = presupuesto > 0 ? (ejecutado / presupuesto) * 100 : 0;
  return {
    presupuesto,
    ejecutado,
    falta,
    porcentaje,
    subcategorias: subs.map((s) => ({
      ...s,
      ejecutado: sumExpensesByCategory(s.id, allCategories, expenses),
      porcentaje:
        num(s.presupuesto_inicial) > 0
          ? (sumExpensesByCategory(s.id, allCategories, expenses) /
              num(s.presupuesto_inicial)) *
            100
          : 0,
    })),
  };
}

/**
 * Total pagado a un proveedor (suma sólo egresos pagados/conciliados).
 */
export function sumPaidToPayee(payeeId, expenses, moneda = "MXN") {
  return expenses
    .filter((e) => e.payee_id === payeeId && e.moneda === moneda)
    .filter((e) => e.estado === "pagado" || e.estado === "conciliado")
    .reduce((acc, e) => acc + num(e.monto), 0);
}

/**
 * Egresos vinculados a una tarea de obra.
 */
export function sumExpensesByTask(taskId, expenses, moneda = "MXN") {
  return expenses
    .filter((e) => e.construction_task_id === taskId && e.moneda === moneda)
    .filter((e) => e.estado === "pagado" || e.estado === "conciliado")
    .reduce((acc, e) => acc + num(e.monto), 0);
}

/**
 * Resumen global del proyecto en una moneda dada.
 * Devuelve KPIs principales + alertas.
 */
export function computeProjectFinancialSummary({
  partners,
  contributions,
  expenses,
  categories,
  accounts,
  moneda = "MXN",
}) {
  const partnersMoneda = partners.filter((p) => p.moneda === moneda);
  const contribsMoneda = contributions.filter((c) => c.moneda === moneda);
  const expensesMoneda = expenses.filter((e) => e.moneda === moneda);
  const accountsMoneda = accounts.filter((a) => a.moneda === moneda);
  const categoriesMoneda = categories.filter((c) => c.moneda === moneda);

  const comprometido_total = partnersMoneda
    .filter((p) => p.activo)
    .reduce((acc, p) => acc + num(p.monto_comprometido), 0);

  const aportado_total = contribsMoneda.reduce((acc, c) => acc + num(c.monto), 0);

  const egresado_total = expensesMoneda
    .filter((e) => e.estado === "pagado" || e.estado === "conciliado")
    .reduce((acc, e) => acc + num(e.monto), 0);

  const por_pagar = expensesMoneda
    .filter((e) => e.estado === "programado")
    .reduce((acc, e) => acc + num(e.monto), 0);

  const saldo_inicial_total = accountsMoneda.reduce(
    (acc, a) => acc + num(a.saldo_inicial),
    0
  );
  const saldo_total = saldo_inicial_total + aportado_total - egresado_total;

  const porcentaje_aportacion_global =
    comprometido_total > 0 ? (aportado_total / comprometido_total) * 100 : 0;

  const presupuesto_total = categoriesMoneda
    .filter((c) => !c.parent_id)
    .reduce((acc, c) => {
      const exec = computeBudgetExecution(c, categories, expenses);
      return acc + exec.presupuesto;
    }, 0);

  // Alertas
  const alertas = [];

  // Socios sin aportaciones recientes (> 30 días)
  const ahora = Date.now();
  const TREINTA_DIAS = 30 * 24 * 60 * 60 * 1000;
  partnersMoneda
    .filter((p) => p.activo)
    .forEach((p) => {
      const aps = contribsMoneda.filter((c) => c.partner_id === p.id);
      if (num(p.monto_comprometido) > 0) {
        const aportado = aps.reduce((acc, c) => acc + num(c.monto), 0);
        if (aportado < num(p.monto_comprometido)) {
          const ultima = aps.length
            ? Math.max(...aps.map((a) => new Date(a.fecha).getTime()))
            : null;
          if (!ultima || ahora - ultima > TREINTA_DIAS) {
            alertas.push({
              tipo: "socio_sin_aportacion",
              nivel: "warning",
              mensaje: `${p.nombre} no ha aportado en más de 30 días`,
              partnerId: p.id,
            });
          }
        }
      }
    });

  // Categorías con sobreejercicio
  categoriesMoneda
    .filter((c) => !c.parent_id)
    .forEach((c) => {
      const exec = computeBudgetExecution(c, categories, expenses);
      if (exec.presupuesto > 0 && exec.ejecutado > exec.presupuesto) {
        alertas.push({
          tipo: "presupuesto_excedido",
          nivel: "danger",
          mensaje: `Categoría "${c.nombre}" excede su presupuesto en ${(
            exec.ejecutado - exec.presupuesto
          ).toLocaleString("es-MX")}`,
          categoryId: c.id,
        });
      } else if (exec.presupuesto > 0 && exec.porcentaje >= 90) {
        alertas.push({
          tipo: "presupuesto_cerca",
          nivel: "warning",
          mensaje: `Categoría "${c.nombre}" al ${exec.porcentaje.toFixed(0)}% del presupuesto`,
          categoryId: c.id,
        });
      }
    });

  // Egresos sin factura
  const sinFactura = expensesMoneda.filter(
    (e) =>
      (e.estado === "pagado" || e.estado === "conciliado") &&
      !e.factura_uuid &&
      !e.factura_storage_path
  );
  if (sinFactura.length > 0) {
    alertas.push({
      tipo: "egresos_sin_factura",
      nivel: "info",
      mensaje: `${sinFactura.length} egreso${sinFactura.length === 1 ? "" : "s"} sin factura registrada`,
      count: sinFactura.length,
    });
  }

  // Egresos no conciliados
  const sinConciliar = expensesMoneda.filter((e) => e.estado === "pagado");
  if (sinConciliar.length > 0) {
    alertas.push({
      tipo: "egresos_no_conciliados",
      nivel: "info",
      mensaje: `${sinConciliar.length} pago${sinConciliar.length === 1 ? "" : "s"} pendientes de conciliar`,
      count: sinConciliar.length,
    });
  }

  return {
    moneda,
    comprometido_total,
    aportado_total,
    egresado_total,
    saldo_total,
    por_pagar,
    saldo_inicial_total,
    presupuesto_total,
    porcentaje_aportacion_global,
    diferencia_aportado_egresado: aportado_total - egresado_total,
    alertas,
  };
}

/**
 * Cash flow acumulado en el tiempo (para line chart).
 * Retorna [{ fecha, aportaciones_acum, egresos_acum, saldo }, ...]
 */
export function computeCashFlow({ contributions, expenses, moneda = "MXN" }) {
  const events = [];
  contributions
    .filter((c) => c.moneda === moneda)
    .forEach((c) => events.push({ fecha: c.fecha, tipo: "in", monto: num(c.monto) }));
  expenses
    .filter((e) => e.moneda === moneda)
    .filter((e) => e.estado === "pagado" || e.estado === "conciliado")
    .forEach((e) => events.push({ fecha: e.fecha, tipo: "out", monto: num(e.monto) }));

  events.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  let inAcum = 0;
  let outAcum = 0;
  const byDate = new Map();
  for (const ev of events) {
    if (ev.tipo === "in") inAcum += ev.monto;
    else outAcum += ev.monto;
    byDate.set(ev.fecha, {
      fecha: ev.fecha,
      aportaciones_acum: inAcum,
      egresos_acum: outAcum,
      saldo: inAcum - outAcum,
    });
  }
  return Array.from(byDate.values());
}

export function distinctMonedas(items) {
  return [...new Set(items.map((i) => i.moneda).filter(Boolean))];
}
