import { useMemo, useRef, useState } from "react";

const DEFAULT_ASSUMPTIONS = {
  closingCostsPct: 3,
  rehabBudget: 15000,
  hoaMonthly: 0,
  downPaymentPct: 20,
  interestRate: 6.75,
  loanTermYears: 30,
  taxRatePct: 1.2,
  monthlyInsurance: 250,
  maintenancePct: 8,
  vacancyPct: 5,
  managementPct: 0,
  singleRent: 2200,
  duplexRent: 2000,
  triplexRent: 1800,
  quadRent: 1700,
};

const SAMPLE_ROWS = [
  { mls: "SAMPLE-001", type: "Triplex", address: "123 Sample Avenue", city: "Miami", state: "FL", price: 725000, rentManual: 5400 },
];

const AGENT_BATCH_LIMIT = 100;
const AGENT_FREE_TRIALS = 3;
const SESSION_KEY = "agent_analyzer_session";
const TRIAL_KEY = "agent_trial_count";
const PAID_ACCESS_VALUE = 999;

const MLS_FIELD_MAP = {
  price: ["price", "list price", "asking price", "current price", "lp", "listprice"],
  address: ["address", "street address", "property address", "street"],
  city: ["city", "city name", "municipality"],
  state: ["state", "province"],
  zip: ["zip", "zip code", "postal code", "zipcode"],
  type: ["property type", "type", "propertytype"],
  mls: ["mls", "mls number", "mls #", "listing id", "listingid"],
  rent: ["rent", "monthly rent", "gross rent", "estimated rent"],
};

