"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ReportsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-600">
          EcoLooker Report
        </p>

        <h1 className="text-3xl font-bold text-slate-900">
          Report unavailable
        </h1>

        <p className="mt-4 text-lg leading-8 text-slate-600">
          We couldn&apos;t load this report right now. The upstream data
          source may be temporarily down — please try again shortly.
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Try again
          </button>

          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Return to home
          </Link>
        </div>
      </section>
    </main>
  );
}
