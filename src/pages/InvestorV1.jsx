import { useMemo, useState } from "react";

// Free public investor version

export default function App() {
  const [price, setPrice] = useState(500000);
  const [rent, setRent] = useState(3000);
  const [expensesPct, setExpensesPct] = useState(35);
  const [rate, setRate] = useState(6.5);
  const [downPct, setDownPct] = useState(20);
  const [taxes, setTaxes] = useState(300);
  const [insurance, setInsurance] = useState(150);
  const [maintenancePct, setMaintenancePct] = useState(8);
  const [activePopup, setActivePopup] = useState(null);

  const displayResult = useMemo(
    () => calculateDeal({ price, rent, expensesPct, rate, downPct, taxes, insurance, maintenancePct }),
    [price, rent, expensesPct, rate, downPct, taxes, insurance, maintenancePct]
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Rental Deal Screener</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Screen rental deals in seconds. Save time and focus on properties worth deeper analysis.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Deal Inputs</h2>
            <div className="text-xs text-slate-400">Results update automatically as inputs change</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <InputCard label="Purchase Price" value={price} onChange={setPrice} />
            <InputCard label="Monthly Rent" value={rent} onChange={setRent} />
            <InputCard label="Expense Ratio %" value={expensesPct} onChange={setExpensesPct} />
            <InputCard label="Estimated Financing APR %¹" value={rate} onChange={setRate} />
            <InputCard label="Down Payment %" value={downPct} onChange={setDownPct} />
            <InputCard label="Monthly Taxes" value={taxes} onChange={setTaxes} />
            <InputCard label="Monthly Insurance" value={insurance} onChange={setInsurance} />
            <InputCard label="Maintenance %⁸" value={maintenancePct} onChange={setMaintenancePct} />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Results</h2>
            <span className="text-xs text-slate-400">Instant analysis</span>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="NOI²" value={`$${Math.round(displayResult.noi).toLocaleString()}`} />
            <MetricCard label="Cash Flow³" value={`$${Math.round(displayResult.monthlyCashFlow).toLocaleString()}`} />
            <MetricCard label="Cap Rate⁴" value={`${displayResult.capRate.toFixed(2)}%`} />
            <MetricCard label="Cash on Cash⁵" value={`${displayResult.coc.toFixed(1)}%`} />
            <MetricCard label="DSCR⁶" value={`${displayResult.dscr.toFixed(2)}x`} />
            <MetricCard label="Expense Ratio⁷" value={`${expensesPct.toFixed(0)}%`} />
          </div>

          <div className={`mt-8 rounded-2xl border p-5 ${getScoreStyle(displayResult.score)}`}>
            <div className="mb-2 text-sm font-semibold">
              Deal Score: {displayResult.score.toFixed(1)} / 10 ({getScoreLabel(displayResult.score)})
            </div>
            <div className="text-sm opacity-90">
              Based on estimated cap rate, DSCR, operating assumptions, maintenance assumptions, and cash flow strength.
            </div>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-6 text-center text-sm text-slate-300">
            <div className="text-base font-semibold text-blue-300">
              Need bulk analysis, exports, and advanced workflows?
            </div>
            <div className="mt-2 text-sm text-slate-300">
              Explore the professional agent platform at
              <span className="ml-1 font-semibold text-blue-300">rentaldealscreener.pro/agents</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Built for real estate agents, acquisition teams, and high-volume deal screening.
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-7 text-slate-300">
            <div className="mb-3 text-base font-semibold text-slate-100">Disclaimer</div>
            <p>
              This tool is provided for informational, educational, and preliminary real estate screening purposes only.
              It does not constitute financial, legal, tax, lending, appraisal, brokerage, or investment advice.
            </p>
            <p className="mt-4">
              All calculations, including NOI², cash flow³, cap rate⁴, cash-on-cash return⁵, DSCR⁶,
              expense ratio⁷, maintenance assumptions⁸, and score outputs are based on user-provided assumptions and simplified estimation models.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/30 p-5 text-sm leading-7 text-slate-300">
            <div className="mb-3 text-base font-semibold text-slate-100">Footnotes</div>
            <div><span className="font-semibold text-white">1.</span> Estimated Financing APR represents estimated borrowing cost assumptions.</div>
            <div><span className="font-semibold text-white">2.</span> NOI (Net Operating Income) represents income remaining after operating expenses but before mortgage payments.</div>
            <div><span className="font-semibold text-white">3.</span> Cash Flow represents estimated monthly cash remaining after expenses and financing costs.</div>
            <div><span className="font-semibold text-white">4.</span> Cap Rate measures annual property yield relative to purchase price.</div>
            <div><span className="font-semibold text-white">5.</span> Cash-on-Cash Return measures annual cash flow relative to invested cash.</div>
            <div><span className="font-semibold text-white">6.</span> DSCR (Debt Service Coverage Ratio) measures whether property income can safely cover debt obligations.</div>
            <div><span className="font-semibold text-white">7.</span> Expense Ratio measures the percentage of rental income consumed by operating expenses.</div>
            <div><span className="font-semibold text-white">8.</span> Maintenance % estimates ongoing repair and upkeep costs associated with the property.</div>
          </div>

          <footer className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-400">
            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={() => setActivePopup("contact")} className="hover:text-white">Contact</button>
              <button onClick={() => setActivePopup("support")} className="hover:text-white">Support</button>
              <a href="/terms" className="hover:text-white">Terms</a>
              <a href="/privacy" className="hover:text-white">Privacy</a>
              <a href="/disclaimer" className="hover:text-white">Disclaimer</a>
            </div>
            <div className="mt-3">© 2026 Rental Deal Screener · Operated by Caribmare LLC</div>
          </footer>

          {activePopup && (
            <PopupModal type={activePopup} onClose={() => setActivePopup(null)} />
          )}
        </section>
      </div>
    </div>
  );
}

