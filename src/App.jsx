

import { useEffect, useMemo, useState } from "react";

export default function RentalDealAnalyzerV1() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Rental Deal Analyzer — Long-Term Rentals</h1>
          <p className="text-slate-300 mt-2">Quickly analyze a rental property using a few key inputs. This tool gives you a clear, simple view of whether a deal looks weak, average, or strong based on cash flow, returns, and basic financing assumptions.</p>
          <p className="text-slate-300 mt-2">It is designed for fast decision-making, helping you understand the numbers and next steps without getting lost in complex calculations. Always verify your assumptions before making a final decision, including confirming details with qualified professionals such as lenders, agents, or financial advisors.</p>
          <p className="text-slate-300 mt-2">Short-term rental performance may vary significantly and typically requires more detailed, property-specific analysis.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <CalculatorCard />
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto mt-10 text-xs text-slate-400 leading-5 border-t border-slate-800 pt-6">
        This tool is provided for informational purposes only. Results are estimates based on user inputs and assumptions and may not reflect actual market conditions, property performance, or financing terms. This is not financial, legal, or tax advice. Always verify all information independently and consult qualified professionals before making investment decisions.
      </div>
    </div>
  );
}



function CalculatorCard() {
  const STORAGE_KEY = "deal-check-fast-inputs-v1";

  const [purchasePrice, setPurchasePrice] = useState(365000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [rateType, setRateType] = useState("interest");
  const [interestRate, setInterestRate] = useState(6.75);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const [monthlyRent, setMonthlyRent] = useState(3500);
  const [monthlyTaxes, setMonthlyTaxes] = useState(375);
  const [monthlyInsurance, setMonthlyInsurance] = useState(250);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  const [maintenancePct, setMaintenancePct] = useState(8);
  const [vacancyPct, setVacancyPct] = useState(5);
  const [managementPct, setManagementPct] = useState(0);
  const [hasLoadedSavedValues, setHasLoadedSavedValues] = useState(false);
  const [showRestoredHint, setShowRestoredHint] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setHasLoadedSavedValues(true);
        return;
      }

      const saved = JSON.parse(raw);

      setShowRestoredHint(true);
      setTimeout(() => setShowRestoredHint(false), 2500);

      if (typeof saved.purchasePrice === "number") setPurchasePrice(saved.purchasePrice);
      if (typeof saved.downPaymentPct === "number") setDownPaymentPct(saved.downPaymentPct);
      if (typeof saved.rateType === "string") setRateType(saved.rateType);
      if (typeof saved.interestRate === "number") setInterestRate(saved.interestRate);
      if (typeof saved.loanTermYears === "number") setLoanTermYears(saved.loanTermYears);
      if (typeof saved.monthlyRent === "number") setMonthlyRent(saved.monthlyRent);
      if (typeof saved.monthlyTaxes === "number") setMonthlyTaxes(saved.monthlyTaxes);
      if (typeof saved.monthlyInsurance === "number") setMonthlyInsurance(saved.monthlyInsurance);
      if (typeof saved.monthlyHoa === "number") setMonthlyHoa(saved.monthlyHoa);
      if (typeof saved.maintenancePct === "number") setMaintenancePct(saved.maintenancePct);
      if (typeof saved.vacancyPct === "number") setVacancyPct(saved.vacancyPct);
      if (typeof saved.managementPct === "number") setManagementPct(saved.managementPct);
    } catch (error) {
      console.error("Could not load saved inputs", error);
    } finally {
      setHasLoadedSavedValues(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedValues) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          purchasePrice,
          downPaymentPct,
          rateType,
          interestRate,
          loanTermYears,
          monthlyRent,
          monthlyTaxes,
          monthlyInsurance,
          monthlyHoa,
          maintenancePct,
          vacancyPct,
          managementPct,
        })
      );
    } catch (error) {
      console.error("Could not save inputs", error);
    }
  }, [
    hasLoadedSavedValues,
    purchasePrice,
    downPaymentPct,
    rateType,
    interestRate,
    loanTermYears,
    monthlyRent,
    monthlyTaxes,
    monthlyInsurance,
    monthlyHoa,
    maintenancePct,
    vacancyPct,
    managementPct,
  ]);

  const clearSavedInputs = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Could not clear saved inputs", error);
    }

    setPurchasePrice(365000);
    setDownPaymentPct(20);
    setRateType("interest");
    setInterestRate(6.75);
    setLoanTermYears(30);
    setMonthlyRent(3500);
    setMonthlyTaxes(375);
    setMonthlyInsurance(250);
    setMonthlyHoa(0);
    setMaintenancePct(8);
    setVacancyPct(5);
    setManagementPct(0);
  };

  const results = useMemo(() => {
    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = loanTermYears * 12;

    const principalAndInterest =
      monthlyRate === 0
        ? loanAmount / numberOfPayments
        : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const maintenance = monthlyRent * (maintenancePct / 100);
    const vacancy = monthlyRent * (vacancyPct / 100);
    const management = monthlyRent * (managementPct / 100);

    const totalMonthlyExpenses =
      principalAndInterest +
      monthlyTaxes +
      monthlyInsurance +
      monthlyHoa +
      maintenance +
      vacancy +
      management;

    const monthlyCashFlow = monthlyRent - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;
    const annualNoi =
      monthlyRent * 12 -
      (monthlyTaxes + monthlyInsurance + monthlyHoa + maintenance + vacancy + management) * 12;

    const capRate = purchasePrice > 0 ? (annualNoi / purchasePrice) * 100 : 0;
    const cashInvested = downPayment;
    const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
    const annualDebtService = principalAndInterest * 12;
    const dscr = annualDebtService > 0 ? annualNoi / annualDebtService : 0;

    const score = calculateDealScore({ monthlyCashFlow, capRate, cashOnCash, dscr });

    return {
      downPayment,
      loanAmount,
      principalAndInterest,
      maintenance,
      vacancy,
      management,
      totalMonthlyExpenses,
      monthlyCashFlow,
      annualCashFlow,
      annualNoi,
      capRate,
      cashOnCash,
      dscr,
      score,
    };
  }, [
    purchasePrice,
    downPaymentPct,
    interestRate,
    loanTermYears,
    monthlyRent,
    monthlyTaxes,
    monthlyInsurance,
    monthlyHoa,
    maintenancePct,
    vacancyPct,
    managementPct,
  ]);

  return (
    <div className="rounded-3xl bg-slate-900/90 backdrop-blur shadow-2xl border border-blue-900/40 p-6">
      <h2 className="text-2xl font-semibold mb-5">Inputs</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput label="Purchase Price" value={purchasePrice} onChange={setPurchasePrice} />
        <PercentInput label="Down Payment %" value={downPaymentPct} onChange={setDownPaymentPct} />
        <SelectInput
          label="Rate Type (Interest Rate or APR)"
          value={rateType}
          onChange={setRateType}
          options={[
            { value: "interest", label: "Interest Rate" },
            { value: "apr", label: "APR" },
          ]}
        />
        <PercentInput label={rateType === "apr" ? "APR %" : "Interest Rate %"} value={interestRate} onChange={setInterestRate} step="0.001" />
        <NumberInput label="Loan Term (Years)" value={loanTermYears} onChange={setLoanTermYears} />
        <NumberInput label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} />
        <NumberInput label="Monthly Taxes" value={monthlyTaxes} onChange={setMonthlyTaxes} />
        <NumberInput label="Monthly Insurance" value={monthlyInsurance} onChange={setMonthlyInsurance} />
        <div className="sm:col-span-2">
          <NumberInput label="Monthly HOA" value={monthlyHoa} onChange={setMonthlyHoa} />
        </div>
        <PercentInput label="Maintenance % of Rent" sublabel="Repairs / upkeep" value={maintenancePct} onChange={setMaintenancePct} />
        <PercentInput label="Management % of Rent" sublabel="Property management fee" value={managementPct} onChange={setManagementPct} />
        <div className="sm:col-span-2">
          <PercentInput label="Vacancy % of Rent" value={vacancyPct} onChange={setVacancyPct} />
        </div>
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 text-sm text-slate-300 space-y-2">
        <div>Suggested defaults: maintenance 8%, vacancy 5%, management 0% to 10%.</div>
        <div>If a listing only shows APR, you can use APR here as a practical estimate. If both APR and interest rate are shown, use the interest rate for cleaner payment math.</div>
      </div>

      {showRestoredHint && (
        <div className="mt-4 rounded-xl border border-blue-900/40 bg-slate-800/60 px-4 py-2 text-xs text-slate-300">
          Last inputs restored
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-900/40 bg-slate-800/40 p-4 text-sm text-slate-300">
        <div>
          This browser remembers your last inputs on this device. No login, no download.
        </div>
        <button
          type="button"
          onClick={clearSavedInputs}
          className="rounded-xl border border-blue-800/50 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/60"
        >
          Reset Inputs
        </button>
      </div>

      <ResultsCardInline results={results} />
    </div>
  );
}