export default function App() {
  const fileInputRef = useRef(null);
  const [rows, setRows] = useState(() => loadSavedRows());
  const [sortBy, setSortBy] = useState("score");
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [analyzedRows, setAnalyzedRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchAnalyzed, setBatchAnalyzed] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [remainingTrials, setRemainingTrials] = useState(() => loadRemainingTrials());

  const isPaid = remainingTrials === PAID_ACCESS_VALUE;
  const sortedAnalyzedRows = useMemo(() => sortRows(analyzedRows, sortBy), [analyzedRows, sortBy]);
  const samplePreviewRows = useMemo(() => analyzeRows(SAMPLE_ROWS, assumptions), [assumptions]);

  function handleAssumptionsChange(nextAssumptions) {
    setAssumptions(nextAssumptions);
    if (batchAnalyzed && rows.length > 0) {
      setAnalyzedRows(analyzeRows(rows, nextAssumptions));
    }
  }

  function updateRowRent(rowToUpdate, value) {
    const updatedRows = rows.map((row) => {
      const sameMls = row.mls && row.mls === rowToUpdate.mls;
      const sameAddress = row.address === rowToUpdate.address && row.city === rowToUpdate.city && row.price === rowToUpdate.price;
      if (!sameMls && !sameAddress) return row;
      return { ...row, rentManual: value === "" ? null : Number(value) };
    });

    setRows(updatedRows);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedRows));

    if (batchAnalyzed) {
      setAnalyzedRows(analyzeRows(updatedRows, assumptions));
    }
  }

  function startNewSession() {
    setRows([]);
    setAnalyzedRows([]);
    setBatchAnalyzed(false);
    setIsProcessing(false);
    sessionStorage.removeItem(SESSION_KEY);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!isPaid && remainingTrials <= 0) {
      setShowUpgradeModal(true);
    }
  }

  function activateDeveloperAccess() {
    setRemainingTrials(PAID_ACCESS_VALUE);
    localStorage.setItem(TRIAL_KEY, String(PAID_ACCESS_VALUE));
    setShowUpgradeModal(false);
  }

  function runFreeTrialBatch() {
    if (isProcessing) return;

    if (batchAnalyzed) {
      alert("This batch has already been analyzed. Start the next batch before running another analysis.");
      return;
    }

    if (!isPaid && remainingTrials <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    if (rows.length === 0) {
      alert("Please import a CSV file before analyzing a batch.");
      return;
    }

    if (rows.length > AGENT_BATCH_LIMIT) {
      alert(`Each batch supports up to ${AGENT_BATCH_LIMIT} properties.`);
      return;
    }

    setIsProcessing(true);

    window.setTimeout(() => {
      const analyzed = analyzeRows(rows, assumptions);
      setAnalyzedRows(analyzed);
      setBatchAnalyzed(true);
      logCalculateEvent(rows);

      if (!isPaid) {
        const updatedTrials = Math.max(0, remainingTrials - 1);
        setRemainingTrials(updatedTrials);
        localStorage.setItem(TRIAL_KEY, String(updatedTrials));
      }

      setIsProcessing(false);
    }, 120);
  }

  function handleExportCSV() {
    exportAgentCSV(sortedAnalyzedRows);
    logCalculateEvent(rows);
  }

  function handlePrintSummary() {
    logCalculateEvent(rows);
    window.print();
  }

  function handleImportCSV(event) {
    console.log("CSV import triggered");
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a CSV file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      const text = String(loadEvent.target?.result || "");
      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        alert("No property rows found in the CSV.");
        return;
      }

      const headers = splitCsvLine(lines[0]).map((header) => stripOuterQuotes(header).trim());
      const parsedRows = lines
        .slice(1)
        .map((line) => {
          const values = splitCsvLine(line).map((value) => stripOuterQuotes(value).trim());
          const rawRow = {};
          headers.forEach((header, index) => {
            rawRow[header] = values[index] || "";
          });
          return mapMlsRow(rawRow);
        })
        .filter((row) => row.address || row.price || row.mls);

      const limitedRows = parsedRows.slice(0, AGENT_BATCH_LIMIT);
      setRows(limitedRows);
      setAnalyzedRows([]);
      setBatchAnalyzed(false);
      setIsProcessing(false);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(limitedRows));

      if (parsedRows.length > AGENT_BATCH_LIMIT) {
        alert(`Only the first ${AGENT_BATCH_LIMIT} properties were imported for this batch.`);
      }
    };

    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-5">
          <header>
            <h1 className="text-3xl font-bold">Rental Deal Screener for Real Estate Agents</h1>
            <p className="mt-1 text-sm text-slate-400">
              Bulk screen rental deals in seconds. Save hours of spreadsheet work and focus on properties worth deeper analysis.
            </p>

            <div className="mt-5 overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-r from-blue-950/80 via-slate-900 to-cyan-950/70 p-6 shadow-2xl shadow-blue-950/30">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
                    Professional Agent Platform
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <div className="text-5xl font-black tracking-tight text-white md:text-6xl">
                      $49
                    </div>
                    <div className="pb-2 text-lg font-medium text-slate-300">
                      /month
                    </div>
                  </div>

                  <div className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                    Bulk analyze up to 100 rental properties at once with professional deal scoring, CSV imports & exports, cash flow analysis, NOI calculations, and advanced investor workflows.
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                      Individual Professional Plan
                    </div>
                    <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                      Cancel Anytime
                    </div>
                    <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                      Access Across Personal Devices
                    </div>
                  </div>
                </div>

                <div className="min-w-[260px] rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5 text-center">
                  {!isPaid ? (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                        Free Trial Included
                      </div>

                      <div className="mt-3 text-3xl font-bold text-white">
                        {remainingTrials} Free
                      </div>

                      <div className="mt-1 text-sm text-slate-300">
                        Batch Analyses Remaining
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-green-300">
                        Professional Access Active
                      </div>

                      <div className="mt-3 text-3xl font-bold text-white">
                        Unlimited
                      </div>

                      <div className="mt-1 text-sm text-slate-300">
                        Monthly Batch Access
                      </div>

                      <div className="mt-4 text-xs leading-6 text-slate-400">
                        Your professional subscription is currently active.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-semibold text-white">How It Works</div>
              <button
                type="button"
                onClick={() => setShowInstructions((prev) => !prev)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {showInstructions ? "Hide Instructions ▲" : "Show Instructions ▼"}
              </button>
            </div>

            {showInstructions && (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StepCard number="1" title="Import CSV File (100 Properties Max)" description="Upload a CSV containing up to 100 rental property listings per batch." />
                <StepCard number="2" title="Set Global Assumptions" description="Adjust financing, vacancy, maintenance, insurance, taxes, and rent assumptions." />
                <StepCard number="3" title="Analyze & Score Batch" description="Calculate NOI, cash flow, cap rate, CoC, DSCR, and professional deal scores." />
                <StepCard number="4" title="Export or Print Results" description="Export the full analyzed CSV or generate a printable investment summary." />
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="print:hidden">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-full rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Import CSV File
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportCSV}
              />
            </div>

            <button
              onClick={startNewSession}
              disabled={!batchAnalyzed}
              className={`rounded-2xl px-5 py-4 text-sm font-semibold transition ${!batchAnalyzed
                ? "cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-600"
                : "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              }`}
            >
              Start Next Batch
            </button>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();

                const droppedFile = event.dataTransfer.files?.[0];
                if (!droppedFile) return;

                const syntheticEvent = {
                  target: {
                    files: [droppedFile],
                  },
                };

                handleImportCSV(syntheticEvent);
              }}
              className="flex min-h-[64px] flex-1 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-cyan-500/40 bg-slate-950/50 px-6 py-4 text-center transition hover:border-cyan-400/70 hover:bg-cyan-500/5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportCSV}
              />

              <div>
                <div className="text-sm font-semibold text-cyan-300">
                  Drag & Drop CSV File Here
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  100 Properties Max
                </div>
              </div>
            </label>
          </div>
        </div>

        <AssumptionsPanel assumptions={assumptions} setAssumptions={handleAssumptionsChange} />

        <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
          <button
            onClick={runFreeTrialBatch}
            disabled={isProcessing || batchAnalyzed}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${isProcessing || batchAnalyzed
              ? "cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500"
              : "border border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
            }`}
          >
            {isProcessing
              ? "Analyzing Batch..."
              : batchAnalyzed
                ? "Batch Already Analyzed"
                : isPaid
                  ? "Analyze Batch"
                  : `Analyze Batch • ${remainingTrials} Free Batches Remaining`}
          </button>

          <div className="text-sm font-medium text-slate-300">Sort Results By:</div>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white"
          >
            <option value="score">Highest Score</option>
            <option value="cashFlow">Highest Cash Flow</option>
            <option value="price">Lowest Price</option>
          </select>
        </div>

        <PrintSummary rows={sortedAnalyzedRows} assumptions={assumptions} />

        <ResultsTable
          isProcessing={isProcessing}
          rows={sortedAnalyzedRows}
          sampleRows={samplePreviewRows}
          onUpdateRent={updateRowRent}
        />

        <div className="mt-6 mb-6 flex flex-wrap items-center gap-3 print:hidden">
          <button
            onClick={handleExportCSV}
            disabled={sortedAnalyzedRows.length === 0}
            className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Full CSV Results
          </button>
          <button
            onClick={handlePrintSummary}
            disabled={sortedAnalyzedRows.length === 0}
            className="rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print Investment Summary
          </button>
        </div>

        <div className="print:hidden"><MathLogicNote onDeveloperUnlock={activateDeveloperAccess} /></div>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-400">
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => setActiveLegalModal("contact")} className="transition hover:text-white">
              Contact
            </button>
            <button onClick={() => setActiveLegalModal("support")} className="transition hover:text-white">
              Support
            </button>
            <a href="/terms" className="transition hover:text-white">
              Terms
            </a>
            <a href="/privacy" className="transition hover:text-white">
              Privacy
            </a>
            <a href="/disclaimer" className="transition hover:text-white">
              Disclaimer
            </a>
          </div>
          <div className="mt-3">© 2026 RentalDealScreener.pro · Operated by Caribmare LLC</div>
        </footer>

        {activeLegalModal && <LegalModal type={activeLegalModal} onClose={() => setActiveLegalModal(null)} />}
        {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      </div>
    </div>
  );
}

function loadSavedRows() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadRemainingTrials() {
  try {
    const saved = localStorage.getItem(TRIAL_KEY);
    return saved ? Number(saved) : AGENT_FREE_TRIALS;
  } catch {
    return AGENT_FREE_TRIALS;
  }
}

function analyzeRows(rows, assumptions) {
  return rows.map((row) => analyzeRow(row, assumptions));
}

function analyzeRow(row, assumptions) {
  const normalized = normalizePropertyType(row.type);
  const units = normalized.units;
  const rentPerUnit = units === 4 ? assumptions.quadRent : units === 3 ? assumptions.triplexRent : units === 2 ? assumptions.duplexRent : assumptions.singleRent;
  const monthlyRent = row.rentManual ?? units * rentPerUnit;
  const closingCosts = row.price * (assumptions.closingCostsPct / 100);
  const rehabBudget = assumptions.rehabBudget;
  const downPayment = row.price * (assumptions.downPaymentPct / 100);
  const loanAmount = row.price - downPayment;
  const monthlyRate = assumptions.interestRate / 100 / 12;
  const numberOfPayments = assumptions.loanTermYears * 12;
  const debtService = monthlyRate === 0 ? loanAmount / numberOfPayments : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  const monthlyTaxes = (row.price * (assumptions.taxRatePct / 100)) / 12;
  const insurance = assumptions.monthlyInsurance;
  const maintenance = monthlyRent * (assumptions.maintenancePct / 100);
  const vacancy = monthlyRent * (assumptions.vacancyPct / 100);
  const management = monthlyRent * (assumptions.managementPct / 100);
  const hoa = assumptions.hoaMonthly;
  const operatingExpenses = monthlyTaxes + insurance + maintenance + vacancy + management + hoa;
  const noiMonthly = monthlyRent - operatingExpenses;
  const noiAnnual = noiMonthly * 12;
  const monthlyCashFlow = noiMonthly - debtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const annualDebtService = debtService * 12;
  const capRate = row.price > 0 ? (noiAnnual / row.price) * 100 : 0;
  const totalCashInvested = downPayment + closingCosts + rehabBudget;
  const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : 0;
  const expenseRatio = monthlyRent > 0 ? (operatingExpenses / monthlyRent) * 100 : 0;
  const score = calculateDealScore({ monthlyCashFlow, capRate, cashOnCash, dscr, noiAnnual, expenseRatio });
  const rating = score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Moderate" : score >= 40 ? "Weak" : "High Risk";
  const tone = score >= 85 ? "green" : score >= 55 ? "yellow" : "red";

  return {
    ...row,
    units,
    propertyType: normalized.propertyType,
    monthlyRent,
    operatingExpenses,
    expenseRatio,
    noiMonthly,
    monthlyCashFlow,
    capRate,
    cashOnCash,
    dscr,
    score,
    rating,
    tone,
  };
}

function sortRows(rows, sortBy) {
  return [...rows].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "cashFlow") return b.monthlyCashFlow - a.monthlyCashFlow;
    if (sortBy === "price") return a.price - b.price;
    return 0;
  });
}

function ResultsTable({ isProcessing, rows, sampleRows, onUpdateRent }) {
  const showSample = !isProcessing && rows.length === 0;
  const visibleRows = showSample ? sampleRows : rows;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/90 shadow-2xl print:hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] border-collapse text-sm">
          <colgroup>
            <col className="w-[115px]" />
            <col className="w-[70px]" />
            <col className="w-[105px]" />
            <col />
            <col className="w-[95px]" />
            <col className="w-[100px]" />
            <col className="w-[110px]" />
            <col className="w-[82px]" />
            <col className="w-[108px]" />
            <col className="w-[88px]" />
            <col className="w-[84px]" />
            <col className="w-[84px]" />
            <col className="w-[102px]" />
          </colgroup>
          <thead className="bg-slate-950">
            <tr className="text-slate-200">
              <TableHeader>RATING</TableHeader>
              <TableHeader>SCORE</TableHeader>
              <TableHeader>PROPERTY<br />TYPE</TableHeader>
              <TableHeader align="left">ADDRESS</TableHeader>
              <TableHeader>CITY</TableHeader>
              <TableHeader>PRICE</TableHeader>
              <TableHeader>RENT</TableHeader>
              <TableHeader>NOI<span className="ml-0.5 align-super text-sm font-bold text-slate-300">2</span></TableHeader>
              <TableHeader>MONTHLY<br />CASH FLOW<span className="ml-0.5 align-super text-sm font-bold text-slate-300">3</span></TableHeader>
              <TableHeader>CAP RATE<span className="ml-0.5 align-super text-sm font-bold text-slate-300">4</span></TableHeader>
              <TableHeader>COC<span className="ml-0.5 align-super text-sm font-bold text-slate-300">5</span></TableHeader>
              <TableHeader>DSCR<span className="ml-0.5 align-super text-sm font-bold text-slate-300">6</span></TableHeader>
              <TableHeader>EXPENSE<br />RATIO<span className="ml-0.5 align-super text-sm font-bold text-slate-300">7</span></TableHeader>
            </tr>
          </thead>
          <tbody>
            {isProcessing ? (
              <tr><td colSpan={13} className="h-32 border border-slate-800 text-center text-sm text-blue-300">Processing professional deal scoring model...</td></tr>
            ) : (
              visibleRows.map((row, index) => (
                <ResultRow key={row.mls || `${row.address}-${index}`} row={row} isSample={showSample} onUpdateRent={onUpdateRent} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultRow({ row, isSample, onUpdateRent }) {
  const expenseRatio = row.monthlyRent > 0 ? (row.operatingExpenses / row.monthlyRent) * 100 : 0;

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-900/60">
      <BodyCell>
        <div className="flex flex-col items-center gap-1">
          <DecisionBadge label={row.rating} tone={row.tone} />
          {isSample && <span className="text-[10px] uppercase tracking-wide text-slate-500 opacity-70">Sample Preview</span>}
        </div>
      </BodyCell>
      <BodyCell strong>{row.score.toFixed(1)}</BodyCell>
      <BodyCell>{row.propertyType}</BodyCell>
      <BodyCell align="left" className="break-words">{row.address}</BodyCell>
      <BodyCell className="whitespace-normal break-words leading-5">{row.city}</BodyCell>
      <BodyCell strong>{formatCurrency(row.price)}</BodyCell>
      <BodyCell>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          type="number"
          value={isSample ? "" : row.rentManual ?? ""}
          placeholder={String(Math.round(row.monthlyRent))}
          readOnly={isSample}
          onChange={(event) => onUpdateRent(row, event.target.value)}
          className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-center text-sm"
        />
      </BodyCell>
      <BodyCell strong className={row.noiMonthly >= 0 ? "text-green-400" : "text-red-400"}>{formatCurrency(row.noiMonthly * 12)}</BodyCell>
      <BodyCell strong className={row.monthlyCashFlow >= 0 ? "text-green-400" : "text-red-400"}>{formatCurrency(row.monthlyCashFlow)}</BodyCell>
      <BodyCell compact><MetricBox value={formatPercent(row.capRate)} status={metricStatus(row.capRate, "cap")} compact /></BodyCell>
      <BodyCell compact><MetricBox value={formatPercent(row.cashOnCash)} status={metricStatus(row.cashOnCash, "coc")} compact /></BodyCell>
      <BodyCell compact><MetricBox value={`${row.dscr.toFixed(2)}x`} status={metricStatus(row.dscr, "dscr")} compact /></BodyCell>
      <BodyCell compact><MetricBox value={`${expenseRatio.toFixed(0)}%`} status={metricStatus(expenseRatio, "expense")} compact /></BodyCell>
    </tr>
  );
}

function StepCard({ number, title, description }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-300">Step {number}</div>
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
    </div>
  );
}

function PrintSummary({ rows, assumptions }) {
  const topDeal = rows?.[0];
  if (!topDeal) return null;

  return (
    <div className="hidden print:block print:bg-white print:p-8 print:text-black">
      <div className="mb-6 border-b border-slate-300 pb-4">
        <div className="text-2xl font-bold">Investment Summary</div>
        <div className="mt-1 text-sm text-slate-600">Rental Deal Screener for Real Estate Agents</div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div><div className="font-semibold">Property</div><div>{topDeal.address}</div><div>{topDeal.city}, {topDeal.state}</div></div>
        <div><div className="font-semibold">Summary</div><div>Score: {topDeal.score.toFixed(1)} / 100</div><div>Rating: {topDeal.rating}</div><div>Property Type: {topDeal.propertyType}</div></div>
      </div>
      <table className="mb-6 w-full border-collapse text-sm">
        <tbody>
          <PrintRow label="Price" value={formatCurrency(topDeal.price)} />
          <PrintRow label="Annual NOI" value={formatCurrency(topDeal.noiMonthly * 12)} />
          <PrintRow label="Monthly Cash Flow" value={formatCurrency(topDeal.monthlyCashFlow)} />
          <PrintRow label="Cap Rate" value={formatPercent(topDeal.capRate)} />
          <PrintRow label="Cash-on-Cash Return" value={formatPercent(topDeal.cashOnCash)} />
          <PrintRow label="Debt Coverage Ratio" value={`${topDeal.dscr.toFixed(2)}x`} />
          <PrintRow label="Expense Ratio" value={`${topDeal.expenseRatio.toFixed(1)}%`} />
          <PrintRow label="Estimated Financing APR" value={`${assumptions.interestRate}%`} />
        </tbody>
      </table>
      <div className="text-xs leading-5 text-slate-600">This print summary is for preliminary investment screening and educational analysis only. Users should independently verify rent, financing, expenses, taxes, insurance, repairs, vacancies, and investment suitability.</div>
    </div>
  );
}

function PrintRow({ label, value }) {
  return <tr><td className="border border-slate-300 px-3 py-2 font-semibold">{label}</td><td className="border border-slate-300 px-3 py-2 text-right">{value}</td></tr>;
}

function TableHeader({ children, align = "center" }) {
  return <th className={`border border-slate-700 px-2 py-3 align-middle leading-5 whitespace-normal break-words ${align === "left" ? "text-left" : "text-center"}`}>{children}</th>;
}

function BodyCell({ children, align = "center", strong = false, compact = false, className = "" }) {
  return <td className={`border border-slate-800 ${compact ? "px-1.5" : "px-2"} py-5 align-middle ${align === "left" ? "text-left" : "text-center"} ${strong ? "font-semibold" : ""} ${className}`}>{children}</td>;
}

function normalizeHeader(header) {
  return String(header || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function findMappedField(headers, aliases) {
  const normalizedHeaders = headers.map((header) => ({ original: header, normalized: normalizeHeader(header) }));

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const exact = normalizedHeaders.find((item) => item.normalized === normalizedAlias);
    if (exact) return exact.original;
    const partial = normalizedHeaders.find((item) => item.normalized.includes(normalizedAlias) || normalizedAlias.includes(item.normalized));
    if (partial) return partial.original;
  }

  return null;
}

function mapMlsRow(row) {
  const headers = Object.keys(row || {});
  const mapped = {
    price: findMappedField(headers, MLS_FIELD_MAP.price),
    address: findMappedField(headers, MLS_FIELD_MAP.address),
    city: findMappedField(headers, MLS_FIELD_MAP.city),
    state: findMappedField(headers, MLS_FIELD_MAP.state),
    zip: findMappedField(headers, MLS_FIELD_MAP.zip),
    type: findMappedField(headers, MLS_FIELD_MAP.type),
    mls: findMappedField(headers, MLS_FIELD_MAP.mls),
    rent: findMappedField(headers, MLS_FIELD_MAP.rent),
  };

  return {
    price: parseNumber(row[mapped.price]),
    address: row[mapped.address] || "",
    city: row[mapped.city] || "",
    state: row[mapped.state] || "",
    zip: row[mapped.zip] || "",
    type: row[mapped.type] || "",
    mls: row[mapped.mls] || "",
    rentManual: row[mapped.rent] ? parseNumber(row[mapped.rent]) : null,
  };
}

function normalizePropertyType(type) {
  const text = String(type || "").toLowerCase();
  if (text.includes("four") || text.includes("quad") || text.includes("4plex")) return { units: 4, propertyType: "Fourplex" };
  if (text.includes("triplex") || text.includes("3plex")) return { units: 3, propertyType: "Triplex" };
  if (text.includes("duplex") || text.includes("2plex")) return { units: 2, propertyType: "Duplex" };
  return { units: 1, propertyType: "Single / Condo" };
}

function calculateDealScore({ monthlyCashFlow, capRate, cashOnCash, dscr, noiAnnual, expenseRatio }) {
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

function DecisionBadge({ label, tone }) {
  const styles = {
    green: "border border-green-500/40 bg-green-500/10 text-green-400",
    yellow: "border border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
    red: "border border-red-500/40 bg-red-500/10 text-red-400",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tone] || styles.red}`}>{label}</span>;
}

