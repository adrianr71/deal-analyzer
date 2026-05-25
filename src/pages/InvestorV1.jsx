import { useMemo, useState } from "react";

// Free public investor version

export default function App() {
  const [price, setPrice] = useState("");
  const [rent, setRent] = useState("");
  const [hoa, setHoa] = useState("");
  const [vacancyPct, setVacancyPct] = useState("");
  const [managementPct, setManagementPct] = useState("");
  const [rate, setRate] = useState("");
  const [downPct, setDownPct] = useState("");
  const [taxes, setTaxes] = useState("");
  const [insurance, setInsurance] = useState("");
  const [maintenancePct, setMaintenancePct] = useState("");
  const [activePopup, setActivePopup] = useState(null);

  const displayResult = useMemo(
    () => calculateDeal({ price, rent, rate, downPct, taxes, insurance, maintenancePct, hoa, vacancyPct, managementPct }),
    [price, rent, rate, downPct, taxes, insurance, maintenancePct, hoa, vacancyPct, managementPct]
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
            <InputCard label="Purchase Price" value={price} placeholder="500000" onChange={setPrice} />
            <InputCard label="Monthly Rent" value={rent} placeholder="3000" onChange={setRent} />
            <InputCard label="HOA Monthly" value={hoa} placeholder="0" onChange={setHoa} />
            <InputCard label="Vacancy Per Year %" value={vacancyPct} placeholder="5" onChange={setVacancyPct} />
            <InputCard label="Management Fee %" value={managementPct} placeholder="0" onChange={setManagementPct} />
            <InputCard label="Estimated Financing APR %¹" value={rate} placeholder="6.5" onChange={setRate} />
            <InputCard label="Down Payment %" value={downPct} placeholder="20" onChange={setDownPct} />
            <InputCard label="Monthly Taxes" value={taxes} placeholder="300" onChange={setTaxes} />
            <InputCard label="Monthly Insurance" value={insurance} placeholder="150" onChange={setInsurance} />
            <InputCard label="Maintenance Cost %²" value={maintenancePct} placeholder="8" onChange={setMaintenancePct} />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Results</h2>
            <span className="text-xs text-slate-400">Instant analysis</span>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="NOI³" value={`$${Math.round(displayResult.noi).toLocaleString()}`} />
            <MetricCard label="Cash Flow⁴" value={`$${Math.round(displayResult.monthlyCashFlow).toLocaleString()}`} />
            <MetricCard label="Cap Rate⁵" value={`${displayResult.capRate.toFixed(2)}%`} />
            <MetricCard label="Cash on Cash⁶" value={`${displayResult.coc.toFixed(1)}%`} />
            <MetricCard label="DSCR⁷" value={`${displayResult.dscr.toFixed(2)}x`} />
            <MetricCard label="Expense Ratio⁸" value={`${displayResult.expenseRatio.toFixed(0)}%`} />
          </div>

          <div className={`mt-8 rounded-2xl border p-5 ${getScoreStyle(displayResult.score)}`}>
            <div className="mb-2 text-sm font-semibold">
              Deal Score: {displayResult.score.toFixed(1)} / 10 ({getScoreLabel(displayResult.score)})
            </div>
            <div className="text-sm opacity-90">
              Based on estimated cap rate, DSCR, vacancy assumptions, management assumptions, maintenance assumptions, and cash flow strength.
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-950/60 via-slate-900 to-cyan-950/60 p-6 text-center shadow-2xl shadow-blue-950/30">
            <div className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              Professional Agent Platform
            </div>

            <div className="mt-4 text-2xl font-bold leading-tight text-white md:text-3xl">
              Need to screen dozens of properties at once?
            </div>

            <div className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-200">
              The professional agent platform supports <span className="font-semibold text-cyan-300">bulk analysis</span>, <span className="font-semibold text-cyan-300">CSV imports & exports</span>, and <span className="font-semibold text-cyan-300">advanced deal scoring workflows</span> designed for quickly comparing large property lists.
            </div>

            <div className="mt-6">
              <a
                href="/agents"
                className="inline-flex items-center rounded-2xl border border-blue-400/40 bg-blue-500/20 px-6 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/30"
              >
                Explore Professional Agent Platform →
              </a>
            </div>

            <div className="mt-4 text-xs leading-6 text-slate-400">
              Built for investors and agents who need to quickly analyze and compare large property lists.
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-7 text-slate-300">
            <div className="mb-3 text-base font-semibold text-slate-100">Disclaimer</div>
            <p>
              This tool is provided for informational, educational, and preliminary real estate screening purposes only.
              It does not constitute financial, legal, tax, lending, appraisal, brokerage, or investment advice.
            </p>
            <p className="mt-4">
              All calculations, including maintenance assumptions², NOI³, cash flow⁴, cap rate⁵, cash-on-cash return⁶, DSCR⁷, expense ratio⁸, vacancy assumptions, and management assumptions, and score outputs are based on user-provided assumptions and simplified estimation models.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/30 p-5 text-sm leading-7 text-slate-300">
            <div className="mb-3 text-base font-semibold text-slate-100">Footnotes</div>
            <div><span className="text-[15px] font-semibold text-white">1.</span> Estimated Financing APR represents estimated borrowing cost assumptions.</div>
            <div><span className="text-[15px] font-semibold text-white">2.</span> Maintenance Cost % estimates ongoing repair and upkeep costs associated with the property.</div>
            <div><span className="text-[15px] font-semibold text-white">3.</span> NOI (Net Operating Income) represents income remaining after operating expenses but before mortgage payments.</div>
            <div><span className="text-[15px] font-semibold text-white">4.</span> Cash Flow represents estimated monthly cash remaining after expenses and financing costs.</div>
            <div><span className="text-[15px] font-semibold text-white">5.</span> Cap Rate measures annual property yield relative to purchase price.</div>
            <div><span className="text-[15px] font-semibold text-white">6.</span> Cash-on-Cash Return measures annual cash flow relative to invested cash.</div>
            <div><span className="text-[15px] font-semibold text-white">7.</span> DSCR (Debt Service Coverage Ratio) measures whether property income can safely cover debt obligations.</div>
            <div><span className="text-[15px] font-semibold text-white">8.</span> Expense Ratio is automatically calculated from taxes, insurance, HOA, maintenance, vacancy assumptions, and management assumptions relative to rental income.</div>
            
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

function calculateDeal({ price, rent, rate, downPct, taxes, insurance, maintenancePct = 8, hoa = 0, vacancyPct = 5, managementPct = 0 }) {
  const annualRent = rent * 12;
  const loanAmount = price * (1 - downPct / 100);
  const maintenanceExpense = annualRent * (maintenancePct / 100);
  const vacancyExpense = annualRent * (vacancyPct / 100);
  const managementExpense = annualRent * (managementPct / 100);
  const fixedExpenses = (taxes + insurance + hoa) * 12;
  const totalExpenses = fixedExpenses + maintenanceExpense + vacancyExpense + managementExpense;
  const expenseRatio = annualRent > 0 ? (totalExpenses / annualRent) * 100 : 0;
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

  if (expenseRatio >= 45) score += 1;
  else if (expenseRatio >= 35) score += 2;
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
    expenseRatio,
    score: Math.min(10, score),
  };
}

function InputCard({ label, value, placeholder = "", onChange }) {
  return (
    <div>
      <div className="mb-2 text-sm uppercase tracking-wide text-slate-400">{label}</div>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? "" : Number(nextValue));
        }}
        className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-blue-500"
      />
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center shadow-lg">
      <div className="mb-2 text-sm uppercase tracking-wide text-slate-400">{label}</div>
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
  const strongDeal = calculateDeal({ price: 300000, rent: 3500, rate: 6, downPct: 20, taxes: 200, insurance: 100, maintenancePct: 6, hoa: 0, vacancyPct: 5, managementPct: 0 });
  const weakDeal = calculateDeal({ price: 700000, rent: 2500, rate: 9, downPct: 10, taxes: 500, insurance: 300, maintenancePct: 15, hoa: 800, vacancyPct: 10, managementPct: 10 });
  const lowRateDeal = calculateDeal({ price: 400000, rent: 3200, rate: 5, downPct: 25, taxes: 250, insurance: 120, maintenancePct: 8, hoa: 0, vacancyPct: 5, managementPct: 0 });
  const highRateDeal = calculateDeal({ price: 400000, rent: 3200, rate: 9, downPct: 25, taxes: 250, insurance: 120, maintenancePct: 8, hoa: 0, vacancyPct: 5, managementPct: 0 });

  return {
    strongScoreIsHigh: strongDeal.score >= 8,
    weakScoreIsLow: weakDeal.score <= 4,
    higherRateReducesCashFlow: lowRateDeal.monthlyCashFlow > highRateDeal.monthlyCashFlow,
    higherRateReducesDscr: lowRateDeal.dscr > highRateDeal.dscr,
    maintenanceReducesNoi: calculateDeal({ price: 400000, rent: 3200, rate: 6, downPct: 20, taxes: 250, insurance: 120, maintenancePct: 15, hoa: 0, vacancyPct: 5, managementPct: 0 }).noi < calculateDeal({ price: 400000, rent: 3200, rate: 6, downPct: 20, taxes: 250, insurance: 120, maintenancePct: 5, hoa: 0, vacancyPct: 5, managementPct: 0 }).noi,
  };
}
