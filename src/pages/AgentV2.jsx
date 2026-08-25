import { useMemo, useRef, useState, useEffect } from "react";
import Papa from "papaparse";
import { supabase } from "../supabaseClient";

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
const AGENT_FREE_BATCH_LIMIT = 20;
const AGENT_FREE_TRIALS = 3;
const SESSION_KEY = "agent_analyzer_session";
const TRIAL_KEY = "agent_trial_count";
const BRANDING_KEY = "agent_report_branding";
const PII_HEADER_TERMS = [
  "owner", "owner name", "seller", "seller name", "buyer", "buyer name",
  "client", "client name", "tenant", "tenant name", "email", "e-mail",
  "phone", "telephone", "mobile", "cell", "ssn", "social security",
  "tax id", "account number", "private remarks"
];

const MLS_FIELD_MAP = {
  listingId: [
  "listingid",
  "listing id",
  "mls",
  "mls #",
  "mls number",
  "mlsnum",
  "mls_num",
  "mls id",
  "ml#",
  "listing number",
  "listingnum",
  "listing_num",
  "list no",
  "l_num",
  "lnum",
  "matrix id",
  "matrix unique id",
  "listingkey",
  "system id",
  "mls # link",
  "mls link",
  "listing link",
  "property link"
],
  status: ["standardstatus", "status", "st", "listing status", "mls status", "link st"],
  address: ["unparsedaddress", "address", "street address", "property address", "full address", "addr", "street", "str"],
  city: ["city", "city name", "locality", "town", "twn", "municipality", "muni"],
  state: ["state", "stateorprovince", "province"],
  zip: ["postalcode", "zip", "zip code", "zipcode", "postal code"],
  subdivision: ["subdivisionname", "subdivision", "subdivisio", "sub", "legal sub"],
  listPrice: ["listprice", "list price", "price", "asking price", "current price", "origprice", "original price", "lprice", "lp"],
  closePrice: ["closeprice", "sale price", "sold price", "soldprice", "sprice", "sp", "close price"],
  daysOnMarket: ["cumulativedaysonmarket", "cdom", "dom", "adom", "days on market"],
  bedrooms: ["bedroomstotal", "beds", "bed", "br", "bedrooms", "#beds"],
  fullBaths: ["bathroomsfull", "full bath", "full baths", "f_bath", "fb", "bathf", "#fbaths"],
  halfBaths: ["bathroomshalf", "half bath", "half baths", "h_bath", "hb", "bathh", "#hbaths"],
  propertySubType: ["propertysubtype", "type of property", "property type", "proptype", "prop type", "propclass", "subtype", "property subtype", "style", "type"],
  yearBuilt: ["yearbuilt", "year built", "yrblt", "built", "year", "yb"],
  livingArea: ["livingarea", "sqft la", "sqft", "sqft living", "sqft_la", "sf_la", "living area"],
  lotSizeSquareFeet: ["lotsizesquarefeet", "lot sqft", "lotsize", "lot size", "lot_sf", "lot acres", "lsf"],
  garageSpaces: ["garagespaces", "garage spaces", "#garage s", "gar", "garage", "pkg spaces", "garspc"],
  poolPrivateYN: ["poolprivateyn", "pool yn", "pool", "pool private", "has pool", "pl"],
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
  const [reportBranding, setReportBranding] = useState(() => loadReportBranding());
  const [taxOverrides, setTaxOverrides] = useState({});
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("individual");
  const [maxUsers, setMaxUsers] = useState(1);
  const [maxDevicesPerUser, setMaxDevicesPerUser] = useState(2);
  const [accessRole, setAccessRole] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [accountMode, setAccountMode] = useState(null);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  
  const [teamData, setTeamData] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [showAccessPanel, setShowAccessPanel] = useState(true);
  const [showTeamPanel, setShowTeamPanel] = useState(true);

  const [removeLoadingId, setRemoveLoadingId] = useState(null);

useEffect(() => {
  async function loadAuthSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Supabase auth session lookup failed:", error);
    }

    setAuthUser(data.session?.user || null);
    setAuthChecked(true);
  }

  loadAuthSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setAuthUser(session?.user || null);
    setAuthChecked(true);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

function getOrCreateDeviceId() {
  const key = "rds_device_id";

  let deviceId = localStorage.getItem(key);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }

  return deviceId;
}

async function registerCurrentDevice(accessToken) {
  const deviceId = getOrCreateDeviceId();

  const deviceName = [
    navigator.platform || "",
    navigator.userAgent || "",
  ]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 120);

  const response = await fetch("/api/register-device", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      deviceId,
      deviceName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.allowed) {
    throw new Error(
      data.error || "This device is not allowed."
    );
  }

  return data;
}

async function handleSignUp() {
  const email = authEmail.trim();

  if (!email || !authPassword) {
    alert("Please enter your email and password.");
    return;
  }

  if (authPassword.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  const {
    data: signUpData,
    error,
  } = await supabase.auth.signUp({
    email,
    password: authPassword,
  });

  if (error) {
    alert(error.message);
    return;
  }

  const session = signUpData?.session;

  if (!session) {
    alert(
      "Account created. Please check your email to confirm your account, then sign in."
    );
    return;
  }

setAuthPassword("");
setShowAccountSetup(false);
setAccountMode(null);

  if (selectedPlan) {
    await startStripeCheckout(selectedPlan);
  }
}

async function handleSignIn() {
  const email = authEmail.trim();

  if (!email || !authPassword) {
    alert("Please enter your email and password.");
    return;
  }

  const {
    data: signInData,
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password: authPassword,
  });

  if (error) {
    alert(error.message);
    return;
  }

setAuthPassword("");
setShowAccountSetup(false);
setAccountMode(null);

  const session = signInData?.session;

 if (!selectedPlan && session?.access_token) {
  try {
    const activationResponse = await fetch(
      "/api/activate-team-membership",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const activationData = await activationResponse.json();

    if (
      !activationResponse.ok &&
      activationResponse.status !== 404
    ) {
      console.error(
        "Team membership activation failed:",
        activationData
      );

      alert(
        activationData.error ||
          "Unable to activate team membership."
      );

      return;
    }

    const entitlementResponse = await fetch(
      "/api/get-subscription-status",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const entitlementData =
      await entitlementResponse.json();

if (!entitlementResponse.ok) {
  console.error(
    "Subscription entitlement lookup failed:",
    entitlementData
  );

  alert(
    entitlementData.error ||
      "Unable to verify your account access. Please try again."
  );

  return;
}

if (!entitlementData.subscribed) {
  localStorage.removeItem("subscribed");

  setIsSubscribed(false);
  setSubscriptionPlan("individual");
  setMaxUsers(1);
  setMaxDevicesPerUser(2);
  setAccessRole(null);

  return;
}

try {
  await registerCurrentDevice(session.access_token);
} catch (deviceError) {
  console.error(
    "Device registration failed:",
    deviceError
  );

  await supabase.auth.signOut({
  scope: "local",
});

  setAuthUser(null);
  setIsSubscribed(false);
  setAccessRole(null);

  alert(
    deviceError.message ||
      "This account has reached the 2-device limit."
  );

  return;
}

  } catch (activationError) {
    console.error(
      "Account access verification failed:",
      activationError
    );

    await supabase.auth.signOut({
  scope: "local",
});

    setAuthUser(null);
    setIsSubscribed(false);
    setAccessRole(null);

    alert(
      "Unable to verify your account access. Please try again."
    );

    return;
  }
}
  if (selectedPlan) {
    await startStripeCheckout(selectedPlan);
  }
}

async function handleSignOut() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const deviceId = localStorage.getItem("rds_device_id");

    if (session?.access_token && deviceId) {
      const releaseResponse = await fetch(
        "/api/release-device",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            deviceId,
          }),
        }
      );

      const releaseData = await releaseResponse.json();

