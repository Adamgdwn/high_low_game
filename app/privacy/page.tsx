import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Vegas High/Low",
  description: "Privacy policy for the Vegas-Style High / Low social casino demo."
};

export default function PrivacyPage() {
  const effectiveDate = "2026-02-25";

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4 sm:p-6">
      <div className="panel neon-ring p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-slate-50 sm:text-3xl">Privacy Policy</h1>
          <Link
            href="/"
            className="btn-press rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Back To Game
          </Link>
        </div>

        <div className="space-y-4 text-sm leading-6 text-slate-200">
          <p>
            Effective date: <span className="font-semibold">{effectiveDate}</span>
          </p>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Overview</h2>
            <p>
              Vegas-Style High / Low is a social casino demo using fake chips only. Chips have no cash value, no cash
              out, and no prizes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">What We Store</h2>
            <p>
              The app stores gameplay preferences and progress such as chip balance, settings, streak, and last bet so
              your experience can continue between sessions.
            </p>
            <p>
              On web, this may be stored in your browser (localStorage). On Android, this may be stored on-device
              (SharedPreferences).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Accounts And Cloud Sync</h2>
            <p>
              If you create an account or sign in, the app uses Supabase for authentication and cloud sync. This allows
              gameplay settings and progress to sync across devices.
            </p>
            <p>
              To request deletion of account/cloud-synced data, visit{" "}
              <Link href="/data-deletion" className="underline decoration-cyan-200/60 underline-offset-2 hover:text-cyan-100">
                Data Deletion Request
              </Link>.
            </p>
            <p>
              We do not process real-money payments, payouts, or cash-out information for this app.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Analytics / Ads</h2>
            <p>This MVP does not intentionally include third-party ads or analytics SDKs.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Data Use</h2>
            <p>
              Stored data is used only to run the game experience, save preferences, and support optional account-based
              sync.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Children</h2>
            <p>
              This app is intended for beta testing and social casino demo use. Please follow platform age-rating and
              testing requirements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Contact</h2>
            <p>
              For privacy questions or beta feedback, contact the app publisher through the testing channel used to
              invite you.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Changes</h2>
            <p>This policy may be updated as the app evolves. The latest version will be posted at this page.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
