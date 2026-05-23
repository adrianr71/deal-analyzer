import { BrowserRouter, Routes, Route } from "react-router-dom";
import InvestorV1 from "./pages/InvestorV1";
import AgentV2 from "./pages/AgentV2";

import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Disclaimer from "./pages/Disclaimer";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InvestorV1 />} />
        <Route path="/agents" element={<AgentV2 />} />
      </Routes>
    </BrowserRouter>
  );
}