function ResultsCardInline({ results }) {
  const insight = explainDeal(results);
  const suggestions = improveDealSuggestions(results);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Results</h3>
        <div className="text-xs text-slate-400">Quick investment snapshot</div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Quick Insight</div>
        <div className="text-sm text-slate-200 leading-6">{insight}</div>
      </div>

      <div className="rounded-2xl border border-blue-900/40 bg-slate-800/40 p-4 mb-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">How to Improve This Deal</div>
        <ul className="space-y-2 text-sm text-slate-200 leading-6 list-disc pl-5">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Monthly P&I" value={formatCurrency(results.principalAndInterest)} help="Your estimated monthly principal and interest payment on the loan. If APR is used instead of interest rate, this becomes a practical estimate rather than a pure loan payment quote." />
        <MetricCard label="Total Monthly Expenses" value={formatCurrency(results.totalMonthlyExpenses)} help="Your estimated full monthly cost, including loan payment, taxes, insurance, HOA, maintenance, vacancy, and management." />
        <MetricCard label="Monthly Cash Flow" value={formatCurrency(results.monthlyCashFlow)} highlight={cashFlowTone(results.monthlyCashFlow)} help="What is left each month after all estimated expenses are paid. Negative means the property costs you money." />
        <MetricCard label="Cap Rate" value={formatPercent(results.capRate)} highlight={capRateTone(results.capRate)} help="A quick return metric based on property income before financing. Useful for comparing deals fast." />
        <MetricCard label="Cash on Cash" value={formatPercent(results.cashOnCash)} highlight={cashOnCashTone(results.cashOnCash)} help="Your annual return based only on the cash you actually invested." />
        <MetricCard label="DSCR" value={results.dscr.toFixed(2) + "x"} highlight={dscrTone(results.dscr)} help="Debt Service Coverage Ratio. Shows whether the property income covers the loan payment. Above 1.0 means it covers the debt." />
        <MetricCard label="Deal Score" value={results.score.toFixed(1) + " / 10"} highlight={scoreTone(results.score)} help="A simplified 0 to 10 score based on cash flow, cap rate, cash on cash return, and DSCR." />
        <MetricCard label="Deal Rating" value={dealLabel(results.score)} highlight={scoreTone(results.score)} help="A quick summary of the overall deal quality based on the current score." />
        <MetricCard label="Annual Cash Flow" value={formatCurrency(results.annualCashFlow)} highlight={cashFlowTone(results.monthlyCashFlow)} help="Your estimated yearly cash flow based on the current monthly result." />
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight = "slate", help }) {
  const [showHelp, setShowHelp] = useState(false);

  const styles = {
    slate: "bg-slate-800/80 border-blue-900/30 text-white",
    red: "bg-red-950/60 border-red-800 text-red-200",
    yellow: "bg-yellow-950/50 border-yellow-800 text-yellow-200",
    green: "bg-green-950/50 border-green-800 text-green-200",
  };

  const verdict = verdictText(highlight);

  return (
    <div className={`rounded-2xl border p-4 ${styles[highlight]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm opacity-80">{label}</div>
        {help ? (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowHelp(true)}
              onMouseLeave={() => setShowHelp(false)}
              onClick={() => setShowHelp((prev) => !prev)}
              className="h-6 w-6 rounded-full border border-white/20 text-xs font-bold opacity-80 hover:opacity-100"
              aria-label={`More info about ${label}`}
            >
              ?
            </button>
            {showHelp ? (
              <div className="absolute right-0 top-8 z-10 w-64 rounded-xl border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-3 text-xs leading-5 text-slate-200 shadow-2xl">
                {help}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {verdict ? (
        <div className="mt-1 text-xs opacity-80">{verdict}</div>
      ) : null}
    </div>
  );
}

function verdictText(highlight) {
  if (highlight === "red") return "Weak";
  if (highlight === "yellow") return "Average";
  if (highlight === "green") return "Good";
  return null;
}

function explainDeal(results) {
  if (results.monthlyCashFlow < 0) {
    return "This looks weak because the property is estimated to lose money each month after expenses. Start by checking whether rent is too low, expenses are too high, or the purchase price is too aggressive.";
  }

  if (results.dscr < 1) {
    return "This looks risky because the property income does not fully cover the debt payment. Even if the deal looks attractive on the surface, financing pressure is a problem here.";
  }

  if (results.score < 8) {
    return "This looks average or borderline. The deal may work, but the margin of safety is not very wide yet. A better rent estimate, lower price, or lower payment could improve it.";
  }

  return "This looks strong based on the current inputs. The property appears to cover its costs and produce a healthier return, but you should still verify rent, taxes, insurance, and maintenance assumptions.";
}

function improveDealSuggestions(results) {
  const suggestions = [];

  if (results.monthlyCashFlow < 0) {
    suggestions.push("Try a lower purchase price. A better entry price can improve cash flow immediately.");
    suggestions.push("Recheck your rent estimate. Even a modest rent increase can change the result.");
    suggestions.push("Review taxes, insurance, and maintenance assumptions to see if any expenses are too high.");
  }

  if (results.dscr < 1) {
    suggestions.push("Consider a larger down payment or a lower interest rate to reduce loan pressure.");
  }

  if (results.capRate < 6) {
    suggestions.push("Compare nearby rental comps to confirm whether the property price is too high for the income it produces.");
  }

  if (results.cashOnCash < 6) {
    suggestions.push("Look at ways to improve return on invested cash, such as better financing terms or a stronger rent assumption.");
  }

  if (suggestions.length === 0) {
    suggestions.push("This deal already looks healthy on the current inputs. The next step is verifying your assumptions before making a decision.");
  }

  return suggestions;
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-sm text-slate-300 mb-2">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="text-sm text-slate-300 mb-2">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function PercentInput({ label, sublabel, value, onChange, step = "1" }) {
  return (
    <label className="block">
      <div className="text-sm text-slate-300 mb-1">{label}</div>
      {sublabel ? <div className="text-xs text-slate-400 mb-2">{sublabel}</div> : null}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const num = Number(raw);
          if (Number.isNaN(num)) {
            onChange(0);
            return;
          }
          const rounded = Number(num.toFixed(3));
          onChange(rounded);
        }}
        className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function calculateDealScore({ monthlyCashFlow, capRate, cashOnCash, dscr }) {
  let score = 0;

  if (monthlyCashFlow < 0) score += 0;
  else if (monthlyCashFlow < 300) score += 2;
  else if (monthlyCashFlow < 500) score += 3;
  else score += 4;

  if (capRate < 5) score += 0.5;
  else if (capRate < 7) score += 1.5;
  else if (capRate < 9) score += 2.25;
  else score += 2.75;

  if (cashOnCash < 4) score += 0.5;
  else if (cashOnCash < 8) score += 1.25;
  else if (cashOnCash < 12) score += 2;
  else score += 2.5;

  if (dscr < 1) score += 0;
  else if (dscr < 1.2) score += 0.5;
  else if (dscr < 1.35) score += 1;
  else score += 1.5;

  return Math.min(10, score);
}

function dealLabel(score) {
  if (score < 4) return "Weak Deal";
  if (score < 8) return "Borderline";
  return "Strong Deal";
}

function cashFlowTone(value) {
  if (value < 0) return "red";
  if (value < 200) return "yellow";
  return "green";
}

function capRateTone(value) {
  if (value < 5) return "red";
  if (value < 7) return "yellow";
  return "green";
}

function cashOnCashTone(value) {
  if (value < 4) return "red";
  if (value < 8) return "yellow";
  return "green";
}

function dscrTone(value) {
  if (value < 1) return "red";
  if (value < 1.2) return "yellow";
  return "green";
}

function scoreTone(value) {
  if (value < 4) return "red";
  if (value < 8) return "yellow";
  return "green";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}