function MetricBox({ value, status, compact = false }) {
  const styles = {
    good: "border border-green-500/30 bg-green-500/10 text-green-400",
    avg: "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    bad: "border border-red-500/30 bg-red-500/10 text-red-400",
  };
  const labels = { good: "Good", avg: "Average", bad: "Poor" };
  return <div className={`rounded-xl text-center font-semibold ${styles[status] || styles.bad} ${compact ? "px-2 py-2 text-xs" : "px-3 py-2 text-xs"}`}><div>{value}</div><div className="text-[10px] opacity-80">{labels[status] || "Poor"}</div></div>;
}

function metricStatus(value, type) {
  if (type === "cap") return value >= 7 ? "good" : value >= 5 ? "avg" : "bad";
  if (type === "coc") return value >= 8 ? "good" : value >= 4 ? "avg" : "bad";
  if (type === "dscr") return value >= 1.2 ? "good" : value >= 1 ? "avg" : "bad";
  if (type === "expense") return value < 35 ? "good" : value <= 45 ? "avg" : "bad";
  return "bad";
}

function AssumptionsPanel({ assumptions, setAssumptions }) {
  const update = (key, value) => setAssumptions({ ...assumptions, [key]: value });
  return (
    <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="mb-4 text-lg font-semibold">Global Assumptions</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AssumptionInput label="Down Payment %" value={assumptions.downPaymentPct} onChange={(v) => update("downPaymentPct", v)} />
        <label className="block">
          <div className="mb-2 flex items-start text-xs uppercase tracking-wide text-slate-400"><span>Estimated Financing APR %</span><span className="relative -top-0.5 ml-1 text-[11px] font-bold leading-none text-slate-200">1</span></div>
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            value={assumptions.interestRate === 0 ? "" : assumptions.interestRate}
            placeholder="6.75"
            onChange={(e) => {
              const nextValue = e.target.value;
              update("interestRate", nextValue === "" ? 0 : Number(nextValue));
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-white placeholder:text-slate-500"
          />
        </label>
        <AssumptionInput label="Property Tax %" value={assumptions.taxRatePct} onChange={(v) => update("taxRatePct", v)} />
        <AssumptionInput label="Insurance" value={assumptions.monthlyInsurance} onChange={(v) => update("monthlyInsurance", v)} />
        <AssumptionInput label="Closing Costs %" value={assumptions.closingCostsPct} onChange={(v) => update("closingCostsPct", v)} />
        <AssumptionInput label="Rehab Budget" value={assumptions.rehabBudget} onChange={(v) => update("rehabBudget", v)} />
        <AssumptionInput label="HOA Monthly" value={assumptions.hoaMonthly} onChange={(v) => update("hoaMonthly", v)} />
        <AssumptionInput label="Maintenance Cost %" value={assumptions.maintenancePct} onChange={(v) => update("maintenancePct", v)} />
        <AssumptionInput label="Vacancy Per Year %" value={assumptions.vacancyPct} onChange={(v) => update("vacancyPct", v)} />
        <AssumptionInput label="Management Fee %" value={assumptions.managementPct} onChange={(v) => update("managementPct", v)} />
        <AssumptionInput label="Single Family Rent" value={assumptions.singleRent} onChange={(v) => update("singleRent", v)} />
        <AssumptionInput label="Duplex Rent (Per Unit)" value={assumptions.duplexRent} onChange={(v) => update("duplexRent", v)} />
        <AssumptionInput label="Triplex Rent (Per Unit)" value={assumptions.triplexRent} onChange={(v) => update("triplexRent", v)} />
        <AssumptionInput label="Quad Rent (Per Unit)" value={assumptions.quadRent} onChange={(v) => update("quadRent", v)} />
      </div>
    </div>
  );
}

function AssumptionInput({ label, value, onChange }) {
  const placeholderMap = {
    "Down Payment %": "20",
    "Property Tax %": "1.2",
    "Insurance": "250",
    "Closing Costs %": "3",
    "Rehab Budget": "15000",
    "HOA Monthly": "0",
    "Maintenance Cost %": "8",
    "Vacancy Per Year %": "5",
    "Management Fee %": "0",
    "Single Family Rent": "2200",
    "Duplex Rent (Per Unit)": "2000",
    "Triplex Rent (Per Unit)": "1800",
    "Quad Rent (Per Unit)": "1700",
  };

  return (
    <label>
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <input
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        value={value === 0 ? "" : value}
        placeholder={placeholderMap[label] || ""}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange(nextValue === "" ? 0 : Number(nextValue));
        }}
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 placeholder:text-slate-500"
      />
    </label>
  );
}