function calculateDeal({ price, rent, expensesPct, rate, downPct, taxes, insurance, maintenancePct = 8 }) {
  const annualRent = rent * 12;
  const loanAmount = price * (1 - downPct / 100);
  const operatingExpenses = annualRent * (expensesPct / 100);
  const maintenanceExpense = annualRent * (maintenancePct / 100);
  const fixedExpenses = (taxes + insurance) * 12;
  const totalExpenses = operatingExpenses + fixedExpenses + maintenanceExpense;
  const noi = annualRent - totalExpenses;
  const capRate = price > 0 ? (noi / price) * 100 : 0;
  const monthlyDebt = (loanAmount * (rate / 100)) / 12;
  const dscr = monthlyDebt > 0 ? noi / 12 / monthlyDebt : 0;
  const annualCashFlow = noi - monthlyDebt * 12;
  const monthlyCashFlow = annualCashFlow / 12;
  const cashInvested = price * (downPct / 100);
  const coc = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;

  let score = 0;

  if (capRate < 5) score += 1;
  else if (capRate < 7) score += 2;
  else score += 3;

  if (dscr < 1) score += 0;
  else if (dscr < 1.2) score += 1;
  else score += 3;

  if (expensesPct >= 45) score += 1;
  else if (expensesPct >= 35) score += 2;
  else score += 3;

  if (maintenancePct >= 15) score += 0;
  else if (maintenancePct >= 8) score += 1;
  else score += 2;

  if (noi > 0) score += 1;

  return {
    noi,
    capRate,
    dscr,
    coc,
    monthlyCashFlow,
    maintenanceExpense,
    score: Math.min(10, score),
  };
}

function InputCard({ label, value, onChange }) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-blue-500"
      />
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center shadow-lg">
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function getScoreStyle(score) {
  if (score >= 8) return "border-green-500/40 bg-green-500/10 text-green-300";
  if (score >= 5) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getScoreLabel(score) {
  if (score >= 8) return "High";
  if (score >= 5) return "Average";
  return "Low";
}

function PopupModal({ type, onClose }) {
  const content = {
    contact: {
      title: "Contact",
      body: "For business inquiries, partnerships, or investor questions, contact: support@rentaldealscreener.pro",
    },
    support: {
      title: "Support",
      body: "Technical support is currently provided through email support@rentaldealscreener.pro. Response times may vary during beta testing.",
    },
  };

  const selected = content[type];
  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">{selected.title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="text-sm leading-7 text-slate-300">{selected.body}</div>
      </div>
    </div>
  );
}

function testCalculateDealScenarios() {
  const strongDeal = calculateDeal({ price: 300000, rent: 3500, expensesPct: 30, rate: 6, downPct: 20, taxes: 200, insurance: 100, maintenancePct: 6 });
  const weakDeal = calculateDeal({ price: 700000, rent: 2500, expensesPct: 50, rate: 9, downPct: 10, taxes: 500, insurance: 300, maintenancePct: 15 });
  const lowRateDeal = calculateDeal({ price: 400000, rent: 3200, expensesPct: 35, rate: 5, downPct: 25, taxes: 250, insurance: 120, maintenancePct: 8 });
  const highRateDeal = calculateDeal({ price: 400000, rent: 3200, expensesPct: 35, rate: 9, downPct: 25, taxes: 250, insurance: 120, maintenancePct: 8 });

  return {
    strongScoreIsHigh: strongDeal.score >= 8,
    weakScoreIsLow: weakDeal.score <= 4,
    higherRateReducesCashFlow: lowRateDeal.monthlyCashFlow > highRateDeal.monthlyCashFlow,
    higherRateReducesDscr: lowRateDeal.dscr > highRateDeal.dscr,
    maintenanceReducesNoi: calculateDeal({ price: 400000, rent: 3200, expensesPct: 35, rate: 6, downPct: 20, taxes: 250, insurance: 120, maintenancePct: 15 }).noi < calculateDeal({ price: 400000, rent: 3200, expensesPct: 35, rate: 6, downPct: 20, taxes: 250, insurance: 120, maintenancePct: 5 }).noi,
  };
}
