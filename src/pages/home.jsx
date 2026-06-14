import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6">

      {/* Header */}
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-cyan-300">
          Rental Deal Screener Pro
        </h1>

        <p className="mt-4 text-lg text-slate-300">
          Turn rental property data into investment decisions in seconds.
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-10 flex flex-col md:flex-row gap-4">

        {/* Investors */}
        <Link to="/investors">
          <button className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 transition font-semibold shadow-lg">
            Analyze One Property
          </button>
        </Link>

        {/* Agents */}
        <Link to="/agents">
          <button className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 transition font-semibold shadow-lg">
            Analyze MLS CSV
          </button>
        </Link>

      </div>

      {/* Small trust line */}
      <p className="mt-8 text-sm text-slate-400 text-center max-w-xl">
        Built for rental deal screening, cash flow, cap rate, DSCR, and investor-ready reporting.
      </p>

    </div>
  );
}