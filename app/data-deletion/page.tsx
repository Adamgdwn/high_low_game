import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion Request | Vegas High/Low",
  description: "How to request deletion of account and cloud-synced game data for Vegas-Style High / Low."
};

export default function DataDeletionPage() {
  const effectiveDate = "2026-02-25";
  const contactEmail = "privacy@highlowgame.app";

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4 sm:p-6">
      <div className="panel neon-ring p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-slate-50 sm:text-3xl">Data Deletion Request</h1>
          <div className="flex gap-2">
            <Link
              href="/privacy"
              className="btn-press rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Privacy Policy
            </Link>
            <Link
              href="/"
              className="btn-press rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Back To Game
            </Link>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-6 text-slate-200">
          <p>
            Effective date: <span className="font-semibold">{effectiveDate}</span>
          </p>

          <section>
            <h2 className="text-base font-semibold text-slate-50">How To Request Deletion</h2>
            <p>
              To request deletion of your account and cloud-synced data, email{" "}
              <a className="underline decoration-cyan-200/60 underline-offset-2 hover:text-cyan-100" href={`mailto:${contactEmail}?subject=Data%20Deletion%20Request`}>
                {contactEmail}
              </a>{" "}
              with the subject line <span className="font-semibold">Data Deletion Request</span>.
            </p>
            <p>Please send the request from the same email address used to create/sign in to your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">What Will Be Deleted</h2>
            <p>Upon verification, we will delete the account-related cloud data used by this app, including:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              <li>Authentication account access for this app (Supabase Auth account, if applicable)</li>
              <li>Cloud-synced gameplay/profile data (for example chip balance, settings, streak, and preferences)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">What Is Not Deleted Automatically</h2>
            <p>
              Local data stored on your own devices (such as browser localStorage or Android on-device preferences) may
              remain until you clear browser/app data or uninstall the app.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Timing</h2>
            <p>We aim to process deletion requests within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-50">Notes</h2>
            <p>
              This app is a social casino demo using fake chips only. Chips have no cash value, no cash out, and no
              prizes.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