function MathLogicNote({ onDeveloperUnlock }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm">
        <div className="font-semibold text-white">Math Logic Used</div>
        <div className="mt-2 text-slate-300">Gross Rent → Operating Expenses + HOA → NOI → Debt Service → Monthly Cash Flow → Cap Rate / CoC / DSCR</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <GlossaryCard title="NOI" good="Positive NOI = Good" bad="Negative NOI = Poor" formula="NOI = Gross Rent − Operating Expenses" />
          <GlossaryCard title="MONTHLY CASH FLOW" good="Positive = Good" bad="Negative = Poor" formula="Monthly Cash Flow = NOI − Monthly Debt Service" />
          <GlossaryCard title="CAP RATE" good="> 7.0% Good" average="5.0–6.9% Average" bad="< 5.0% Poor" formula="Cap Rate = NOI / Property Price" />
          <GlossaryCard title="COC" good="> 8.0% Good" average="4.0–7.9% Average" bad="< 4.0% Poor" formula="CoC = Annual Cash Flow / Cash Invested" />
          <GlossaryCard title="DSCR" good="> 1.20x Good" average="1.00–1.19 Average" bad="< 1.00 Poor" formula="DSCR = NOI / Annual Debt Service" />
          <GlossaryCard title="EXPENSE RATIO" good="< 35% Good" average="35%–45% Average" bad="> 45% Poor" formula="Expense Ratio = Operating Expenses / Gross Rent" />
        </div>
        <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-slate-300"><div className="mb-2 font-semibold text-blue-200">Professional Deal Scoring Model (0–100)</div><div>NOI: 15% • Monthly Cash Flow: 25% • Cap Rate: 20% • CoC: 20% • DSCR: 15% • Expense Ratio: 5%</div><div className="mt-3 text-[11px] text-slate-400">Scoring penalties may reduce scores for negative cash flow, low DSCR, high expense ratios, or negative NOI.</div></div>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5 text-sm text-slate-300">
        <div className="mb-4 text-base font-semibold text-white">Disclaimer & Footnotes</div>
        <div className="space-y-4 leading-7">
          <p>This tool is intended for preliminary investment screening, educational analysis, and informational purposes only.</p>
          <p>Professional Agent Access is intended for individual professional use. Future additional seat and brokerage access options may become available separately.</p>
          <p>All calculations, deal scoring models, rent assumptions, cap rates, DSCR values, cash-on-cash returns, NOI calculations, expense ratios, and cash flow projections are estimates based on user inputs and assumptions that may differ from actual market conditions.</p>
          <p>This application does not constitute financial, legal, tax, lending, brokerage, appraisal, accounting, or investment advice. Users should independently verify rents, expenses, financing assumptions, insurance costs, taxes, repair budgets, vacancy assumptions, HOA fees, and investment suitability with qualified professionals before making financial or real estate decisions.</p>
          <p>The creators and publishers assume no liability for errors, omissions, market fluctuations, financing outcomes, underwriting inaccuracies, or investment results arising from the use of this application.</p>
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs leading-6 text-slate-400">
            <div className="mb-2 font-semibold text-slate-200">Footnotes</div>
            <p><strong>1.</strong> <strong>Estimated Financing APR %</strong> represents an estimated annual borrowing cost that may include lender fees, financing costs, points, and other loan-related charges beyond the base interest rate.</p>
            <p><strong>2.</strong> <strong>NOI (Net Operating Income)</strong> represents income remaining after operating expenses but before mortgage payments.</p>
            <p><strong>3.</strong> <strong>Monthly Cash Flow</strong> represents the estimated money remaining each month after operating expenses and mortgage payments.</p>
            <p><strong>4.</strong> <strong>Cap Rate</strong> measures property yield by dividing annual NOI by purchase price.</p>
            <p><strong>5.</strong> <strong>COC (Cash-on-Cash Return)</strong> measures annual cash flow relative to total invested <button type="button" onClick={onDeveloperUnlock} className="cursor-text text-slate-400 underline-offset-2 hover:text-slate-300 focus:outline-none">cash</button>.</p>
            <p><strong>6.</strong> <strong>DSCR (Debt Service Coverage Ratio)</strong> measures whether the property income can safely cover mortgage payments.</p>
            <p><strong>7.</strong> <strong>Expense Ratio</strong> measures how much rental income is consumed by operating expenses before mortgage payments.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlossaryCard({ title, good, average, bad, formula }) {
  return <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-xs"><div className="mb-3 text-sm font-semibold text-white">{title}</div><div className="space-y-1 leading-5">{good && <div className="text-green-400">{good}</div>}{average && <div className="text-yellow-400">{average}</div>}{bad && <div className="text-red-400">{bad}</div>}</div><div className="mt-4 text-[11px] leading-5 text-slate-400">{formula}</div></div>;
}

function exportAgentCSV(rows) {
  if (!rows || !rows.length) return;
  const headers = ["Property_Address", "City", "State", "Property_Type", "Price", "Score_0_to_100", "Rating", "Annual_NOI", "Monthly_Cash_Flow", "Cap_Rate", "Cash_on_Cash_Return", "Debt_Coverage_Ratio", "Expense_Ratio", "Monthly_Rent"];
  const body = rows.map((row) => [row.address, row.city, row.state, row.propertyType, Math.round(row.price), row.score.toFixed(1), row.rating, Math.round(row.noiMonthly * 12), Math.round(row.monthlyCashFlow), row.capRate.toFixed(2), row.cashOnCash.toFixed(2), row.dscr.toFixed(2), row.expenseRatio.toFixed(2), Math.round(row.monthlyRent)]);
  const csv = [headers, ...body].map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rental_deal_analyzer_v2_results.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function logCalculateEvent(rows) {
  const payload = {
    rowCount: rows.length,
    cities: Array.from(new Set(rows.map((row) => row.city).filter(Boolean))),
    zipCodes: Array.from(new Set(rows.map((row) => row.zip || row.zipCode).filter(Boolean))),
    createdAt: new Date().toISOString(),
  };
  console.log("Calculate analytics event", payload);
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function stripOuterQuotes(value) {
  return String(value || "").replace(/^"|"$/g, "");
}

function parseNumber(value) {
  const cleaned = String(value || "").replace(/,/g, "").replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}

function formatCurrency(value) {
  const rounded = Math.round(Number(value) || 0);
  const absolute = Math.abs(rounded).toLocaleString();
  return rounded < 0 ? `-$${absolute}` : `$${absolute}`;
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function UpgradeModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-blue-500/30 bg-slate-950 p-8 shadow-2xl">
        <div className="mb-4 text-center"><div className="mb-2 text-2xl font-bold text-white">Free Trials Completed</div><div className="text-sm leading-7 text-slate-300">Unlock bulk rental analysis, CSV exports, advanced deal scoring, and up to 100-property batch processing.</div></div>
        <div className="mb-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center"><div className="text-sm text-blue-200">Professional Agent Access</div><div className="mt-2 text-4xl font-bold text-white">$49<span className="text-lg font-medium text-slate-300">/month</span></div><div className="mt-3 text-xs leading-6 text-slate-400">Cancel anytime. Access remains active through the current billing period.</div></div>
        <button onClick={onClose} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">Close</button>
      </div>
    </div>
  );
}

function LegalModal({ type, onClose }) {
  const content = {
    contact: { title: "Contact", body: "Rental Deal Screener is operated by Caribmare LLC. For business inquiries or general questions, contact support@RentalDealScreener.pro." },
    support: { title: "Support", body: "Need help, found a bug, or have account questions? Email support@RentalDealScreener.pro and include screenshots or property details when possible." },
  };

  const selected = content[type];
  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{selected.title}</h2><button onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:bg-slate-800">Close</button></div>
        <div className="text-sm leading-7 text-slate-300">{selected.body}</div>
      </div>
    </div>
  );
}

function runSmokeTests() {
  console.assert(normalizePropertyType("duplex").units === 2, "duplex should be 2 units");
  console.assert(normalizePropertyType("quadplex").units === 4, "quadplex should be 4 units");
  console.assert(calculateDealScore({ monthlyCashFlow: 600, capRate: 7, cashOnCash: 8, dscr: 1.25, noiAnnual: 30000, expenseRatio: 34 }) > 50, "strong deal should score above 50");
  console.assert(metricStatus(30, "expense") === "good", "low expense ratio should be good");
  console.assert(metricStatus(50, "expense") === "bad", "high expense ratio should be bad");
  console.assert(typeof exportAgentCSV === "function", "CSV export should exist");
  console.assert(typeof logCalculateEvent === "function", "analytics logging hook should exist");
  console.assert(AGENT_FREE_TRIALS === 3, "free trial count should remain 3");
  console.assert(AGENT_BATCH_LIMIT === 100, "batch limit should remain 100");
  console.assert(TRIAL_KEY === "agent_trial_count", "trial key should remain stable");
  console.assert(normalizeHeader("List Price") === "listprice", "header normalization should work");
  console.assert(findMappedField(["List Price"], MLS_FIELD_MAP.price) === "List Price", "price mapping should work");
  console.assert(mapMlsRow({ "List Price": 500000, "Street Address": "123 Main St" }).price === 500000, "MLS row mapping should work");
  console.assert(splitCsvLine('"123 Main St, Unit A",Miami,FL').length === 3, "CSV parser should support quoted commas");
  console.assert(analyzeRows([{ price: 300000, type: "duplex", address: "A" }], DEFAULT_ASSUMPTIONS).length === 1, "analysis should return one row");
  console.assert(sortRows([{ score: 1 }, { score: 2 }], "score")[0].score === 2, "score sort should work");
  console.assert(typeof PAID_ACCESS_VALUE === "number", "paid access sentinel should be numeric");
}

runSmokeTests();
