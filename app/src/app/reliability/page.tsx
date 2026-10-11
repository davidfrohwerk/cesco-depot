import { createReliabilityEvidence } from "@/app/actions/reliability-evidence";
import {
  requireInternalPagePermission,
  userHasInternalPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

export default async function ReliabilityEvidencePage() {
  const user = await requireInternalPagePermission("reliability_evidence.view");
  const canManage = userHasInternalPermission(user, "reliability_evidence.manage");

  const evidence = await prisma.reliabilityEvidence.findMany({
    include: {
      createdBy: {
        select: {
          displayName: true,
          email: true,
        },
      },
      _count: {
        select: {
          assessmentLinks: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div>
        <p className="text-sm opacity-60">CESCo research</p>
        <h1 className="text-3xl font-bold">Reliability evidence registry</h1>
        <p className="mt-3 max-w-4xl leading-7 opacity-70">
          Curate attributable OEM, government, public-field, research, and
          licensed surrogate evidence. Preserve the publisher's native metric
          and conditions. Any conversion used by Depot belongs to the
          assessment link, not to the source record.
        </p>
      </div>

      {canManage && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">Add published evidence</h2>
          <form
            action={createReliabilityEvidence}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input name="publisher" required placeholder="Publisher / source organization" className="rounded border px-3 py-2" />
            <input name="sourceTitle" required placeholder="Document / dataset title" className="rounded border px-3 py-2" />
            <input name="sourceUrl" type="url" placeholder="Source URL" className="rounded border px-3 py-2" />
            <input name="sourceIdentifier" placeholder="Formal identifier / document number" className="rounded border px-3 py-2" />
            <input name="manufacturer" placeholder="Manufacturer" className="rounded border px-3 py-2" />
            <input name="model" placeholder="Exact model" className="rounded border px-3 py-2" />
            <input name="modelFamily" placeholder="Model family" className="rounded border px-3 py-2" />
            <input name="assetClass" placeholder="Equipment / asset class" className="rounded border px-3 py-2" />

            <select name="metricType" defaultValue="MTBF" className="rounded border px-3 py-2">
              {["FIELD_AFR","FAILURE_RATE","MTBF","MTTF","FAILURE_PROBABILITY","LIFECYCLE_INTERVAL","DUTY_CYCLE_LIMIT","OTHER"].map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="value" type="number" step="any" placeholder="Source value" className="rounded border px-3 py-2" />
              <input name="unit" placeholder="Unit (hours, %, pages...)" className="rounded border px-3 py-2" />
            </div>

            <select name="evidenceType" defaultValue="OEM_PREDICTED" className="rounded border px-3 py-2">
              {["PUBLIC_FIELD","OEM_FIELD","OEM_PREDICTED","GOVERNMENT_REFERENCE","COMMERCIAL_SURROGATE","RESEARCH_SURROGATE","PLANNING_ASSUMPTION"].map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select name="specificity" defaultValue="EXACT_MODEL" className="rounded border px-3 py-2">
              {["EXACT_MODEL","MODEL_FAMILY","ASSEMBLY_CLASS","COMPONENT_CLASS","EQUIPMENT_CLASS"].map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select name="confidence" defaultValue="MODERATE" className="rounded border px-3 py-2">
              {["HIGH","MODERATE","LOW","INSUFFICIENT"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <input name="sourcePublishedAt" type="date" className="rounded border px-3 py-2" />

            <label className="flex items-center gap-2 text-sm">
              <input name="observed" type="checkbox" />
              Publisher describes this as observed field evidence
            </label>
            <input name="temperatureC" type="number" step="any" placeholder="Reference temperature C" className="rounded border px-3 py-2" />

            <input name="populationSize" type="number" min="0" placeholder="Published population size" className="rounded border px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <input name="exposureValue" type="number" min="0" step="any" placeholder="Exposure" className="rounded border px-3 py-2" />
              <input name="exposureUnit" placeholder="Exposure unit" className="rounded border px-3 py-2" />
            </div>
            <input name="failureCount" type="number" min="0" placeholder="Published failure count" className="rounded border px-3 py-2" />
            <input name="operatingEnvironment" placeholder="Operating / reference environment" className="rounded border px-3 py-2" />

            <textarea name="methodology" placeholder="Publisher methodology" className="rounded border px-3 py-2 md:col-span-2" />
            <textarea name="dutyCycleNotes" placeholder="Duty cycle / workload conditions" className="rounded border px-3 py-2 md:col-span-2" />
            <textarea name="applicabilityNotes" placeholder="Applicability to Depot equipment populations" className="rounded border px-3 py-2 md:col-span-2" />
            <textarea name="limitations" placeholder="Known source limitations" className="rounded border px-3 py-2 md:col-span-2" />
            <textarea name="licenseNotes" placeholder="Licensing / attribution / redistribution notes" className="rounded border px-3 py-2 md:col-span-2" />

            <button type="submit" className="rounded border px-4 py-2 font-medium md:col-span-2">
              Add evidence record
            </button>
          </form>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Curated evidence</h2>
        <div className="mt-5 space-y-4">
          {evidence.length === 0 ? (
            <div className="rounded border p-5 text-sm opacity-70">
              No reliability evidence has been curated yet.
            </div>
          ) : (
            evidence.map((item) => (
              <article key={item.id} className="rounded border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm opacity-60">
                      {item.evidenceType.replaceAll("_", " ")} · {item.specificity.replaceAll("_", " ")}
                    </div>
                    <h3 className="mt-1 font-semibold">{item.sourceTitle}</h3>
                    <div className="mt-1 text-sm opacity-70">
                      {item.publisher}
                      {[item.manufacturer, item.model].filter(Boolean).length
                        ? ` · ${[item.manufacturer, item.model].filter(Boolean).join(" ")}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-sm">
                    <strong>{item.metricType.replaceAll("_", " ")}</strong>
                    {item.value != null ? ` · ${item.value}` : ""}
                    {item.unit ? ` ${item.unit}` : ""}
                  </div>
                </div>

                <div className="mt-3 text-sm opacity-70">
                  Confidence: {item.confidence} · {item.observed ? "Observed" : "Predicted / reference"} · Used by {item._count.assessmentLinks} assessment population{item._count.assessmentLinks === 1 ? "" : "s"}
                </div>

                {item.operatingEnvironment && (
                  <div className="mt-2 text-sm opacity-70">
                    Environment: {item.operatingEnvironment}
                    {item.temperatureC != null ? ` · ${item.temperatureC} C` : ""}
                  </div>
                )}

                {item.applicabilityNotes && (
                  <p className="mt-3 text-sm leading-6">{item.applicabilityNotes}</p>
                )}

                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm underline"
                  >
                    Open published source
                  </a>
                )}

                <div className="mt-3 text-xs opacity-50">
                  Curated by {item.createdBy?.displayName ?? item.createdBy?.email ?? "CESCo"} · Retrieved {item.retrievedAt.toLocaleDateString()}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
