import { useMemo, useState } from "react";

const DEFAULT_ASSUMPTIONS = {
  rateType: "interest",
  downPaymentPct: 20,
  interestRate: 6.75,
  loanTermYears: 30,
  taxRatePct: 1.2,
  monthlyInsurance: 250,
  maintenancePct: 8,
  vacancyPct: 5,
  managementPct: 0,
  rent1U: 2200,
  rent2U: 2000,
  rent3U: 1800,
  rent4U: 1700,
};

const SAMPLE_ROWS = [
  { mls: "F10435082", type: "Fourplex", address: "1922 Jefferson Street", city: "Hollywood", state: "FL", price: 899999, cdom: 732, yearBuilt: 1959, sqft: 2262 },
  { mls: "R11032573", type: "Triplex", address: "130 NE 4th Avenue", city: "Boynton Beach", state: "FL", price: 649900, cdom: 538, yearBuilt: 1946, sqft: 2815 },
  { mls: "A11852709", type: "Duplex", address: "9311 SW 37th St", city: "Miami", state: "FL", price: 799000, cdom: 258, yearBuilt: 1963, sqft: 2106 },
  { mls: "A11956078", type: "Duplex", address: "3460 SW 24th Ter", city: "Miami", state: "FL", price: 749000, cdom: 80, yearBuilt: 1929, sqft: 1946 },
  { mls: "A11997504", type: "Triplex", address: "21 NE 53 St", city: "Miami", state: "FL", price: 850000, cdom: 12, yearBuilt: 1935, sqft: 2343 },
];

