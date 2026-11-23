export const fmtNum = (n, dec = 1) => {
  const clean = Math.abs(n) < (0.5 / Math.pow(10, dec)) ? 0 : n;
  return clean.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

export const fmtBRL = (n, dec = 1) => {
  const clean = Math.abs(n) < (0.5 / Math.pow(10, dec)) ? 0 : n;
  return "R$ " + clean.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + " mi";
};

export const fmtSignedBRL = (n, dec = 1) => {
  const clean = Math.abs(n) < (0.5 / Math.pow(10, dec)) ? 0 : n;
  if (clean === 0) return fmtBRL(0, dec);
  return (clean > 0 ? "+" : "-") + fmtBRL(Math.abs(clean), dec);
};

export const fmtSignedNum = (n, dec = 1, suffix = "") => {
  const clean = Math.abs(n) < (0.5 / Math.pow(10, dec)) ? 0 : n;
  if (clean === 0) return fmtNum(0, dec) + suffix;
  return (clean > 0 ? "+" : "-") + fmtNum(Math.abs(clean), dec) + suffix;
};

