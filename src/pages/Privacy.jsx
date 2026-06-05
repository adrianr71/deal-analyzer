export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-4xl font-bold text-white">Privacy Policy</h1>

        <div className="space-y-6 text-sm leading-7">
          <p>
            Rental Deal Screener respects your privacy and is committed to
            protecting your information.
          </p>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Information We Collect
            </h2>
            <p>
              We may collect account information, session activity, browser or
              device identifiers, uploaded CSV data, and platform usage
              analytics to improve functionality, security, and user experience.
            </p>


	    <h2 className="mb-2 text-xl font-semibold text-white">
	      Property Data Only
	    </h2>
	    <p>
	      The platform is designed to process property listing information.
	      Users should not upload personal information. If personal information
	      is uploaded inadvertently, users should immediately remove the data
	      and notify support.
	    </p>
	   </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Payment Processing
            </h2>
            <p>
              Payments are securely processed through Stripe. Rental Deal
              Screener does not store full credit card information.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Usage Analytics
            </h2>
            <p>
              Limited analytics and device/session tracking may be used for
              account integrity, abuse prevention, and platform improvement.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Data Sharing
            </h2>
            <p>
              We do not sell personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Contact
            </h2>
            <p>
              For privacy-related questions, please contact support through the
              platform.
            </p>
          </section>

          <p className="pt-6 text-slate-400">
            Last updated: June 	2026
          </p>
        </div>
      </div>
    </div>
  );
}