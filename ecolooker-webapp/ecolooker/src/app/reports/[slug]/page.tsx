import Link from "next/link";

type ReportPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function ReportPage({
  params,
}: ReportPageProps) {
  const { slug } = await params;
  const reportName = formatTitle(slug);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-600">
          EcoLooker Report
        </p>

        <h1 className="text-3xl font-bold text-slate-900">
          {reportName || "Report"}
        </h1>

        <p className="mt-4 text-lg leading-8 text-slate-600">
          This report page is currently under development. Data,
          visualizations, and analysis will appear here soon.
        </p>

        <div className="mt-8 rounded-lg bg-slate-100 p-4">
          <p className="text-sm text-slate-500">Report identifier</p>
          <code className="mt-1 block text-sm font-medium text-slate-800">
            {slug}
          </code>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Return to home
        </Link>
      </section>
    </main>
  );
}