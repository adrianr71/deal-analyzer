export function normalizePropertyType(type) {
  const text = String(type || "").toLowerCase();

  if (text.includes("four") || text.includes("quad") || text.includes("4plex")) {
    return { units: 4, propertyType: "Fourplex" };
  }
  if (text.includes("triplex") || text.includes("3plex")) {
    return { units: 3, propertyType: "Triplex" };
  }
  if (text.includes("duplex") || text.includes("2plex")) {
    return { units: 2, propertyType: "Duplex" };
  }

  return { units: 1, propertyType: "Single / Condo" };
}

export function calculateDealScore({
  monthlyCashFlow,
  capRate,
  cashOnCash,
  dscr,
  noiAnnual,
  expenseRatio
}) {
  let score = 0;

  score += noiAnnual > 40000 ? 15 : noiAnnual > 20000 ? 10 : noiAnnual > 0 ? 5 : 0;
  score += monthlyCashFlow > 1000 ? 25 : monthlyCashFlow > 500 ? 18 : monthlyCashFlow > 0 ? 10 : 0;
  score += capRate >= 8 ? 20 : capRate >= 6 ? 14 : capRate >= 5 ? 8 : 0;
  score += cashOnCash >= 10 ? 20 : cashOnCash >= 6 ? 14 : cashOnCash >= 2 ? 8 : 0;
  score += dscr >= 1.25 ? 15 : dscr >= 1 ? 10 : 0;
  score += expenseRatio < 35 ? 5 : expenseRatio < 45 ? 3 : 0;

  if (monthlyCashFlow < 0) score -= 15;
  if (dscr < 1) score -= 10;
  if (expenseRatio > 50) score -= 10;

  return Math.max(0, Math.min(100, score));
}

export function getMonthlyTax(row, index, assumptions, taxOverrides = {}) {
  const price = Number(row && row.price ? row.price : 0);

  if (index !== undefined && taxOverrides[index] !== undefined) {
    return Number(taxOverrides[index]);
  }

  const annualTax = price * (assumptions.taxRatePct / 100);
  return annualTax / 12;
}

export function analyzeRow(row, assumptions, index, taxOverrides = {}) {
  const normalized = normalizePropertyType(row.type);
  const units = normalized.units;

  const rentPerUnit =
    units === 4
      ? assumptions.quadRent
      : units === 3
      ? assumptions.triplexRent
      : units === 2
      ? assumptions.duplexRent
      : assumptions.singleRent;

  const monthlyRent = row.rentManual ?? units * rentPerUnit;
  const closingCosts = row.price * (assumptions.closingCostsPct / 100);
  const downPayment = row.price * (assumptions.downPaymentPct / 100);
  const loanAmount = row.price - downPayment;
  const monthlyRate = assumptions.interestRate / 100 / 12;
  const numberOfPayments = assumptions.loanTermYears * 12;

  const debtService =
    monthlyRate === 0
      ? loanAmount / numberOfPayments
      : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

  const monthlyTaxes = getMonthlyTax(row, index, assumptions, taxOverrides);

  const operatingExpenses =
    monthlyTaxes +
    assumptions.monthlyInsurance +
    monthlyRent * (assumptions.maintenancePct / 100) +
    monthlyRent * (assumptions.vacancyPct / 100) +
    monthlyRent * (assumptions.managementPct / 100) +
    assumptions.hoaMonthly;

  const noiMonthly = monthlyRent - operatingExpenses;
  const noiAnnual = noiMonthly * 12;
  const monthlyCashFlow = noiMonthly - debtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const annualDebtService = debtService * 12;
  const capRate = row.price > 0 ? (noiAnnual / row.price) * 100 : 0;
  const totalCashInvested = downPayment + closingCosts + assumptions.rehabBudget;
  const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : 0;
  const expenseRatio = monthlyRent > 0 ? (operatingExpenses / monthlyRent) * 100 : 0;

  const score = calculateDealScore({
    monthlyCashFlow,
    capRate,
    cashOnCash,
    dscr,
    noiAnnual,
    expenseRatio
  });

  const rating =
    score >= 85
      ? "Excellent"
      : score >= 70
      ? "Strong"
      : score >= 55
      ? "Moderate"
      : score >= 40
      ? "Weak"
      : "High Risk";

  const tone = score >= 85 ? "green" : score >= 55 ? "yellow" : "red";

  return {
    ...row,
    units,
    propertyType: normalized.propertyType,
    monthlyRent,
    monthlyTaxes,
    monthlyPropertyTax: monthlyTaxes,
    operatingExpenses,
    expenseRatio,
    noiMonthly,
    monthlyCashFlow,
    capRate,
    cashOnCash,
    dscr,
    score,
    rating,
    tone
  };
}

export function analyzeRows(rows, assumptions, taxOverrides = {}) {
  const safeOverrides = taxOverrides || {};

  return rows.map((row, index) => {
    return analyzeRow(row, assumptions, index, safeOverrides);
  });
}