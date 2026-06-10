import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react"; // 👈 ADD THIS

import InvestorV1 from "./pages/InvestorV1";
import AgentV2 from "./pages/AgentV2";

import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Disclaimer from "./pages/Disclaimer";

export default function App() {

  useEffect(() => {
    if (window.location.pathname === "/success") {
      localStorage.setItem("subscribed", "true");
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InvestorV1 />} />
        <Route path="/agents" element={<AgentV2 />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/success" element={<AgentV2 />} />
      </Routes>
    </BrowserRouter>
  );
}

