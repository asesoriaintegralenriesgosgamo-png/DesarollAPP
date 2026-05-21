export const fmtMXN = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const fmtPct = (n) =>
  `${(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

export const fmtNumber = (n) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n || 0);
