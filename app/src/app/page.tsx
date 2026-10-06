import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-4xl font-bold">CESCo Depot</h1>

      <p className="mt-4 max-w-2xl text-lg">
        Depot repair, strategic stocking, asset lifecycle, and circular
        disposition platform.
      </p>

      <div className="mt-8">
        <Link
          href="/organizations"
          className="rounded border px-4 py-2 font-medium"
        >
          Organizations
        </Link>
      </div>
    </main>
  );
}