if (!releaseResponse.ok) {
  console.warn(
    "Device release failed, continuing sign out:",
    releaseData
  );
}
    }

    const { error } = await supabase.auth.signOut({
  scope: "local",
});

    if (error) {
      console.error("Supabase sign out failed:", error);
      alert("Unable to sign out. Please try again.");
      return;
    }

    localStorage.removeItem("subscribed");
    localStorage.removeItem("stripe_customer_id");
    localStorage.removeItem("stripe_subscription_id");

    setAuthUser(null);
    setIsSubscribed(false);
    setSubscriptionPlan("individual");
    setMaxUsers(1);
    setMaxDevicesPerUser(2);
    setAccessRole(null);
    setSelectedPlan(null);
    setShowAccountSetup(false);

    window.location.reload();
  } catch (error) {
    console.error("Sign out failed:", error);
    alert("Unable to sign out. Please try again.");
  }
}

 useEffect(() => {
  async function verifyStripeSuccess() {
    const params = new URLSearchParams(window.location.search);
    const checkoutSuccess = params.get("checkout") === "success" || params.get("success") === "true";
    const sessionId = params.get("session_id");

    if (!checkoutSuccess || !sessionId) return;

    try {
      const response = await fetch(`/api/verify-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
      const data = await response.json();

      if (response.ok && data.subscribed) {
localStorage.setItem("subscribed", "true");

if (data.customerId) {
  localStorage.setItem("stripe_customer_id", data.customerId);
}

if (data.subscriptionId) {
  localStorage.setItem("stripe_subscription_id", data.subscriptionId);
}

setIsSubscribed(true);

try {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    const entitlementResponse = await fetch(
      "/api/get-subscription-status",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const entitlementData = await entitlementResponse.json();

    if (entitlementResponse.ok && entitlementData.subscribed) {
      setSubscriptionPlan(
        entitlementData.plan || "individual"
      );

      setMaxUsers(
        Number(entitlementData.maxUsers) || 1
      );

      setMaxDevicesPerUser(
        Number(entitlementData.maxDevicesPerUser) || 2
      );
setAccessRole(entitlementData.accessRole || "owner");
    }
  }
} catch (entitlementError) {
  console.error(
    "Subscription entitlement lookup failed:",
    entitlementError
  );
}

window.history.replaceState({}, "", "/agents");
      } else {
        alert("Stripe checkout could not be verified. Please contact support.");
      }
    } catch (error) {
      console.error("Checkout verification error:", error);
      alert("Stripe checkout could not be verified. Please contact support.");
    }
  }

  verifyStripeSuccess();
}, []);

useEffect(() => {
  setSubscriptionChecked(false);
 async function checkSavedSubscription() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user || !session?.access_token) {
      localStorage.removeItem("subscribed");

      setIsSubscribed(false);
      setSubscriptionPlan("individual");
      setMaxUsers(1);
      setMaxDevicesPerUser(2);
      setAccessRole(null);

      return;
    }

    const response = await fetch(
      "/api/get-subscription-status",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const data = await response.json();

    if (response.ok && data.subscribed) {
      localStorage.setItem("subscribed", "true");

      setIsSubscribed(true);

      setSubscriptionPlan(data.plan || "individual");
      setMaxUsers(Number(data.maxUsers) || 1);
      setMaxDevicesPerUser(
        Number(data.maxDevicesPerUser) || 2
      );
      setAccessRole(data.accessRole || "owner");
    } else {
      localStorage.removeItem("subscribed");

      setIsSubscribed(false);
      setSubscriptionPlan("individual");
      setMaxUsers(1);
      setMaxDevicesPerUser(2);
      setAccessRole(null);
    }
  } catch (error) {
    console.error(
      "Saved subscription check failed:",
      error
    );

    localStorage.removeItem("subscribed");

    setIsSubscribed(false);
    setSubscriptionPlan("individual");
    setMaxUsers(1);
    setMaxDevicesPerUser(2);
    setAccessRole(null);
  } finally {
    setSubscriptionChecked(true);
  }
}

  checkSavedSubscription();
}, [authUser?.id]);

async function loadTeamMembers() {
  const isTeamOwner =
    isSubscribed &&
    accessRole === "owner" &&
    (subscriptionPlan === "team_5" ||
      subscriptionPlan === "team_10");

  if (!authUser || !isTeamOwner) {
    setTeamData(null);
    setTeamError("");
    return;
  }

  setTeamLoading(true);
  setTeamError("");

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setTeamData(null);
      setTeamError("Please sign in again to manage your team.");
      return;
    }

    const response = await fetch("/api/get-team-members", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to load team members."
      );
    }

    setTeamData(data);
  } catch (error) {
    console.error("Team member lookup failed:", error);
    setTeamData(null);
    setTeamError(
      error.message || "Unable to load team members."
    );
  } finally {
    setTeamLoading(false);
  }
}

async function handleInviteTeamMember() {
  const email = inviteEmail.trim().toLowerCase();

  if (!email) {
    alert("Please enter an email address.");
    return;
  }

  setInviteLoading(true);
  setTeamError("");

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Please sign in again to invite a team member.");
      return;
    }

    const response = await fetch("/api/invite-team-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to invite team member."
      );
    }

    setInviteEmail("");

    await loadTeamMembers();

    alert(`Invitation added for ${email}.`);
  } catch (error) {
    console.error("Team invitation failed:", error);

    alert(
      error.message || "Unable to invite team member."
    );
  } finally {
    setInviteLoading(false);
  }
}

async function handleRemoveTeamMember(member) {
  if (!member?.id) return;

  const confirmed = window.confirm(
    `Remove ${member.email} from this team?`
  );

  if (!confirmed) return;

  setRemoveLoadingId(member.id);
  setTeamError("");

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Please sign in again to remove a team member.");
      return;
    }

    const response = await fetch("/api/remove-team-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        memberId: member.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to remove team member."
      );
    }

    await loadTeamMembers();

    alert(`${member.email} was removed from the team.`);
  } catch (error) {
    console.error("Team member removal failed:", error);

    alert(
      error.message || "Unable to remove team member."
    );
  } finally {
    setRemoveLoadingId(null);
  }
}

useEffect(() => {
  loadTeamMembers();
}, [
  authUser?.id,
  isSubscribed,
  accessRole,
  subscriptionPlan,
]);

  const isPaid = isSubscribed;
  const activeBatchLimit = isPaid ? AGENT_BATCH_LIMIT : AGENT_FREE_BATCH_LIMIT;   
  const sortedAnalyzedRows = useMemo(() => sortRows(analyzedRows, sortBy), [analyzedRows, sortBy]);
  const samplePreviewRows = SAMPLE_ROWS.map((row) => ({
   ...row,
   propertyType: row.type,
   monthlyRent: row.rentManual || 0,
   score: 0,
   rating: "Sample",
   tone: "yellow",
   monthlyCashFlow: 0,
   capRate: 0,
   cashOnCash: 0,
   dscr: 0,
   expenseRatio: 0,
   noiMonthly: 0,
}));

function handleAssumptionsChange(nextAssumptions) {
  setAssumptions(nextAssumptions);

  if (batchAnalyzed && rows.length > 0) {
    setAnalyzedRows([]);
    setBatchAnalyzed(false);
  }
}

function handleReportBrandingChange(nextBranding) {
  setReportBranding(nextBranding);
  localStorage.setItem(BRANDING_KEY, JSON.stringify(nextBranding));
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
     setAnalyzedRows([]);
     setBatchAnalyzed(false);
}
  }

  function startNewSession() {
    setRows([]);
    setAnalyzedRows([]);
    setBatchAnalyzed(false);
    setIsProcessing(false);
    setImportSummary(null);
    sessionStorage.removeItem(SESSION_KEY);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!isPaid && remainingTrials <= 0) setShowUpgradeModal(true);
  }


async function startStripeCheckout(plan = "individual") {
  const {
    data: { session },
  } = await supabase.auth.getSession();

if (!session?.user || !session?.access_token) {
  setSelectedPlan(plan);
  setAccountMode("signup");
  setShowAccountSetup(true);
  return;
}

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        plan,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      alert(data.error || "Unable to start checkout. Please try again.");
      return;
    }

    window.location.href = data.url;
  } catch (error) {
    console.error("Checkout error:", error);
    alert("Unable to start checkout. Please try again.");
  }
}

  async function openCustomerPortal() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Please sign in again to manage your subscription.");
      return;
    }

    const response = await fetch(
      "/api/create-portal-session",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.url) {
      alert(
        data.error ||
          "Unable to open subscription management. Please try again."
      );
      return;
    }

    window.location.href = data.url;
  } catch (error) {
    console.error(
      "Customer portal error:",
      error
    );

    alert(
      "Unable to open subscription management. Please try again."
    );
  }
}

async function changeSubscriptionPlan(plan) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Please sign in again to change your plan.");
      return;
    }

    const response = await fetch("/api/change-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        plan,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.error ||
          "Unable to change your subscription plan."
      );
      return;
    }

if (data.scheduled) {
  const effectiveDate = data.effectiveAt
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "numeric",
        day: "numeric",
        year: "numeric",
      }).format(new Date(data.effectiveAt))
    : "your next renewal date";

  alert(
    `Your downgrade to ${
      plan === "team_5"
        ? "Team 5"
        : "Individual"
    } is scheduled for ${effectiveDate}.\n\n` +
      "Your current plan and access will remain active until then."
  );

  window.location.reload();
  return;
}

alert(
  `Your subscription was upgraded to ${
    plan === "team_10"
      ? "Team 10"
      : plan === "team_5"
      ? "Team 5"
      : "Individual"
  }.`
);

window.location.reload();   

  } catch (error) {
    console.error(
      "Subscription plan change failed:",
      error
    );

    alert(
      "Unable to change your subscription plan. Please try again."
    );
  }
}

async function runFreeTrialBatch() {
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

  try {
const {
  data: { session },
} = await supabase.auth.getSession();

const headers = {
  "Content-Type": "application/json",
};

if (session?.access_token) {
  headers.Authorization =
    `Bearer ${session.access_token}`;
}

const response = await fetch("/api/analyze-batch", {
  method: "POST",
  headers,
  body: JSON.stringify({
    rows,
    assumptions,
    taxOverrides,
  }),
});

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Unable to analyze batch.");
      return;
    }

    setAnalyzedRows(data.analyzed);
    setBatchAnalyzed(true);
    logCalculateEvent(rows);

    if (!data.isSubscribed) {
      const updatedTrials = Math.max(0, remainingTrials - 1);
      setRemainingTrials(updatedTrials);
      localStorage.setItem(TRIAL_KEY, String(updatedTrials));
    }
  } catch (error) {
    console.error("Analyze batch request failed:", error);
    alert("Unable to analyze batch.");
  } finally {
    setIsProcessing(false);
  }
}

  function handleExportCSV() {
    exportAgentCSV(sortedAnalyzedRows);
    logCalculateEvent(rows);
  }

function handlePrintSummary() {
  logCalculateEvent(rows);
  printResultsReport(sortedAnalyzedRows, assumptions, reportBranding);
}

  function handleImportCSV(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a CSV file.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => String(header).replace(/^\uFEFF/, "").trim().toLowerCase(),
      complete: (results) => {
        const allRows = results.data.map((row, index) => mapMlsRow(row, index + 2));
        const validRows = allRows.filter((row) => row.importStatus === "Analyzed");
        const limitedRows = validRows.slice(0, activeBatchLimit);
        const invalidCount = allRows.length - validRows.length;
        const headers = Object.keys(results.data?.[0] || {});
        const piiHeaders = detectPiiHeaders(headers);

        console.log("CSV headers detected:", headers);
        console.log("CSV import summary:", { totalRows: allRows.length, validRows: validRows.length, invalidRows: invalidCount });

        if (limitedRows.length === 0) {
          setImportSummary({ valid: 0, invalid: invalidCount, total: allRows.length, piiWarning: piiHeaders.length > 0 });
          alert("No valid property rows were found. Please check that your CSV includes List Price, Address/MLS #, City, and Type of Property.");
          return;
        }

        setRows(limitedRows);
        setAnalyzedRows([]);
        setBatchAnalyzed(false);
        setIsProcessing(false);
        setImportSummary({ valid: limitedRows.length, invalid: invalidCount, total: allRows.length, piiWarning: piiHeaders.length > 0 });
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(limitedRows));

        const skippedForLimit = Math.max(0, validRows.length - limitedRows.length);
        const limitLabel = isPaid ? "Paid batches" : "Free trial batches";
        const limitMessage = skippedForLimit > 0
        ? ` ${limitLabel} support up to ${activeBatchLimit} properties, so ${skippedForLimit} additional valid properties were not imported.`
        : "";
	const replacementMessage = rows.length > 0
	  ? " This import replaced the previous batch."
	  : "";

	const piiMessage = piiHeaders.length > 0
	  ? " Potential personal information detected in uploaded file. Only property listing data should be analyzed."
	  : "";

	alert(`${limitedRows.length} properties imported successfully.${limitMessage}${replacementMessage}${piiMessage} ${invalidCount > 0 ? `${invalidCount} rows need attention. ` : ""}Next: Fill out Global Assumptions, then press 	Analyze Batch.`);

            },
      error: (error) => {
        console.error("CSV parsing error:", error);
        alert("There was a problem reading the CSV file.");
      },
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-5">
<header>
  <div className="flex items-start justify-between gap-6">
    <div>
      <h1 className="text-3xl font-bold">
        Rental Deal Screener Pro
      </h1>

      <p className="mt-1 text-lg font-medium text-cyan-300">
        For Real Estate Agents
      </p>
    </div>

    <div className="shrink-0">
      {authUser ? (
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Sign Out
        </button>
      ) : (
        <button
         onClick={() => {
         setSelectedPlan(null);
         setAccountMode("signin");
         setShowAccountSetup(true);
      }}
          className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          Sign In
        </button>
      )}
    </div>
  </div>

  <p className="mt-3 text-sm text-slate-400">
    Bulk analyze rental properties in seconds using NOI,
    Cap Rate, Cash Flow, DSCR, CoC Return, and lender-focused
    investment metrics commonly used by investors,
    mortgage professionals, and DSCR loan providers.
  </p>          

<div className="mt-5 overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-r from-blue-950/80 via-slate-900 to-cyan-950/70 p-6 shadow-2xl shadow-blue-950/30">
              <div className={`flex flex-col gap-6 ${isPaid ? "items-center text-center" : ""}`}>
                <div className="w-full">
                  {!isPaid ? (
  <>
<div className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
  Real Estate Professional Plans
</div>

<div className="mt-4">
  <div className="text-3xl font-black tracking-tight text-white md:text-4xl">
    Choose the plan that fits how you work.
  </div>

  <div className="mt-2 text-sm text-slate-400 md:text-base">
    Individual and team options for real estate professionals.
  </div>
</div>
  </>
) : (
<>
<div className="relative flex w-full items-center justify-center">
  <div className="inline-flex items-center rounded-full border border-green-400/30 bg-green-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-green-300">
    {accessRole === "member"
      ? "Team Access Active"
      : "Professional Access Active"}
  </div>

  <button
    type="button"
    onClick={() => setShowAccessPanel((prev) => !prev)}
    className="absolute right-0 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
  >
    {showAccessPanel ? "Hide Access ▲" : "Show Access ▼"}
  </button>
</div>
  {showAccessPanel && (
    <div className="flex flex-col items-center text-center">
      <div className="mt-4 text-xl font-semibold text-green-300">
        Unlimited Batch Analysis
      </div>

      <div className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {accessRole === "member"
          ? "Your access is provided through your team's active subscription."
          : "Renews monthly. Cancel anytime. Access remains active through the end of the billing period."}
      </div>

      {accessRole !== "member" && (
<div className="mt-4 flex flex-wrap justify-center gap-3">
  <button
    type="button"
    onClick={openCustomerPortal}
    className="rounded-xl border border-green-400/40 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-200 transition hover:bg-green-500/20"
  >
    Manage Subscription
  </button>

  {subscriptionPlan === "team_5" && (
    <button
      type="button"
      onClick={() => {
  const confirmed = window.confirm(
    "Upgrade to Team 10?\n\n" +
      "Your upgrade will take effect immediately.\n\n" +
      "You will be charged a prorated amount for the remainder of your current billing period. " +
      "Your regular Team 10 price of $349/month will begin on your next renewal date."
  );

  if (!confirmed) return;

  changeSubscriptionPlan("team_10");
}}
      className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
    >
      Upgrade to Team 10
    </button>
  )}

{subscriptionPlan === "team_5" && (
  <button
    type="button"
    onClick={() => {
      const confirmed = window.confirm(
        "Downgrade to Individual?\n\n" +
          "The Individual plan supports 1 named user and up to 2 personal devices.\n\n" +
          "Your Team 5 access will remain active until the end of your current billing period. " +
          "Individual pricing of $49/month will begin on your next renewal date.\n\n" +
          "All additional active or invited team members must be removed before this downgrade can be scheduled."
      );

      if (!confirmed) return;

      changeSubscriptionPlan("individual");
    }}
    className="rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-500/20"
  >
    Downgrade to Individual
  </button>
)}

{subscriptionPlan === "team_10" && (
  <button
    type="button"
    onClick={() => {
      const confirmed = window.confirm(
        "Downgrade to Team 5?\n\n" +
          "Team 5 supports up to 5 users.\n\n" +
          "Your Team 10 access will remain active until the end of your current billing period. " +
          "Team 5 pricing will begin on your next renewal date.\n\n" +
          "If you currently have more than 5 active or invited team members, the downgrade will be blocked until you remove enough members."
      );

      if (!confirmed) return;

      changeSubscriptionPlan("team_5");
    }}
    className="rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-500/20"
  >
    Downgrade to Team 5
  </button>
)}

{subscriptionPlan === "team_10" && (
  <button
    type="button"
    onClick={() => {
      const confirmed = window.confirm(
        "Downgrade to Individual?\n\n" +
          "The Individual plan supports 1 named user and up to 2 personal devices.\n\n" +
          "Your Team 10 access will remain active until the end of your current billing period. " +
          "Individual pricing of $49/month will begin on your next renewal date.\n\n" +
          "All additional active or invited team members must be removed before this downgrade can be scheduled."
      );

      if (!confirmed) return;

      changeSubscriptionPlan("individual");
    }}
    className="rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-500/20"
  >
    Downgrade to Individual
  </button>
)}

</div>
      )}
    </div>
  )}
</>
)}
{!isPaid && (
  <>
    <div className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
      Analyze up to 100 rental properties at once using the same
      professional investment metrics reviewed by real estate investors,
      DSCR lenders, mortgage professionals, and acquisition teams.
    </div>

    <div className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
      Import MLS exports, score deals automatically, calculate NOI,
      Cash Flow, Cap Rate, CoC, DSCR, and export professional reports
      in minutes.
    </div>
  </>
)}

{!isPaid && (
  <div className="w-full">

{showAccountSetup && (
  <div className="mb-5 rounded-2xl border border-cyan-400/30 bg-slate-950/60 p-5">
<div className="text-lg font-semibold text-white">
  {accountMode === "signin"
    ? "Sign In"
    : selectedPlan === "team_5"
    ? "Create your Team 5 account"
    : selectedPlan === "team_10"
    ? "Create your Team 10 account"
    : "Create your Individual account"}
</div>

<div className="mt-2 text-sm leading-6 text-slate-400">
  {accountMode === "signin"
    ? "Enter your existing email and password. Team members should use the exact email address that received the invitation."
    : "Enter your email and create a password with at least 6 characters. After your account is created, you’ll continue securely to Stripe to complete your subscription."}
</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <input
        type="email"
        value={authEmail}
        onChange={(event) => setAuthEmail(event.target.value)}
        placeholder="Email address"
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
      />

      <input
        type="password"
        value={authPassword}
        onChange={(event) => setAuthPassword(event.target.value)}
        placeholder="Password — minimum 6 characters"
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
      />
    </div>

<div className="mt-4 flex flex-wrap gap-3">
  {accountMode === "signup" && selectedPlan && (
    <button
      type="button"
      onClick={handleSignUp}
      className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
    >
      Create Account & Continue
    </button>
  )}

  {accountMode === "signin" && (
    <button
      type="button"
      onClick={handleSignIn}
      className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
    >
      Sign In & Continue
    </button>
  )}

  <button
    type="button"
onClick={() => {
  setShowAccountSetup(false);
  setSelectedPlan(null);
  setAccountMode(null);
}}
    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 transition hover:text-white"
  >
    Cancel
  </button>
</div>
  </div>
)}
{!showAccountSetup && (
  <>
    <div className="mt-6 grid gap-5 md:grid-cols-3">

      {/* Individual */}
      <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Individual
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="text-4xl font-black text-white">$49</div>
          <div className="pb-1 text-sm text-slate-300">/month</div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <div>1 named user</div>
          <div>Up to 2 personal devices</div>
          <div>Analyze up to 100 properties per batch</div>
          <div>Professional reports and exports</div>
        </div>

        <button
          onClick={() => startStripeCheckout("individual")}
          className="mt-5 w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          Choose Individual
        </button>
      </div>

      {/* Team 5 */}
      <div className="relative rounded-2xl border border-amber-400/70 bg-slate-950/50 p-5 shadow-lg shadow-amber-500/10">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black">
          Most Popular for Teams
        </div>

        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          Team 5
        </div>

        <div className="mt-1 text-sm text-slate-400">
          Up to 5 users
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="text-4xl font-black text-white">$199</div>
          <div className="pb-1 text-sm text-slate-300">/month</div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <div>Up to 2 devices per user</div>
          <div>Team administration</div>
          <div>Centralized billing</div>
        </div>

        <button
          onClick={() => startStripeCheckout("team_5")}
          className="mt-5 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
        >
          Choose Team 5
        </button>
      </div>

      {/* Team 10 */}
      <div className="rounded-2xl border border-slate-600 bg-slate-950/40 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          Team 10
        </div>

        <div className="mt-1 text-sm text-slate-400">
          Up to 10 users
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="text-4xl font-black text-white">$349</div>
          <div className="pb-1 text-sm text-slate-300">/month</div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <div>Up to 2 devices per user</div>
          <div>Team administration</div>
          <div>Priority support</div>
        </div>

        <button
          onClick={() => startStripeCheckout("team_10")}
          className="mt-5 w-full rounded-xl border border-slate-500 bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Choose Team 10
        </button>
      </div>

       {/* Free Trial — below the three paid plans */}
    <div className="mt-5 w-full rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 md:col-span-3">
      <div className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Free Trial
        </div>

        <div className="text-2xl font-bold text-white">
          {remainingTrials}
        </div>

        <div className="text-sm font-medium text-slate-300">
          Practice Batches Remaining
        </div>

        <div className="hidden text-slate-600 sm:block">
          •
        </div>

        <div className="text-sm text-slate-400">
          20 Properties Max Per Trial Batch
        </div>
      </div>
    </div>

    </div>
  </>
)}

  </div>
)}

{!isPaid && !showAccountSetup && (
  <>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
      <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
        Monthly Subscription
      </div>

      <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
        Cancel Anytime
      </div>

      <div className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
        Secure Stripe Checkout
      </div>
    </div>

    <div className="mt-4 text-xs leading-6 text-slate-500">
      By subscribing, you agree to our{" "}
      <a href="/terms" className="text-cyan-400 hover:underline">
        Terms of Use
      </a>{" "}
      and{" "}
      <a href="/privacy" className="text-cyan-400 hover:underline">
        Privacy Policy
      </a>.
      <br />
      Subscriptions renew automatically each month until canceled.
      Cancel anytime. Access remains active through the end of your
      billing period.
    </div>
  </>
)}
           </div>
             </div>
            </div>
          </header>
{accessRole === "owner" &&
  (subscriptionPlan === "team_5" ||
    subscriptionPlan === "team_10") && (
    <section className="rounded-2xl border border-amber-400/30 bg-slate-950/70 p-5">
<div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
  <div className="justify-self-start">
    <div className="text-lg font-semibold text-white">
      Team Management
    </div>

    {showTeamPanel && (
      <div className="mt-1 text-sm text-slate-400">
        Manage team seats and invitations for your subscription.
      </div>
    )}
  </div>

  <div className="flex flex-wrap items-center justify-center gap-2">
    {showTeamPanel && teamData && (
      <>
        <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
          {teamData.usedSeats} of {teamData.maxUsers} seats used
        </div>

        <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">
          {teamData.remainingSeats} seats remaining
        </div>
      </>
    )}
  </div>

  <button
    type="button"
    onClick={() => setShowTeamPanel((prev) => !prev)}
    className="justify-self-end rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
  >
    {showTeamPanel ? "Hide Team ▲" : "Show Team ▼"}
  </button>
</div>

      {showTeamPanel && (
        <>
          {teamLoading && (
            <div className="mt-5 text-sm text-slate-400">
              Loading team members...
            </div>
          )}

          {teamError && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {teamError}
            </div>
          )}

          {!teamLoading && !teamError && teamData && (
            <>
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-700">
               <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
               <div>Action</div>
              </div>

                <div className="divide-y divide-slate-800">
                  {teamData.members?.map((member) => (
                    <div
                      key={member.id || member.email}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm"
                    >
                      <div className="break-all text-white">
                        {member.email}
                      </div>

                      <div className="capitalize text-slate-300">
                        {member.role}
                      </div>

                      <div
                        className={
                          member.status === "active"
                            ? "capitalize text-green-300"
                            : "capitalize text-amber-300"
                        }
                      >
                        {member.status}
                      </div>
<div className="text-right">
  {member.role !== "owner" ? (
    <button
      type="button"
      onClick={() => handleRemoveTeamMember(member)}
      disabled={removeLoadingId === member.id}
      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {removeLoadingId === member.id
        ? "Removing..."
        : "Remove"}
    </button>
  ) : (
    <span className="text-xs text-slate-600">—</span>
  )}
</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-sm font-medium text-white">
                  Invite Team Member
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) =>
                      setInviteEmail(event.target.value)
                    }
                    placeholder="team.member@example.com"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
                  />

                  <button
                    type="button"
                    onClick={handleInviteTeamMember}
                    disabled={
                      inviteLoading ||
                      !inviteEmail.trim() ||
                      Number(teamData.remainingSeats) <= 0
                    }
                    className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {inviteLoading ? "Sending..." : "Send Invite"}
                  </button>
                </div>

                {Number(teamData.remainingSeats) <= 0 && (
                  <div className="mt-2 text-xs text-amber-300">
                    All team seats are currently in use.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )}
          <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3"><div className="text-base font-semibold text-white">How It Works</div><button type="button" onClick={() => setShowInstructions((prev) => !prev)} className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white">{showInstructions ? "Hide Instructions ▲" : "Show Instructions ▼"}</button></div>
            {showInstructions && <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><StepCard number="1" title="Import CSV File" description="Upload up to 20 properties per free trial batch. Paid access supports up to 100 properties per batch." /><StepCard number="2" title="Set Global Assumptions" description="Adjust financing, vacancy, maintenance, insurance, taxes, and rent assumptions." /><StepCard number="3" title="Analyze All Properties" description="Analyze all imported properties and calculate NOI, Cash Flow, Cap Rate, CoC, DSCR, and professional deal scores." /><StepCard number="4" title="Export or Print Results" description="Export the full analyzed CSV or print / save a PDF investment summary report for sharing and underwriting review." /></div>}
          </section>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="print:hidden lg:w-auto"><button type="button" onClick={() => fileInputRef.current?.click()} className="h-full w-full rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20">Import CSV File</button></div>
            <button onClick={startNewSession} disabled={!batchAnalyzed} className={`rounded-2xl px-5 py-4 text-sm font-semibold transition ${!batchAnalyzed ? "cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-600" : "border border-red-400/50 bg-red-400/15 text-red-200 hover:bg-red-400/25"}`}>Start New Batch</button>
            <label onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const droppedFile = event.dataTransfer.files?.[0]; if (!droppedFile) return; handleImportCSV({ target: { files: [droppedFile] } }); }} className="flex min-h-[64px] flex-1 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-cyan-500/40 bg-slate-950/50 px-6 py-4 text-center transition hover:border-cyan-400/70 hover:bg-cyan-500/5">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCSV} />
              <div><div className="text-sm font-semibold text-cyan-300">Drag & Drop CSV File Here</div><div className="mt-1 text-xs text-slate-400">100 Properties Max</div></div>
            </label>
          </div>

         {importSummary && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300 print:hidden">{importSummary.valid} properties imported successfully{importSummary.invalid > 0 ? ` - ${importSummary.invalid} rows need attention` : ""}{importSummary.piiWarning ? " - Potential personal information detected" : ""}</div>}
        </div>

        <AssumptionsPanel assumptions={assumptions} setAssumptions={handleAssumptionsChange} />
        {isPaid && <BrandingPanel branding={reportBranding} onChange={handleReportBrandingChange} />}
        <div className="mb-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200 print:hidden"><strong>Next Step:</strong> Fill out Global Assumptions as needed, then press <strong>Analyze All Properties</strong> to process your imported properties.</div>
        <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden"><button onClick={runFreeTrialBatch} disabled={isProcessing || batchAnalyzed} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${isProcessing || batchAnalyzed ? "cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500" : "border border-white/70 bg-white text-slate-950 hover:bg-cyan-100"}`}>{isProcessing ? "Analyzing Batch..." : batchAnalyzed ? "Batch Already Analyzed" : isPaid ? "Analyze All Properties" : `Click Here to Analyze All Properties • ${remainingTrials} Free Batches Remaining`}</button><div className="text-sm font-medium text-slate-300">Sort Results By:</div><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white"><option value="score">Highest Score</option><option value="cashFlow">Highest Cash Flow</option><option value="price">Lowest Price</option></select></div>

        <div className="print-summary">
  {/* <PrintSummary rows={sortedAnalyzedRows} assumptions={assumptions} /> */}
</div>
        <div id="results-print-report">
<ResultsTable
  isProcessing={isProcessing}
  rows={sortedAnalyzedRows}
  sampleRows={samplePreviewRows}
  onUpdateRent={updateRowRent}
  taxOverrides={taxOverrides}
  setTaxOverrides={setTaxOverrides}
/>
</div>
        <div className="mt-6 mb-6 flex flex-wrap items-center gap-3 print:hidden"><button onClick={handleExportCSV} disabled={sortedAnalyzedRows.length === 0} className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40">Download CSV Report</button><button onClick={handlePrintSummary} disabled={sortedAnalyzedRows.length === 0} className="rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-500/20 disabled:cursor-not-allowed disabled:opacity-40">Create Branded PDF Report</button></div>
        <div className="print:hidden"><MathLogicNote /></div>
        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-400"><div className="flex flex-wrap justify-center gap-4"><button onClick={() => setActiveLegalModal("contact")} className="transition hover:text-white">Contact</button><button onClick={() => setActiveLegalModal("support")} className="transition hover:text-white">Support</button><a href="/terms" className="transition hover:text-white">Terms</a><a href="/privacy" className="transition hover:text-white">Privacy</a><a href="/disclaimer" className="transition hover:text-white">Disclaimer</a></div><div className="mt-3">© 2026 RentalDealScreener.pro · Operated by Caribmare LLC</div></footer>
        {activeLegalModal && <LegalModal type={activeLegalModal} onClose={() => setActiveLegalModal(null)} />}
        {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      </div>
    </div>
  );
}

function loadSavedRows() { try { const saved = sessionStorage.getItem(SESSION_KEY); const parsed = saved ? JSON.parse(saved) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function loadRemainingTrials() {
  try {
    const saved = localStorage.getItem(TRIAL_KEY);
    const parsed = saved === null ? AGENT_FREE_TRIALS : Number(saved);

    if (!Number.isFinite(parsed)) return AGENT_FREE_TRIALS;

    const clamped = Math.max(0, Math.min(AGENT_FREE_TRIALS, parsed));

    if (String(parsed) !== String(clamped)) {
      localStorage.setItem(TRIAL_KEY, String(clamped));
    }

    return clamped;
  } catch {
    return AGENT_FREE_TRIALS;
  }
}
function loadReportBranding() { try { const saved = localStorage.getItem(BRANDING_KEY); return saved ? JSON.parse(saved) : { agentName: "", company: "", phone: "", email: "" }; } catch { return { agentName: "", company: "", phone: "", email: "" }; } }

function sortRows(rows, sortBy) { return [...rows].sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "cashFlow" ? b.monthlyCashFlow - a.monthlyCashFlow : sortBy === "price" ? a.price - b.price : 0); }

function ResultsTable({
  isProcessing,
  rows,
  sampleRows = [],
  onUpdateRent,
  taxOverrides,
  setTaxOverrides
}) {
  const showSample = !isProcessing && rows.length === 0;
  const displayRows = rows.length > 0 ? rows : sampleRows;
  return <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/90 shadow-2xl print:hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1250px] border-collapse text-sm"><colgroup><col className="w-[115px]" /><col className="w-[70px]" /><col className="w-[105px]" /><col /><col className="w-[95px]" /><col className="w-[100px]" /><col className="w-[110px]" /><col className="w-[82px]" /><col className="w-[108px]" /><col className="w-[88px]" /><col className="w-[84px]" /><col className="w-[84px]" /><col className="w-[102px]" /></colgroup><thead className="bg-slate-950"><tr className="text-slate-200"><TableHeader>RATING</TableHeader><TableHeader>SCORE</TableHeader><TableHeader>PROPERTY<br />TYPE</TableHeader><TableHeader align="left">ADDRESS</TableHeader><TableHeader>CITY</TableHeader><TableHeader>PRICE</TableHeader><TableHeader>RENT<span className="ml-0.5 align-super text-sm font-bold text-slate-300">2</span></TableHeader>
<TableHeader>MONTHLY PROPERTY TAX<span className="ml-0.5 align-super text-sm font-bold text-slate-300">3</span></TableHeader>
<TableHeader>NOI<span className="ml-0.5 align-super text-sm font-bold text-slate-300">4</span></TableHeader>
<TableHeader>MONTHLY<br />CASH FLOW<span className="ml-0.5 align-super text-sm font-bold text-slate-300">5</span></TableHeader>
<TableHeader>CAP RATE<span className="ml-0.5 align-super text-sm font-bold text-slate-300">6</span></TableHeader>
<TableHeader>COC<span className="ml-0.5 align-super text-sm font-bold text-slate-300">7</span></TableHeader>
<TableHeader>DSCR<span className="ml-0.5 align-super text-sm font-bold text-slate-300">8</span></TableHeader>
<TableHeader>EXPENSE<br />RATIO<span className="ml-0.5 align-super text-sm font-bold text-slate-300">9</span></TableHeader></tr></thead><tbody>{isProcessing ? <tr><td colSpan={14} className="h-32 border border-slate-800 text-center text-sm text-blue-300">Processing professional deal scoring model...</td></tr> : displayRows.map((row, index) => (
  <ResultRow
    key={row.mls || `${row.address}-${index}`}
    row={row}
    index={index}
    taxOverrides={taxOverrides}
    setTaxOverrides={setTaxOverrides}
    isSample={showSample}
    onUpdateRent={onUpdateRent}
  />
 ))}</tbody></table></div></div>;
}

function ResultRow({ row, index, taxOverrides, setTaxOverrides, isSample, onUpdateRent }) {
  const expenseRatio = row.monthlyRent > 0 ? (row.operatingExpenses / row.monthlyRent) * 100 : 0;
  return <tr className="border-b border-slate-800 hover:bg-slate-900/60"><BodyCell><div className="flex flex-col items-center gap-1"><DecisionBadge label={row.rating} tone={row.tone} />{isSample && <span className="text-[10px] uppercase tracking-wide text-slate-500 opacity-70">Sample Preview</span>}</div></BodyCell><BodyCell strong>{row.score.toFixed(1)}</BodyCell><BodyCell>{row.propertyType}</BodyCell><BodyCell align="left" className="break-words">{row.address}</BodyCell><BodyCell className="whitespace-normal break-words leading-5">{row.city}</BodyCell><BodyCell strong>{formatCurrency(row.price)}</BodyCell><BodyCell><input inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" type="number" value={isSample ? "" : row.rentManual ?? ""} placeholder={String(Math.round(row.monthlyRent))} readOnly={isSample} onChange={(event) => onUpdateRent(row, event.target.value)} className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-center text-sm" /></BodyCell><BodyCell>
  <input
    type="number"
    value={
  taxOverrides[index] !== undefined
    ? taxOverrides[index]
    : Math.round(row.monthlyPropertyTax ?? row.monthlyTaxes ?? 0)
}
    onChange={(e) =>
      setTaxOverrides((prev) => ({
        ...prev,
        [index]: Number(e.target.value)
      }))
    }
    className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm"
  />
</BodyCell><BodyCell strong className={row.noiMonthly >= 0 ? "text-green-400" : "text-red-400"}>{formatCurrency(row.noiMonthly * 12)}</BodyCell><BodyCell strong className={row.monthlyCashFlow >= 0 ? "text-green-400" : "text-red-400"}>{formatCurrency(row.monthlyCashFlow)}</BodyCell><BodyCell compact><MetricBox value={formatPercent(row.capRate)} status={metricStatus(row.capRate, "cap")} compact /></BodyCell><BodyCell compact><MetricBox value={formatPercent(row.cashOnCash)} status={metricStatus(row.cashOnCash, "coc")} compact /></BodyCell><BodyCell compact><MetricBox value={`${row.dscr.toFixed(2)}x`} status={metricStatus(row.dscr, "dscr")} compact /></BodyCell><BodyCell compact><MetricBox value={`${expenseRatio.toFixed(0)}%`} status={metricStatus(expenseRatio, "expense")} compact /></BodyCell></tr>;
}

function StepCard({ number, title, description }) { return <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-300">Step {number}</div><div className="font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{description}</div></div>; }
function PrintSummary({ rows, assumptions }) { const topDeal = rows?.[0]; if (!topDeal) return null; return <div className="hidden print:block print:bg-white print:p-8 print:text-black"><div className="mb-6 border-b border-slate-300 pb-4"><div className="text-2xl font-bold">Investment Summary</div><div className="mt-1 text-sm text-slate-600">Rental Deal Screener for Real Estate Agents</div></div><div className="mb-6 grid grid-cols-2 gap-4 text-sm"><div><div className="font-semibold">Property</div><div>{topDeal.address}</div><div>{topDeal.city}, {topDeal.state}</div></div><div><div className="font-semibold">Summary</div><div>Score: {topDeal.score.toFixed(1)} / 100</div><div>Rating: {topDeal.rating}</div><div>Property Type: {topDeal.propertyType}</div></div></div><table className="mb-6 w-full border-collapse text-sm"><tbody><PrintRow label="Price" value={formatCurrency(topDeal.price)} /><PrintRow label="Annual NOI" value={formatCurrency(topDeal.noiMonthly * 12)} /><PrintRow label="Monthly Cash Flow" value={formatCurrency(topDeal.monthlyCashFlow)} /><PrintRow label="Cap Rate" value={formatPercent(topDeal.capRate)} /><PrintRow label="Cash-on-Cash Return" value={formatPercent(topDeal.cashOnCash)} /><PrintRow label="Debt Coverage Ratio" value={`${topDeal.dscr.toFixed(2)}x`} /><PrintRow label="Expense Ratio" value={`${topDeal.expenseRatio.toFixed(1)}%`} /><PrintRow label="Estimated Financing APR" value={`${assumptions.interestRate}%`} /></tbody></table><div className="text-xs leading-5 text-slate-600">This print summary is for preliminary investment screening and educational analysis only. Users should independently verify rent, financing, expenses, taxes, insurance, repairs, vacancies, and investment suitability.</div></div>; }
function PrintRow({ label, value }) { return <tr><td className="border border-slate-300 px-3 py-2 font-semibold">{label}</td><td className="border border-slate-300 px-3 py-2 text-right">{value}</td></tr>; }
function TableHeader({ children, align = "center" }) { return <th className={`border border-slate-700 px-2 py-3 align-middle leading-5 whitespace-normal break-words ${align === "left" ? "text-left" : "text-center"}`}>{children}</th>; }
function BodyCell({ children, align = "center", strong = false, compact = false, className = "" }) { return <td className={`border border-slate-800 ${compact ? "px-1.5" : "px-2"} py-5 align-middle ${align === "left" ? "text-left" : "text-center"} ${strong ? "font-semibold" : ""} ${className}`}>{children}</td>; }

function normalizeHeader(header) { return String(header || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""); }

function detectPiiHeaders(headers) {
  return headers.filter((header) => {
    const normalized = normalizeHeader(header);
    return PII_HEADER_TERMS.some((term) => normalized.includes(normalizeHeader(term)));
  });
}

function findMappedField(headers, aliases) {
  if (!Array.isArray(aliases) || !Array.isArray(headers)) return null;

  const normalizedHeaders = headers
    .filter((header) => typeof header === "string" && header.trim() !== "")
    .map((header) => ({
      original: header,
      normalized: normalizeHeader(header),
    }))
    .filter((item) => item.normalized.length >= 2);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);

    if (!normalizedAlias || normalizedAlias.length < 2) continue;

    const exact = normalizedHeaders.find(
      (item) => item.normalized === normalizedAlias,
    );

    if (exact) return exact.original;

    const partial = normalizedHeaders.find((item) => {
      if (item.normalized.length < 4 || normalizedAlias.length < 4) {
        return false;
      }

      return (
        item.normalized.includes(normalizedAlias) ||
        normalizedAlias.includes(item.normalized)
      );
    });

    if (partial) return partial.original;
  }

  return null;
}

function mapMlsRow(row, rowNumber = null) {
  const headers = Object.keys(row || {});
  const mapped = {
    price: findMappedField(headers, MLS_FIELD_MAP.listPrice), address: findMappedField(headers, MLS_FIELD_MAP.address), city: findMappedField(headers, MLS_FIELD_MAP.city), state: findMappedField(headers, MLS_FIELD_MAP.state), zip: findMappedField(headers, MLS_FIELD_MAP.zip), type: findMappedField(headers, MLS_FIELD_MAP.propertySubType), mls: findMappedField(headers, MLS_FIELD_MAP.listingId), rent: findMappedField(headers, MLS_FIELD_MAP.rent), status: findMappedField(headers, MLS_FIELD_MAP.status), subdivision: findMappedField(headers, MLS_FIELD_MAP.subdivision), daysOnMarket: findMappedField(headers, MLS_FIELD_MAP.daysOnMarket), bedrooms: findMappedField(headers, MLS_FIELD_MAP.bedrooms), fullBaths: findMappedField(headers, MLS_FIELD_MAP.fullBaths), halfBaths: findMappedField(headers, MLS_FIELD_MAP.halfBaths), yearBuilt: findMappedField(headers, MLS_FIELD_MAP.yearBuilt), livingArea: findMappedField(headers, MLS_FIELD_MAP.livingArea), lotSizeSquareFeet: findMappedField(headers, MLS_FIELD_MAP.lotSizeSquareFeet), garageSpaces: findMappedField(headers, MLS_FIELD_MAP.garageSpaces), poolPrivateYN: findMappedField(headers, MLS_FIELD_MAP.poolPrivateYN),
  };
  const parsed = {
    sourceRow: rowNumber, price: parseNumber(row[mapped.price]), address: row[mapped.address] || "", city: row[mapped.city] || "", state: row[mapped.state] || "", zip: row[mapped.zip] || "", type: row[mapped.type] || "", mls: row[mapped.mls] || "", rentManual: row[mapped.rent] ? parseNumber(row[mapped.rent]) : null, status: row[mapped.status] || "", subdivision: row[mapped.subdivision] || "", daysOnMarket: parseNumber(row[mapped.daysOnMarket]), bedrooms: parseNumber(row[mapped.bedrooms]), fullBaths: parseNumber(row[mapped.fullBaths]), halfBaths: parseNumber(row[mapped.halfBaths]), yearBuilt: parseNumber(row[mapped.yearBuilt]), livingArea: parseNumber(row[mapped.livingArea]), lotSizeSquareFeet: parseNumber(row[mapped.lotSizeSquareFeet]), garageSpaces: parseNumber(row[mapped.garageSpaces]), poolPrivateYN: parseBoolean(row[mapped.poolPrivateYN]),
  };
  const notes = [];
if (!parsed.price) notes.push("Missing or invalid price");
if (!parsed.address && !parsed.mls) notes.push("Missing address or MLS #");
if (!parsed.city) notes.push("Missing city");
if (!parsed.type) notes.push("Missing property type - analyzed as Single / Condo");

const blockingNotes = notes.filter((note) =>
  note === "Missing or invalid price" ||
  note === "Missing address or MLS #"
);

parsed.importStatus = blockingNotes.length ? "Needs Review" : "Analyzed";
parsed.importNotes = notes.join("; ") || "Complete";
return parsed;
}

function DecisionBadge({ label, tone }) { const styles = { green: "border border-green-500/40 bg-green-500/10 text-green-400", yellow: "border border-yellow-500/40 bg-yellow-500/10 text-yellow-400", red: "border border-red-500/40 bg-red-500/10 text-red-400" }; return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tone] || styles.red}`}>{label}</span>; }
function MetricBox({ value, status, compact = false }) { const styles = { good: "border border-green-500/30 bg-green-500/10 text-green-400", avg: "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400", bad: "border border-red-500/30 bg-red-500/10 text-red-400" }; const labels = { good: "Good", avg: "Average", bad: "Poor" }; return <div className={`rounded-xl text-center font-semibold ${styles[status] || styles.bad} ${compact ? "px-2 py-2 text-xs" : "px-3 py-2 text-xs"}`}><div>{value}</div><div className="text-[10px] opacity-80">{labels[status] || "Poor"}</div></div>; }
function metricStatus(value, type) { if (type === "cap") return value >= 7 ? "good" : value >= 5 ? "avg" : "bad"; if (type === "coc") return value >= 8 ? "good" : value >= 4 ? "avg" : "bad"; if (type === "dscr") return value >= 1.2 ? "good" : value >= 1 ? "avg" : "bad"; if (type === "expense") return value < 35 ? "good" : value <= 45 ? "avg" : "bad"; return "bad"; }

function BrandingPanel({ branding, onChange }) {
  const hasBranding = Boolean(
    branding.agentName || branding.company || branding.phone || branding.email
  );
  const [showBrandingPanel, setShowBrandingPanel] = useState(!hasBranding);
  const update = (key, value) => onChange({ ...branding, [key]: value });

  return (
    <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Report Branding</div>
          {hasBranding && (
            <div className="mt-1 text-xs text-slate-400">
              Saved for future branded reports on this device.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowBrandingPanel((prev) => !prev)}
          className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          {showBrandingPanel ? "Hide Branding" : "Edit Branding"}
        </button>
      </div>

      {showBrandingPanel && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <BrandingInput label="Agent Name" value={branding.agentName} onChange={(v) => update("agentName", v)} />
          <BrandingInput label="Company / Brokerage" value={branding.company} onChange={(v) => update("company", v)} />
          <BrandingInput label="Phone" value={branding.phone} onChange={(v) => update("phone", v)} />
          <BrandingInput label="Email" value={branding.email} onChange={(v) => update("email", v)} />
        </div>
      )}
    </div>
  );
}

function BrandingInput({ label, value, onChange }) {
  return (
    <label>
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-white" />
    </label>
  );
}

function AssumptionsPanel({ assumptions, setAssumptions }) { const update = (key, value) => setAssumptions({ ...assumptions, [key]: value }); return <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4"><div className="mb-4 text-lg font-semibold">Global Assumptions</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><AssumptionInput label="Down Payment %" value={assumptions.downPaymentPct} onChange={(v) => update("downPaymentPct", v)} /><label className="block"><div className="mb-2 flex items-start text-xs uppercase tracking-wide text-slate-400"><span>Estimated Financing APR %</span><span className="relative -top-0.5 ml-1 text-[11px] font-bold leading-none text-slate-200">1</span></div><input type="number" inputMode="decimal" enterKeyHint="done" value={assumptions.interestRate} onChange={(e) => update("interestRate", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-white" /></label><AssumptionInput label="Property Tax %" value={assumptions.taxRatePct} onChange={(v) => update("taxRatePct", v)} /><AssumptionInput label="Monthly Insurance" value={assumptions.monthlyInsurance} onChange={(v) => update("monthlyInsurance", v)} /><AssumptionInput label="Closing Costs %" value={assumptions.closingCostsPct} onChange={(v) => update("closingCostsPct", v)} /><AssumptionInput label="Rehab Budget" value={assumptions.rehabBudget} onChange={(v) => update("rehabBudget", v)} /><AssumptionInput label="HOA Monthly" value={assumptions.hoaMonthly} onChange={(v) => update("hoaMonthly", v)} /><AssumptionInput label="Maintenance Cost %" value={assumptions.maintenancePct} onChange={(v) => update("maintenancePct", v)} /><AssumptionInput label="Vacancy Per Year %" value={assumptions.vacancyPct} onChange={(v) => update("vacancyPct", v)} /><AssumptionInput label="Management Fee %" value={assumptions.managementPct} onChange={(v) => update("managementPct", v)} /><AssumptionInput label="Single Family Rent" value={assumptions.singleRent} onChange={(v) => update("singleRent", v)} /><AssumptionInput label="Duplex Rent (Per Unit)" value={assumptions.duplexRent} onChange={(v) => update("duplexRent", v)} /><AssumptionInput label="Triplex Rent (Per Unit)" value={assumptions.triplexRent} onChange={(v) => update("triplexRent", v)} /><AssumptionInput label="Quad Rent (Per Unit)" value={assumptions.quadRent} onChange={(v) => update("quadRent", v)} /></div></div>; }
function AssumptionInput({ label, value, onChange }) { return <label><div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{label}</div><input type="number" inputMode="decimal" enterKeyHint="done" value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3" /></label>; }

function MathLogicNote() { return <div className="mt-6 space-y-6"><div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm"><div className="font-semibold text-white">Professional Investment & Lending Metrics Used</div><div className="mt-2 text-slate-300">Gross Rent → Operating Expenses + HOA → NOI → Debt Service → Monthly Cash Flow → Cap Rate / CoC / DSCR</div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6"><GlossaryCard title="NOI" good="Positive NOI = Good" bad="Negative NOI = Poor" formula="NOI = Gross Rent − Operating Expenses" /><GlossaryCard title="MONTHLY CASH FLOW" good="Positive = Good" bad="Negative = Poor" formula="Monthly Cash Flow = NOI − Monthly Debt Service" /><GlossaryCard title="CAP RATE" good="> 7.0% Good" average="5.0–6.9% Average" bad="< 5.0% Poor" formula="Cap Rate = NOI / Property Price" /><GlossaryCard title="COC" good="> 8.0% Good" average="4.0–7.9% Average" bad="< 4.0% Poor" formula="CoC = Annual Cash Flow / Cash Invested" /><GlossaryCard title="DSCR" good="> 1.20x Good" average="1.00–1.19 Average" bad="< 1.00 Poor" formula="DSCR = NOI / Annual Debt Service" /><GlossaryCard title="EXPENSE RATIO" good="< 35% Good" average="35%–45% Average" bad="> 45% Poor" formula="Expense Ratio = Operating Expenses / Gross Rent" /></div><div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-slate-300"><div className="mb-2 font-semibold text-blue-200">Professional Deal Scoring Model (0–100)</div>
<div>
  The score combines income strength, monthly cash flow, return metrics,
  debt coverage, and expense efficiency into a 0–100 screening score.
</div>
<div className="mt-3 text-[11px] text-slate-400">
  Lower scores may reflect negative cash flow, weak debt coverage,
  high expenses, or limited projected returns.
</div></div></div><div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5 text-sm text-slate-300"><div className="mb-4 text-base font-semibold text-white">Disclaimer & Footnotes</div><div className="space-y-4 leading-7"><p>This tool is intended for preliminary investment screening, educational analysis, rental property underwriting review, and informational purposes only.</p><p>Professional Agent Access is intended for individual professional use. Future additional seat and brokerage access options may become available separately.</p><p>All calculations, deal scores, rent assumptions, cap rates, DSCR values, cash-on-cash returns, NOI calculations, expense ratios, and cash flow projections are estimates based on user inputs and assumptions that may differ from actual market conditions.</p><p>This application does not constitute financial, legal, tax, lending, brokerage, appraisal, accounting, or investment advice. Users should independently verify rents, expenses, financing assumptions, insurance costs, taxes, repair budgets, vacancy assumptions, HOA fees, and investment suitability with qualified professionals before making financial or real estate decisions.</p><p>The creators and publishers assume no liability for errors, omissions, market fluctuations, financing outcomes, underwriting inaccuracies, report outputs, exported files, or investment results arising from the use of this application.</p><div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs leading-6 text-slate-400"><div className="mb-2 font-semibold text-slate-200">Footnotes</div><p><strong>1.</strong> <strong>Estimated Financing APR %</strong> represents an estimated annual borrowing cost that may include lender fees, financing costs, points, and other loan-related charges beyond the base interest rate.</p><p><strong>2.</strong> <strong>Monthly Rent</strong> is an editable rent estimate. Users may adjust it to reflect current leases, expected market rent, or professional judgment for the property.</p><p><strong>3.</strong> <strong>Monthly Property Tax</strong> is estimated from the property price using the global property tax assumption, not county assessed value. It is included for comparison purposes and may be adjusted as needed.</p><p><strong>4.</strong> <strong>NOI (Net Operating Income)</strong> represents income remaining after operating expenses but before mortgage payments.</p><p><strong>5.</strong> <strong>Monthly Cash Flow</strong> represents the estimated money remaining each month after operating expenses and mortgage payments.</p><p><strong>6.</strong> <strong>Cap Rate</strong> measures property yield by dividing annual NOI by purchase price.</p><p><strong>7.</strong> <strong>COC (Cash-on-Cash Return)</strong> measures annual cash flow relative to total invested <span className="text-slate-400">
  cash
</span>.</p><p><strong>8.</strong> <strong>DSCR (Debt Service Coverage Ratio)</strong> measures whether the property's rental income can safely cover mortgage payments. DSCR is commonly reviewed by DSCR lenders, mortgage professionals, banks, and investment property loan programs during underwriting.</p><p><strong>9.</strong> <strong>Expense Ratio</strong> measures how much rental income is consumed by operating expenses before mortgage payments.</p></div></div></div></div>; }
function GlossaryCard({ title, good, average, bad, formula }) { return <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-xs"><div className="mb-3 text-sm font-semibold text-white">{title}</div><div className="space-y-1 leading-5">{good && <div className="text-green-400">{good}</div>}{average && <div className="text-yellow-400">{average}</div>}{bad && <div className="text-red-400">{bad}</div>}</div><div className="mt-4 text-[11px] leading-5 text-slate-400">{formula}</div></div>; }

function printResultsReport(rows, assumptions, branding = {}) {
  if (!rows || rows.length === 0) {
    alert("Please analyze properties before printing a report.");
    return;
  }

  const reportWindow = window.open("", "_blank", "width=1200,height=800");

  if (!reportWindow) {
    alert("Please allow pop-ups to print the report.");
    return;
  }

  const generatedAt = new Date().toLocaleString();
const brandingLines = [
  branding.agentName,
  branding.company,
  branding.phone,
  branding.email,
]
  .map((line) => String(line || "").trim())
  .filter(Boolean);

const brandingHtml = brandingLines.length
  ? brandingLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")
  : `<div class="agent-name">Prepared by Your Real Estate Professional</div>`;

  const rowsHtml = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.rating || "")}</td>
      <td>${Number(row.score || 0).toFixed(1)}</td>
      <td>${escapeHtml(row.propertyType || "")}</td>
      <td>${escapeHtml(row.address || "")}</td>
      <td>${escapeHtml(row.city || "")}</td>
      <td>${formatCurrency(row.price)}</td>
      <td>${formatCurrency(row.monthlyRent)}</td>
      <td>${formatCurrency((row.noiMonthly || 0) * 12)}</td>
      <td>${formatCurrency(row.monthlyCashFlow)}</td>
      <td>${formatPercent(row.capRate)}</td>
      <td>${formatPercent(row.cashOnCash)}</td>
      <td>${Number(row.dscr || 0).toFixed(2)}x</td>
      <td>${formatPercent(row.expenseRatio)}</td>
      <td>${escapeHtml(row.mls || "")}</td>
    </tr>
  `).join("");

  reportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Rental Deal Screener Report</title>
        <style>
          @page {
            size: landscape;
            margin: 0.35in;
          }

          body {
            font-family: Arial, sans-serif;
            color: #111827;
            background: white;
            margin: 0;
            padding: 24px;
          }

          h1 {
            margin: 0;
            font-size: 22px;
          }
