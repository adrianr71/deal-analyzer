import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

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
  listingId: [
    "listingid", "listing id", "mls", "mls #", "mls number", "mlsnum", "mls_num", "mls id",
    "ml#", "listing number", "listingnum", "listing_num", "list no", "l_num", "lnum",
    "matrix id", "matrix unique id", "listingkey", "system id", "mls # link", "mls link",
    "listing link", "property link",
  ],
  status: ["standardstatus", "status", "st", "listing status", "mls status", "link st"],
  address: ["unparsedaddress", "address", "street address", "property address", "full address", "addr", "street", "str"],
  city: ["city", "city name", "locality", "town", "twn", "municipality", "muni"],
  state: ["state", "stateorprovince", "province"],
  zip: ["postalcode", "zip", "zip code", "zipcode", "postal code"],
  subdivision: ["subdivisionname", "subdivision", "subdivision/complex", "subdivisio", "sub", "legal sub"],
  listPrice: ["listprice", "list price", "price", "asking price", "current price", "origprice", "original price", "lprice", "lp"],
  closePrice: ["closeprice", "sale price", "sold price", "soldprice", "sprice", "sp", "close price"],
  daysOnMarket: ["cumulativedaysonmarket", "cdom", "cdom (da", "cdom days", "dom", "adom", "days on market"],
  bedrooms: ["bedroomstotal", "beds", "bed", "br", "bedrooms", "#beds"],
  fullBaths: ["bathroomsfull", "full bath", "full baths", "f_bath", "fb", "bathf", "#fbaths"],
  halfBaths: ["bathroomshalf", "half bath", "half baths", "h_bath", "hb", "bathh", "#hbaths"],
  propertySubType: ["propertysubtype", "type of property", "type of pr", "property type", "proptype", "prop type", "propclass", "subtype", "property subtype", "style", "type"],
  yearBuilt: ["yearbuilt", "year built", "yrblt", "built", "year", "yb"],
  livingArea: ["livingarea", "sqft la", "sqft", "sqft living", "sqft_la", "sf_la", "living area"],
  lotSizeSquareFeet: ["lotsizesquarefeet", "lot sqft", "lotsize", "lot size", "lot_sf", "lot acres", "lsf"],
  garageSpaces: ["garagespaces", "garage spaces", "#garage s", "gar", "garage", "pkg spaces", "garspc"],
  poolPrivateYN: ["poolprivateyn", "pool yn", "pool", "pool private", "has pool", "pl"],
  waterfrontYN: ["waterfront property (y/n)", "waterfront", "waterfront yn", "waterfront y/n"],
  rent: ["rent", "monthly rent", "gross rent", "estimated rent", "market rent", "rent estimate", "estimated monthly rent"],
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
  const [importSummary, setImportSummary] = useState(null);

  const isPaid = remainingTrials === PAID_ACCESS_VALUE;
  const sortedAnalyzedRows = useMemo(() => sortRows(analyzedRows, sortBy), [analyzedRows, sortBy]);
  const samplePreviewRows = useMemo(() => analyzeRows(SAMPLE_ROWS, assumptions), [assumptions]);

  function handleAssumptionsChange(nextAssumptions) {
    setAssumptions(nextAssumptions);
    if (batchAnalyzed && rows.length > 0) setAnalyzedRows(analyzeRows(rows, nextAssumptions));
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
    if (batchAnalyzed) setAnalyzedRows(analyzeRows(updatedRows, assumptions));
  }

  function startNewSession() {
    setRows([]);
    setAnalyzedRows([]);
    setBatchAnalyzed(false);