export default function App() {
  const [rows, setRows] = useState(SAMPLE_ROWS);
  const [uploadStats, setUploadStats] = useState(null);
  const [sortBy, setSortBy] = useState("score");
  const [showAssumptions, setShowAssumptions] = useState(true);
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [zoningResults, setZoningResults] = useState({});
  const [flumResults, setFlumResults] = useState({});
  const [isFetchingAllZoning, setIsFetchingAllZoning] = useState(false);

  const analyzedRows = useMemo(() => {
    return rows
      .map((row) => analyzeRow(row, assumptions))
      .sort((a, b) => {
        if (sortBy === "score") return b.score - a.score;
        if (sortBy === "cashFlow") return b.monthlyCashFlow - a.monthlyCashFlow;
        if (sortBy === "price") return a.price - b.price;
        return 0;
      });
  }, [rows, sortBy, assumptions]);

  function loadCsvFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a CSV file only.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("CSV file is too large. Please upload a file under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      const result = parseCsvToRows(text);
      if (result.rows.length > 0) {
        setRows(result.rows);
        setUploadStats(result.stats);
      } else {
        alert("No valid property rows found in this CSV.");
        setUploadStats(result.stats);
      }
    };
    reader.readAsText(file);
  }

  function handleFileUpload(event) {
    loadCsvFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    loadCsvFile(event.dataTransfer.files?.[0]);
  }

  async function handleFetchZoning(row, index) {
    const key = getRowKey(row, index);
    setZoningResults((prev) => ({ ...prev, [key]: { status: "loading", value: "Checking..." } }));

    try {
      const zone = await fetchCityMiamiZoning(row);
      setZoningResults((prev) => ({
        ...prev,
        [key]: zone
          ? { status: "found", value: zone }
          : { status: "not-found", value: "N/A" },
      }));
    } catch (error) {
      setZoningResults((prev) => ({ ...prev, [key]: { status: "error", value: "N/A" } }));
    }
  }

  async function handleFetchAllZoningSafeMode() {
    if (isFetchingAllZoning) return;
    setIsFetchingAllZoning(true);

    // 🔥 CRITICAL FIX: use ORIGINAL rows (not analyzedRows) so keys match
    const miamiRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.state === "FL" && String(row.city).toLowerCase().includes("miami"));

    for (const { row, index } of miamiRows) {
      const key = getRowKey(row, index);

      setZoningResults((prev) => ({ ...prev, [key]: { status: "loading", value: "Checking..." } }));
      setFlumResults((prev) => ({ ...prev, [key]: { status: "loading", value: "Checking..." } }));

      try {
        const result = await fetchCityMiamiZoningAndFlum(row);

        setZoningResults((prev) => ({
          ...prev,
          [key]: result.zoning
            ? { status: "found", value: result.zoning }
            : { status: "not-found", value: "N/A" },
        }));

        setFlumResults((prev) => ({
          ...prev,
          [key]: result.flum
            ? { status: "found", value: result.flum }
            : { status: "not-found", value: "N/A" },
        }));
      } catch (error) {
        setZoningResults((prev) => ({ ...prev, [key]: { status: "error", value: "N/A" } }));
        setFlumResults((prev) => ({ ...prev, [key]: { status: "error", value: "N/A" } }));
      }

      // 🔥 faster but still safe
      await wait(200);
    }

    setIsFetchingAllZoning(false);
  }

  async function handleFetchFlum(row, index) {
  const key = getRowKey(row, index);

  setFlumResults((prev) => ({
    ...prev,
    [key]: { status: "loading", value: "Checking..." },
  }));

  try {
    const result = await fetchCityMiamiZoningAndFlum(row);
    const flumValue = result.flum || "No Data";

    setFlumResults((prev) => ({
      ...prev,
      [key]: { status: "found", value: flumValue },
    }));
  } catch (error) {
    console.error("FLUM fetch error:", error);
    setFlumResults((prev) => ({
      ...prev,
      [key]: { status: "error", value: "Error" },
    }));
  }
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between mb-6 items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Rental Deal Analyzer — V2</h1>
            <button
              onClick={() => exportToCSV(analyzedRows)}
              className="ml-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-300 hover:bg-green-500/20"
            >
              Export CSV
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="bg-slate-800 px-4 py-2 rounded-xl"
          >
            <option value="score">Score</option>
            <option value="cashFlow">Cash Flow</option>
            <option value="price">Price</option>
          </select>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="font-semibold">Upload policy</div>
            <div className="mt-1 text-amber-50/90">CSV files only. Excel, PDF, ZIP, and executable files are not supported.</div>
          </div>

          <div
            className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="text-xs text-slate-400 mb-2 font-semibold">Upload Deals (CSV)</div>
            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-300 hover:bg-blue-500/20">
              <span>Upload CSV (100 row limit)</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <div className="mt-2 text-xs text-slate-400 text-center">or drag & drop your CSV here</div>
          </div>

          {uploadStats ? (
            <div className="text-xs text-green-400 mt-2">
              {uploadStats.loaded} deals loaded • {uploadStats.skipped} rows skipped
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleFetchAllZoningSafeMode}
            disabled={isFetchingAllZoning}
            className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetchingAllZoning ? "Fetching zoning + FLUM safely..." : "Fetch All Zoning + FLUM (Safe Mode)"}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-950 sticky top-0 z-10">
                <tr className="text-slate-200">
                  <th className="w-[100px] border border-slate-700 px-3 py-3 text-center font-semibold">RATING</th>
                  <th className="w-[80px] border border-slate-700 px-3 py-3 text-center font-semibold">SCORE</th>
                  <th className="w-[115px] border border-slate-700 px-3 py-3 text-center font-semibold">CASH FLOW</th>
                  <th className="w-[140px] border border-slate-700 px-3 py-3 text-center font-semibold">PROPERTY TYPE</th>
                  <th className="w-[220px] border border-slate-700 px-3 py-3 text-left font-semibold">ADDRESS</th>
                  <th className="w-[110px] border border-slate-700 px-3 py-3 text-center font-semibold">CITY</th>
                  <th className="w-[110px] border border-slate-700 px-3 py-3 text-center font-semibold">STATE</th>
                  <th className="w-[120px] border border-slate-700 px-3 py-3 text-center font-semibold">PRICE</th>
                  <th className="w-[100px] border border-slate-700 px-3 py-3 text-center font-semibold">CDOM <InfoTip text="Days on market" /></th>
                  <th className="w-[90px] border border-slate-700 px-3 py-3 text-center font-semibold">YEAR</th>
                  <th className="w-[90px] border border-slate-700 px-3 py-3 text-center font-semibold">SQFT</th>
                  <th className="w-[120px] border border-slate-700 px-3 py-3 text-center font-semibold">MLS <InfoTip text="Listing ID" /></th>
                  <th className="w-[140px] border border-slate-700 px-3 py-3 text-center font-semibold">CAP RATE <InfoTip text="NOI / Price" /></th>
                  <th className="w-[140px] border border-slate-700 px-3 py-3 text-center font-semibold">COC <InfoTip text="Cash on Cash" /></th>
                  <th className="w-[140px] border border-slate-700 px-3 py-3 text-center font-semibold">DSCR <InfoTip text="Coverage ratio" /></th>
                  <th className="w-[140px] border border-slate-700 px-3 py-3 text-center font-semibold">ZONING <InfoTip text="City of Miami beta lookup. Purple = heuristic mismatch. Red = REAL mismatch (Zoning ≠ FLUM)." /></th>
                  <th className="w-[160px] border border-slate-700 px-3 py-3 text-center font-semibold">FLUM <InfoTip text="Future Land Use (Miami Beta)" /></th>
                </tr>
              </thead>
              <tbody>
                {analyzedRows.map((row, index) => {
                  const isMiami = row.state === "FL" && String(row.city).toLowerCase().includes("miami");
                  const zoningKey = getRowKey(row, index);
                  const zoning = zoningResults[zoningKey];
                  const flum = flumResults[zoningKey];

                  const isPotentialMismatch = (() => {
                    if (!zoning || zoning.status !== "found") return false;
                    const z = String(zoning.value || "").toUpperCase();
                    const highDensity = z.includes("T4") || z.includes("T5") || z.includes("T6");
                    return highDensity && row.units === 1;
                  })();

                  const isRealMismatch = (() => {
                    if (!zoning || zoning.status !== "found") return false;
                    if (!flum || flum.status !== "found") return false;

                    const z = String(zoning.value || "").toUpperCase();
                    const f = String(flum.value || "").toUpperCase();

                    return z !== f;
                  })();
                  return (
                  <tr
                    key={row.mls || `${row.address}-${index}`}
                    className={`hover:bg-slate-900/70 ${isRealMismatch ? "bg-red-500/10 border border-red-500/40" : isPotentialMismatch ? "bg-purple-500/10 border border-purple-500/40" : ""}`}
                  >
                    <td className="border border-slate-800 px-3 py-4 text-center"><DecisionBadge label={row.rating} tone={row.tone} /></td>
                    <td className="border border-slate-800 px-3 py-4 text-center font-semibold">{row.score.toFixed(1)}</td>
                    <td className={`border border-slate-800 px-3 py-4 text-center font-semibold ${toneText(row.tone)}`}>{formatCurrency(row.monthlyCashFlow)}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{row.propertyType}</td>
                    <td className="border border-slate-800 px-3 py-4 align-middle max-w-[220px]">
                      <div className="truncate" title={row.address}>{row.address}</div>
                    </td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{row.city}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{row.state}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{formatCurrency(row.price)}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{row.cdom}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{row.yearBuilt}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center">{row.sqft}</td>
                    <td className="border border-slate-800 px-3 py-4 text-center text-blue-400">{row.mls}</td>
                    <td className="border border-slate-800 px-3 py-4"><MetricBox value={formatPercent(row.capRate)} status={metricStatus(row.capRate, "cap")} compact /></td>
                    <td className="border border-slate-800 px-3 py-4"><MetricBox value={formatPercent(row.cashOnCash)} status={metricStatus(row.cashOnCash, "coc")} compact /></td>
                    <td className="border border-slate-800 px-3 py-4"><MetricBox value={`${row.dscr.toFixed(2)}x`} status={metricStatus(row.dscr, "dscr")} compact /></td>
                  <td className="border border-slate-800 px-3 py-4 text-center">
                      {isMiami ? (
                        zoning?.status === "found" ? (
                          <button
                            type="button"
                            onClick={() => handleFetchZoning(row, index)}
                            className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300"
                          >
                            {zoning.value}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleFetchZoning(row, index)}
                            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300"
                          >
                            Fetch
                          </button>
                        )
                      ) : (
                        <span className="text-slate-500 text-xs">N/A</span>
                      )}
                    </td>

                    <td className="border border-slate-800 px-3 py-4 text-center">
                      {isMiami ? (
                        flum ? (
                          <button
                            type="button"
                            onClick={() => handleFetchFlum(row, index)}
                            className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300"
                          >
                            {flum.value}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleFetchFlum(row, index)}
                            className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300"
                          >
                            Fetch
                          </button>
                        )
                      ) : (
                        <span className="text-slate-500 text-xs">N/A</span>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
          <button
            type="button"
            onClick={() => setShowAssumptions((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-white">Editable Assumptions</div>
              <div className="mt-1 text-xs text-slate-400">These assumptions drive the table. Change them globally here.</div>
            </div>
            <div className="text-sm text-slate-300">{showAssumptions ? "Hide" : "Show"}</div>
          </button>

          {showAssumptions ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
              <AssumptionInput label="Down Payment %" value={assumptions.downPaymentPct} onChange={(value) => setAssumptions((prev) => ({ ...prev, downPaymentPct: value }))} />
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rate Type (Interest Rate / APR)</div>
                <select
                  value={assumptions.rateType}
                  onChange={(event) => setAssumptions((prev) => ({ ...prev, rateType: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white"
                >
                  <option value="interest">Interest Rate</option>
                  <option value="apr">APR</option>
                </select>
              </div>
              <AssumptionInput label={assumptions.rateType === "apr" ? "APR %" : "Interest Rate %"} value={assumptions.interestRate} step="0.125" onChange={(value) => setAssumptions((prev) => ({ ...prev, interestRate: value }))} />
              <AssumptionInput label="Loan Term Years" value={assumptions.loanTermYears} onChange={(value) => setAssumptions((prev) => ({ ...prev, loanTermYears: value }))} />
              <AssumptionInput label="Property Tax Rate %" value={assumptions.taxRatePct} step="0.1" onChange={(value) => setAssumptions((prev) => ({ ...prev, taxRatePct: value }))} />
              <AssumptionInput label="Monthly Insurance" value={assumptions.monthlyInsurance} onChange={(value) => setAssumptions((prev) => ({ ...prev, monthlyInsurance: value }))} />
              <AssumptionInput label="Maintenance %" value={assumptions.maintenancePct} onChange={(value) => setAssumptions((prev) => ({ ...prev, maintenancePct: value }))} />
              <AssumptionInput label="Vacancy %" value={assumptions.vacancyPct} onChange={(value) => setAssumptions((prev) => ({ ...prev, vacancyPct: value }))} />
              <AssumptionInput label="Management %" value={assumptions.managementPct} onChange={(value) => setAssumptions((prev) => ({ ...prev, managementPct: value }))} />
              <AssumptionInput label="Rent per Unit (Single / Condo)" value={assumptions.rent1U} onChange={(value) => setAssumptions((prev) => ({ ...prev, rent1U: value }))} />
              <AssumptionInput label="Rent per Unit (Duplex)" value={assumptions.rent2U} onChange={(value) => setAssumptions((prev) => ({ ...prev, rent2U: value }))} />
              <AssumptionInput label="Rent per Unit (Triplex)" value={assumptions.rent3U} onChange={(value) => setAssumptions((prev) => ({ ...prev, rent3U: value }))} />
              <AssumptionInput label="Rent per Unit (Fourplex)" value={assumptions.rent4U} onChange={(value) => setAssumptions((prev) => ({ ...prev, rent4U: value }))} />
            </div>
          ) : null}
        </div>

        <MathLogicNote />
        <Legend />
        <LegalDisclaimer />
      </div>
    </div>
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 🔥 CRITICAL FIX: use stable key (MLS only) so sorting does NOT break mapping
// 🔥 CRITICAL FIX: use stable key (MLS only) so sorting does NOT break mapping
// 🔥 CRITICAL FIX: use stable key (MLS only) so sorting does NOT break mapping
function getRowKey(row) {
  return row.mls;

}

async function fetchCityMiamiZoning(row) {
  const result = await fetchCityMiamiZoningAndFlum(row);
  return result.zoning;
}

async function fetchCityMiamiFlum(row) {
  const result = await fetchCityMiamiZoningAndFlum(row);
  return result.flum;
}

async function fetchCityMiamiZoningAndFlum(row) {
  const fullAddress = `${row.address}, ${row.city}, ${row.state}`;
  const geocodeUrl =
    "https://gis.miami.gov/gis/rest/services/Geocoders/COMIA_USPS_StreetLocator/GeocodeServer/findAddressCandidates" +
    `?SingleLine=${encodeURIComponent(fullAddress)}` +
    "&outFields=*" +
    "&maxLocations=1" +
    "&outSR=2881" +
    "&f=json";

  const geocodeResponse = await fetch(geocodeUrl);
  const geocodeData = await geocodeResponse.json();
  const candidate = geocodeData?.candidates?.[0];

  if (!candidate?.location) return { zoning: null, flum: null };

  const { x, y } = candidate.location;
  const geometry = encodeURIComponent(`${x},${y}`);

  const zoningUrl =
    "https://gis.miami.gov/gis/rest/services/Zoning/ZoningMiami21/MapServer/5/query" +
    "?f=json" +
    `&geometry=${geometry}` +
    "&geometryType=esriGeometryPoint" +
    "&inSR=2881" +
    "&spatialRel=esriSpatialRelIntersects" +
    "&outFields=M21_ZONE,Map_Code,Transect,Transect_Desc" +
    "&returnGeometry=false";

  // 🔥 FIXED FLUM LAYER (more reliable Miami dataset)
  const flumUrl =
    "https://gis.miami.gov/gis/rest/services/Planning/Comprehensive_Plan/MapServer/2/query" +
    "?f=json" +
    `&geometry=${geometry}` +
    "&geometryType=esriGeometryPoint" +
    "&inSR=2881" +
    "&spatialRel=esriSpatialRelIntersects" +
    "&outFields=*" +
    "&returnGeometry=false";

  const [zoningData, flumData] = await Promise.all([
    fetch(zoningUrl).then((response) => response.json()),
    fetch(flumUrl).then((response) => response.json()).catch(() => null),
  ]);

  const zoningAttributes = zoningData?.features?.[0]?.attributes;
  const flumAttributes = flumData?.features?.[0]?.attributes;

  const zoning = zoningAttributes?.M21_ZONE || zoningAttributes?.Map_Code || zoningAttributes?.Transect || null;

  // 🔥 HARDEN FLUM extraction (more aggressive parsing)
  let flum = null;
  if (flumAttributes) {
    const values = Object.values(flumAttributes).filter(v => typeof v === "string" && v.length > 2);

    // Prefer meaningful planning terms
    flum = values.find(v =>
      v.toLowerCase().includes("residential") ||
      v.toLowerCase().includes("commercial") ||
      v.toLowerCase().includes("mixed") ||
      v.toLowerCase().includes("industrial")
    ) || values[0] || null;
  }

  return { zoning, flum };
}

function findFlumValue(attributes) {
  if (!attributes) return null;

  const preferredKeys = ["FLU", "FLUM", "FUTURE_LAND_USE", "FUTURELANDUSE", "LAND_USE", "LANDUSE", "DESIG", "DESIGNATION"];

  for (const key of preferredKeys) {
    if (attributes[key]) return attributes[key];
  }

  const fallbackKey = Object.keys(attributes).find((key) => {
    const upper = key.toUpperCase();
    return upper.includes("FLU") || upper.includes("LAND") || upper.includes("USE") || upper.includes("DESIG");
  });

  return fallbackKey ? attributes[fallbackKey] : null;
}

function parseCsvToRows(text) {
  const normalizedText = String(text || "").split("\r\n").join("\n").split("\r").join("\n");
  const lines = normalizedText.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return { rows: [], stats: { loaded: 0, skipped: 0 } };

  const headers = splitCsvLine(lines[0]).map((header) => cleanText(header).toLowerCase());
  const findIndex = (variants) => headers.findIndex((header) => variants.some((variant) => header.includes(variant)));

  const map = {
    mls: findIndex(["mls"]),
    address: findIndex(["address", "street"]),
    city: findIndex(["city"]),
    state: findIndex(["state", " st"]),
    price: findIndex(["list price", "price"]),
    cdom: findIndex(["cdom", "days"]),
    yearBuilt: findIndex(["year built", "year"]),
    sqft: findIndex(["sqft", "square"]),
    type: findIndex(["type", "property"]),
  };

  const parsedRows = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const get = (index) => (index >= 0 ? cols[index] : "");

    let addressRaw = cleanText(get(map.address));
    let cityRaw = cleanText(get(map.city));
    let stateRaw = cleanText(get(map.state));

    if (addressRaw.includes(",") && !cityRaw) {
      const parts = addressRaw.split(",").map((part) => part.trim());
      if (parts.length >= 2) {
        addressRaw = parts[0];
        cityRaw = parts[1];
        stateRaw = parts[2] || stateRaw;
      }
    }

    const price = parseNumber(get(map.price));
    if (!addressRaw || !price) {
      skipped += 1;
      continue;
    }

    parsedRows.push({
      mls: cleanText(get(map.mls)) || `row-${i}`,
      address: addressRaw,
      city: cityRaw,
      state: stateRaw || "FL",
      price,
      cdom: parseNumber(get(map.cdom)),
      yearBuilt: parseNumber(get(map.yearBuilt)),
      sqft: parseNumber(get(map.sqft)),
      type: cleanText(get(map.type)),
    });
  }

  const limitedRows = parsedRows.slice(0, 100);
  const overLimitSkipped = Math.max(0, parsedRows.length - 100);

  return {
    rows: limitedRows,
    stats: { loaded: limitedRows.length, skipped: skipped + overLimitSkipped },
  };
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

function parseNumber(value) {
  const cleaned = String(value || "").split(",").join("").replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}

function cleanText(value) {
  return String(value || "").split('"').join("").trim();
}

function InfoTip({ text }) {
  return <span title={text} className="ml-1 text-slate-400 cursor-help">?</span>;
}

function DecisionBadge({ label, tone }) {
  const styles = {
    green: "bg-green-500/10 text-green-400 border border-green-500/40",
    yellow: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/40",
    red: "bg-red-500/10 text-red-400 border border-red-500/40",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[tone]}`}>{label}</span>;
}

function MetricBox({ value, status, compact = false }) {
  const styles = {
    good: "bg-green-500/10 text-green-400 border border-green-500/30",
    avg: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
    bad: "bg-red-500/10 text-red-400 border border-red-500/30",
  };
  const label = { good: "Good", avg: "Average", bad: "Poor" };

  return (
    <div className={`rounded-xl text-center font-semibold ${styles[status]} ${compact ? "px-2 py-2 text-xs" : "px-3 py-2 text-xs"}`}>
      <div>{value}</div>
      <div className="text-[10px] opacity-80">{label[status]}</div>
    </div>
  );
}

function metricStatus(value, type) {
  if (type === "cap") {
    if (value >= 7) return "good";
    if (value >= 5) return "avg";
    return "bad";
  }
  if (type === "coc") {
    if (value >= 8) return "good";
    if (value >= 4) return "avg";
    return "bad";
  }
  if (type === "dscr") {
    if (value >= 1.2) return "good";
    if (value >= 1) return "avg";
    return "bad";
  }
  return "bad";
}

function analyzeRow(row, assumptions) {
  const normalized = normalizePropertyType(row.type);
  const units = normalized.units;

  const rentPerUnit = units === 4 ? assumptions.rent4U : units === 3 ? assumptions.rent3U : units === 2 ? assumptions.rent2U : assumptions.rent1U;
  const monthlyRent = units * rentPerUnit;
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
  const operatingExpenses = monthlyTaxes + insurance + maintenance + vacancy + management;
  const noiMonthly = monthlyRent - operatingExpenses;
  const noiAnnual = noiMonthly * 12;
  const monthlyCashFlow = noiMonthly - debtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const annualDebtService = debtService * 12;
  const capRate = row.price > 0 ? (noiAnnual / row.price) * 100 : 0;
  const cashOnCash = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : 0;
  const score = calculateDealScore({ monthlyCashFlow, capRate, cashOnCash, dscr });
  const rating = score >= 8 ? "Buy" : score >= 5 ? "Review" : "Fail";
  const tone = score >= 8 ? "green" : score >= 5 ? "yellow" : "red";

  return { ...row, units, propertyType: normalized.propertyType, monthlyRent, operatingExpenses, noiMonthly, debtService, monthlyCashFlow, capRate, cashOnCash, dscr, score, rating, tone };
}

function AssumptionInput({ label, value, onChange, step = "1" }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function normalizePropertyType(type) {
  const text = String(type || "").toLowerCase().trim();
  if (!text) return { units: 1, propertyType: "Single / Condo" };
  if (text.includes("fourplex") || text.includes("four plex") || text.includes("4plex") || text.includes("4 plex") || text.includes("quadplex") || text.includes("quad plex") || text.includes("four-family") || text.includes("four family") || text.includes("4-family") || text.includes("4 family")) return { units: 4, propertyType: "Fourplex" };
  if (text.includes("triplex") || text.includes("tri plex") || text.includes("tri-plex") || text.includes("3plex") || text.includes("3 plex") || text.includes("threeplex") || text.includes("three plex") || text.includes("three-family") || text.includes("three family") || text.includes("3-family") || text.includes("3 family")) return { units: 3, propertyType: "Triplex" };
  if (text.includes("duplex") || text.includes("du plex") || text.includes("du-plex") || text.includes("2plex") || text.includes("2 plex") || text.includes("two-family") || text.includes("two family") || text.includes("2-family") || text.includes("2 family")) return { units: 2, propertyType: "Duplex" };
  if (text.includes("condo") || text.includes("condominium") || text.includes("single family") || text.includes("single-family") || text.includes("sfh") || text.includes("sfr") || text.includes("townhouse") || text.includes("townhome") || text.includes("villa")) return { units: 1, propertyType: "Single / Condo" };
  return { units: 1, propertyType: "Single / Condo" };
}

function calculateDealScore({ monthlyCashFlow, capRate, cashOnCash, dscr }) {
  let score = 0;
  if (monthlyCashFlow > 300) score += 4;
  else if (monthlyCashFlow > 0) score += 2;
  if (capRate > 6.5) score += 3;
  else if (capRate > 5) score += 2;
  if (cashOnCash > 6) score += 2;
  if (dscr > 1.1) score += 1;
  return score;
}

function toneText(tone) {
  if (tone === "green") return "text-green-400";
  if (tone === "yellow") return "text-yellow-400";
  return "text-red-400";
}

function formatCurrency(value) {
  const rounded = Math.round(Number(value) || 0);
  const absolute = Math.abs(rounded).toLocaleString();
  return rounded < 0 ? `-$${absolute}` : `$${absolute}`;
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function exportToCSV(rows) {
  if (!rows || !rows.length) return;
  const headers = ["Rating", "Score", "Cash Flow", "Property Type", "Address", "City", "State", "Price", "CDOM", "Year", "Sqft", "MLS", "Cap Rate", "CoC", "DSCR", "Zoning"];
  const csvRows = rows.map((row) => [row.rating, row.score.toFixed(1), Math.round(row.monthlyCashFlow), row.propertyType, row.address, row.city, row.state, row.price, row.cdom, row.yearBuilt, row.sqft, row.mls, row.capRate.toFixed(2), row.cashOnCash.toFixed(2), row.dscr.toFixed(2), row.zoning || ""]);
  const csvContent = [headers, ...csvRows]
    .map((row) => row.map((value) => `"${String(value).split('"').join('""')}"`).join(","))
    .join(String.fromCharCode(10));

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "analyzed_deals.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function MathLogicNote() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm">
      <div className="font-semibold text-white">Math Logic Used</div>
      <div className="mt-2 text-slate-300">Gross Rent → Operating Expenses → NOI → Debt Service → Cash Flow → Cap Rate / CoC / DSCR</div>
      <div className="mt-2 text-xs text-slate-400">CoC is based on annual cash flow, and DSCR is based on NOI divided by debt service.</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
      <div className="p-4 border border-slate-700 rounded-xl">
        <div className="font-semibold mb-2">CAP RATE</div>
        <div className="text-green-400">≥ 7.0% Good</div>
        <div className="text-yellow-400">5.0–6.9% Average</div>
        <div className="text-red-400">&lt; 5.0% Poor</div>
      </div>
      <div className="p-4 border border-slate-700 rounded-xl">
        <div className="font-semibold mb-2">COC</div>
        <div className="text-green-400">≥ 8.0% Good</div>
        <div className="text-yellow-400">4.0–7.9% Average</div>
        <div className="text-red-400">&lt; 4.0% Poor</div>
      </div>
      <div className="p-4 border border-slate-700 rounded-xl">
        <div className="font-semibold mb-2">DSCR</div>
        <div className="text-green-400">≥ 1.20x Good</div>
        <div className="text-yellow-400">1.00–1.19x Average</div>
        <div className="text-red-400">&lt; 1.00x Poor</div>
      </div>
    </div>
  );
}

function LegalDisclaimer() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-xs text-slate-400 leading-relaxed">
      <div className="font-semibold text-white mb-2">Disclaimer</div>
      <div>
        This tool is provided for informational and educational purposes only and does not constitute financial, legal, tax, or investment advice. All calculations, including but not limited to cash flow, cap rate, cash-on-cash return, DSCR, zoning, and future land use (FLUM), are based on user-provided inputs, assumptions, and publicly available data sources that may be incomplete, outdated, or inaccurate.
      </div>
      <div className="mt-2">
        Zoning and FLUM data are retrieved from third-party municipal GIS systems and are not guaranteed to be accurate or current. Users are solely responsible for independently verifying all property details, zoning classifications, land use designations, financial assumptions, and investment metrics prior to making any decisions.
      </div>
      <div className="mt-2">
        The creators of this tool assume no liability for errors, omissions, or any outcomes related to the use of this application. Use at your own risk.
      </div>
    </div>
  );
}