.brand-row {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}

.agent-brand {
  text-align: right;
  font-size: 15px;
  line-height: 1.35;
  color: #334155;
  min-width: 260px;
}

.agent-name {
  font-weight: 700;
  color: #0f172a;
  font-size: 15px;
}

.agent-note {
  margin-top: 3px;
  color: #64748b;
}
          .subtitle {
            margin-top: 4px;
            color: #475569;
            font-size: 12px;
          }

          .meta {
            margin-top: 14px;
            display: flex;
            gap: 18px;
            font-size: 11px;
            color: #334155;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
            font-size: 10px;
          }

          th {
            background: #0f172a;
            color: white;
            text-align: left;
            padding: 7px 6px;
            border: 1px solid #1e293b;
            white-space: nowrap;
          }

          td {
            padding: 6px;
            border: 1px solid #cbd5e1;
            vertical-align: top;
          }

          tr:nth-child(even) td {
            background: #f8fafc;
          }

          .disclaimer {
            margin-top: 16px;
            font-size: 10px;
            color: #475569;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="brand-row">
  <div>
    <h1>Rental Deal Screener Pro</h1>
    <div class="subtitle">Investment Property Analysis Report</div>
  </div>
<div class="agent-brand">
  ${brandingHtml}
</div>
</div>
        
        <div class="meta">
          <div><strong>Properties:</strong> ${rows.length}</div>
          <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
          <div><strong>APR:</strong> ${Number(assumptions.interestRate || 0).toFixed(2)}%</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Rating</th>
              <th>Score</th>
              <th>Type</th>
              <th>Address</th>
              <th>City</th>
              <th>Price</th>
              <th>Rent</th>
              <th>NOI</th>
              <th>Cash Flow</th>
              <th>Cap</th>
              <th>CoC</th>
              <th>DSCR</th>
              <th>Expense</th>
              <th>MLS</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="disclaimer">
          This report is for preliminary investment screening and informational purposes only. Users should independently verify rents, expenses, financing, taxes, insurance, repairs, vacancies, and investment suitability.
        </div>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  reportWindow.document.close();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportAgentCSV(rows) { if (!rows || !rows.length) return; const headers = ["Analysis_Status", "Import_Notes", "Source_Row", "MLS_ID", "Property_Address", "City", "State", "Property_Type", "Price", "Score_0_to_100", "Rating", "Annual_NOI", "Monthly_Cash_Flow", "Cap_Rate", "Cash_on_Cash_Return", "Debt_Coverage_Ratio", "Expense_Ratio", "Monthly_Rent", "Beds", "Full_Baths", "Half_Baths", "Year_Built", "Living_Area", "Days_On_Market", "Subdivision"]; const body = rows.map((row) => [row.importStatus || "Analyzed", row.importNotes || "Complete", row.sourceRow || "", row.mls, row.address, row.city, row.state, row.propertyType, Math.round(row.price), row.score.toFixed(1), row.rating, Math.round(row.noiMonthly * 12), Math.round(row.monthlyCashFlow), row.capRate.toFixed(2), row.cashOnCash.toFixed(2), row.dscr.toFixed(2), row.expenseRatio.toFixed(2), Math.round(row.monthlyRent), row.bedrooms || "", row.fullBaths || "", row.halfBaths || "", row.yearBuilt || "", row.livingArea || "", row.daysOnMarket || "", row.subdivision || ""]); const csv = [headers, ...body].map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; const requestedName = window.prompt("Name your file (client or property):", "Rental Deal Analysis");
if (requestedName === null) {
  URL.revokeObjectURL(url);
  return;
}
const cleanName = (requestedName.trim() || "Rental Deal Analysis").replace(/[<>:"/\\|?*]+/g, "").slice(0, 80);
link.download = `${cleanName || "Rental Deal Analysis"}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
function logCalculateEvent(rows) { console.log("Calculate analytics event", { rowCount: rows.length, cities: Array.from(new Set(rows.map((row) => row.city).filter(Boolean))), zipCodes: Array.from(new Set(rows.map((row) => row.zip || row.zipCode).filter(Boolean))), createdAt: new Date().toISOString() }); }
function parseNumber(value) { const cleaned = String(value || "").replace(/,/g, "").replace(/[^0-9.-]/g, ""); return Number(cleaned) || 0; }
function parseBoolean(value) { const text = String(value || "").trim().toLowerCase(); if (["yes", "y", "true", "1"].includes(text)) return true; if (["no", "n", "false", "0"].includes(text)) return false; return ""; }
function formatCurrency(value) { const rounded = Math.round(Number(value) || 0); const absolute = Math.abs(rounded).toLocaleString(); return rounded < 0 ? `-$${absolute}` : `$${absolute}`; }
function formatPercent(value) { return `${(Number(value) || 0).toFixed(1)}%`; }
function UpgradeModal({ onClose }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-lg rounded-3xl border border-blue-500/30 bg-slate-950 p-8 shadow-2xl"><div className="mb-4 text-center"><div className="mb-2 text-2xl font-bold text-white">Free Trials Completed</div><div className="text-sm leading-7 text-slate-300">Unlock bulk rental analysis, CSV exports, advanced deal scoring, and up to 100-property batch processing.</div></div><div className="mb-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center"><div className="text-sm text-blue-200">Professional Agent Access</div><div className="mt-2 text-4xl font-bold text-white">$49<span className="text-lg font-medium text-slate-300">/month</span></div><div className="mt-3 text-xs leading-6 text-slate-400">Cancel anytime. Access remains active through the current billing period.</div></div><button onClick={onClose} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">Close</button></div></div>; }
function LegalModal({ type, onClose }) { const content = { contact: { title: "Contact", body: "Rental Deal Screener is operated by Caribmare LLC. For business inquiries or general questions, contact support@RentalDealScreener.pro." }, support: { title: "Support", body: "Need help, found a bug, or have account questions? Email support@RentalDealScreener.pro and include screenshots or property details when possible." } }; const selected = content[type]; if (!selected) return null; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{selected.title}</h2><button onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:bg-slate-800">Close</button></div><div className="text-sm leading-7 text-slate-300">{selected.body}</div></div></div>; }