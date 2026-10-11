import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createInfrastructureAssessment,
  generateAssessmentScenarios,
  updateAssessmentPopulation,
} from "@/app/actions/infrastructure-assessments";
import {
  requireOrganizationPagePermission,
  userHasOrganizationPermission,
} from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

function yesNoUnknown(value: boolean | null) {
  if (value === true) return "YES";
  if (value === false) return "NO";
  return "UNKNOWN";
}

export default async function ResilienceAssessmentPage({ params }: PageProps) {
  const { id: organizationId } = await params;

  const currentUser = await requireOrganizationPagePermission(
    "assessment.view",
    organizationId
  );

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      kind: true,
      _count: {
        select: {
          assets: true,
          endpoints: true,
        },
      },
    },
  });

  if (!organization || organization.kind !== "CLIENT") {
    notFound();
  }

  const canManage = userHasOrganizationPermission(
    currentUser,
    "assessment.manage",
    organizationId
  );

  const assessments = await prisma.infrastructureAssessment.findMany({
    prisma.infrastructureAssessment.findMany({
    where: { organizationId },
    include: {
      createdBy: {
        select: {
          displayName: true,
          email: true,
        },
      },
      sourceImportJob: {
        select: {
          originalFilename: true,
          committedAt: true,
        },
      },
      populations: {
        include: {
          evidenceLinks: {
            include: {
              reliabilityEvidence: true,
            },
            orderBy: [
              { selectedForPlanning: "desc" },
              { createdAt: "asc" },
            ],
          },
          scenarios: {
            orderBy: { kind: "asc" },
          },
          _count: {
            select: {
              assets: true,
              evidenceLinks: true,
              scenarios: true,
            },
          },
        },
        orderBy: [
          { missionCritical: "desc" },
          { populationLabel: "asc" },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-7xl p-8">
      <Link
        href={`/organizations/${organizationId}`}
        className="text-sm underline"
      >
        ← {organization.name}
      </Link>

      <div className="mt-6">
        <p className="text-sm opacity-60">Infrastructure resilience</p>
        <h1 className="text-3xl font-bold">Strategic-spares assessment</h1>
        <p className="mt-3 max-w-4xl leading-7 opacity-70">
          Group the infrastructure you already imported, identify which
          populations are mission critical, and capture the recovery facts
          that materially affect a strategic-spares recommendation. Published
          reliability evidence and statistical scenarios are attached in later
          steps; Depot does not invent a failure rate when evidence is missing.
        </p>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border p-4">
          <div className="text-sm opacity-60">Endpoints</div>
          <div className="mt-1 text-2xl font-semibold">
            {organization._count.endpoints}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm opacity-60">Assets</div>
          <div className="mt-1 text-2xl font-semibold">
            {organization._count.assets}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm opacity-60">Assessments</div>
          <div className="mt-1 text-2xl font-semibold">
            {assessments.length}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm opacity-60">Current stage</div>
          <div className="mt-1 font-semibold">Criticality + recovery inputs</div>
        </div>
      </section>

      {!canManage && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">Read-only assessment access</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 opacity-70">
            Your current role can view resilience assessments but cannot create
            or edit them. A client administrator or authorized CESCo operator
            must start the assessment and enter recovery inputs.
          </p>
        </section>
      )}

      {canManage && (
        <section className="mt-8 rounded border p-5">
          <h2 className="text-xl font-semibold">Start from current inventory</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 opacity-70">
            Depot will snapshot the current asset population into groups based
            on manufacturer, model, asset class, and compatibility class. The
            source assets remain ordinary lifecycle records; the assessment
            keeps its own population membership so later inventory edits do not
            silently rewrite the analytical basis.
          </p>

          <form
            action={createInfrastructureAssessment.bind(null, organizationId)}
            className="mt-4 flex flex-wrap gap-3"
          >
            <input
              name="name"
              placeholder="Assessment name (optional)"
              className="min-w-72 flex-1 rounded border px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border px-4 py-2 font-medium"
              disabled={organization._count.assets === 0}
            >
              Create assessment
            </button>
          </form>

          {organization._count.assets === 0 && (
            <p className="mt-3 text-sm opacity-70">
              Import or register assets before creating an assessment.
            </p>
          )}
        </section>
      )}

      <section className="mt-10 space-y-8">
        {assessments.length === 0 ? (
          <div className="rounded border p-5 text-sm opacity-70">
            No infrastructure resilience assessment has been created yet.
          </div>
        ) : (
          assessments.map((assessment) => (
            <article key={assessment.id} className="rounded border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm opacity-60">
                    {assessment.status.replaceAll("_", " ")}
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {assessment.name}
                  </h2>
                  <p className="mt-2 text-sm opacity-70">
                    Created by{" "}
                    {assessment.createdBy.displayName ??
                      assessment.createdBy.email}
                    {assessment.sourceImportJob
                      ? ` · inventory source: ${assessment.sourceImportJob.originalFilename}`
                      : " · inventory source: current asset records"}
                  </p>
                </div>
                <div className="rounded border px-3 py-2 text-sm">
                  {assessment.populations.length} equipment populations
                </div>
              </div>

              <div className="mt-6 space-y-5">
                {assessment.populations.map((population) => (
                  <section key={population.id} className="rounded border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {population.populationLabel}
                        </h3>
                        <div className="mt-1 text-sm opacity-70">
                          {population.assetCount} asset
                          {population.assetCount === 1 ? "" : "s"}
                          {population.assetClass
                            ? ` · ${population.assetClass}`
                            : ""}
                          {population.compatibilityClass
                            ? ` · compatibility: ${population.compatibilityClass}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-xs opacity-60">
                        Evidence: {population._count.evidenceLinks} · Scenarios:{" "}
                        {population._count.scenarios}
                      </div>
                    </div>

                    {population._count.evidenceLinks === 0 && (
                      <div className="mt-4 rounded border p-3 text-sm opacity-70">
                        No published reliability evidence has been linked to
                        this population yet. Depot should disclose that gap
                        rather than assign an unsupported AFR.
                      </div>
                    )}

                    {population.evidenceLinks.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {population.evidenceLinks.map((link) => (
                          <div
                            key={link.id}
                            className="rounded border p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <strong>
                                  {link.reliabilityEvidence.sourceTitle}
                                </strong>
                                <div className="mt-1 opacity-70">
                                  {link.reliabilityEvidence.publisher}
                                  {link.reliabilityEvidence.value != null
                                    ? ` · ${link.reliabilityEvidence.metricType.replaceAll("_", " ")} ${link.reliabilityEvidence.value}${link.reliabilityEvidence.unit ? ` ${link.reliabilityEvidence.unit}` : ""}`
                                    : ` · ${link.reliabilityEvidence.metricType.replaceAll("_", " ")}`}
                                </div>
                              </div>
                              {link.selectedForPlanning && (
                                <span className="rounded border px-2 py-1 text-xs font-medium">
                                  Planning basis
                                </span>
                              )}
                            </div>
                            {link.transformation && (
                              <div className="mt-2 text-xs opacity-60">
                                CESCo transformation / use: {link.transformation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {population._count.evidenceLinks > 0 && (
                      <div className="mt-3 text-xs opacity-60">
                        Reliability evidence was matched automatically from the
                        CESCo source registry. Customer action is not required.
                      </div>
                    )}

                    {population.evidenceLinks.some(
                      (link) => link.selectedForPlanning
                    ) && (
                      <section className="mt-5 rounded border p-4">
                        <h4 className="font-semibold">Demand scenarios</h4>
                        <p className="mt-2 text-sm leading-6 opacity-70">
                          Depot normalizes the selected published planning basis
                          only when its metric/unit pair has an approved
                          transformation. The statistical reserve is calculated
                          with a Poisson demand model. Contingency reserve stays
                          separate because common-mode failures are not
                          independent demand.
                        </p>

                        {canManage && (
                          <form
                            action={generateAssessmentScenarios.bind(
                              null,
                              population.id
                            )}
                            className="mt-4 grid gap-3 md:grid-cols-2"
                          >
                            <label className="grid gap-1 text-sm">
                              <span>Exposure window (days)</span>
                              <input
                                name="exposureWindowDays"
                                type="number"
                                min="0"
                                step="0.25"
                                required
                                defaultValue={
                                  population.procurementLeadDays ??
                                  population.repairTurnaroundDays ??
                                  ""
                                }
                                className="rounded border px-3 py-2"
                              />
                            </label>

                            <label className="grid gap-1 text-sm">
                              <span>Target service level (%)</span>
                              <input
                                name="targetServiceLevelPercent"
                                type="number"
                                min="0.01"
                                max="99.99"
                                step="0.01"
                                required
                                defaultValue="99"
                                className="rounded border px-3 py-2"
                              />
                            </label>

                            <label className="grid gap-1 text-sm">
                              <span>Low scenario multiplier</span>
                              <input
                                name="lowMultiplier"
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="rounded border px-3 py-2"
                              />
                            </label>

                            <label className="grid gap-1 text-sm">
                              <span>Stress scenario multiplier</span>
                              <input
                                name="stressMultiplier"
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="rounded border px-3 py-2"
                              />
                            </label>

                            <label className="grid gap-1 text-sm md:col-span-2">
                              <span>
                                Explicit contingency reserve (whole units)
                              </span>
                              <input
                                name="contingencyReserve"
                                type="number"
                                min="0"
                                step="1"
                                defaultValue="0"
                                className="rounded border px-3 py-2"
                              />
                            </label>

                            <div className="md:col-span-2 text-xs leading-5 opacity-60">
                              PLANNING uses the normalized published evidence.
                              LOW and STRESS are optional sensitivity scenarios.
                              Enter multipliers only when the assessment has a
                              documented reason to test them; Depot does not
                              invent default uncertainty bands.
                            </div>

                            <button
                              type="submit"
                              className="rounded border px-4 py-2 font-medium md:col-span-2"
                            >
                              Generate planning scenario
                            </button>
                          </form>
                        )}

                        {population.scenarios.length > 0 && (
                          <div className="mt-5 grid gap-3 lg:grid-cols-3">
                            {population.scenarios.map((scenario) => (
                              <article
                                key={scenario.id}
                                className="rounded border p-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <strong>{scenario.kind}</strong>
                                  <span className="text-xs opacity-60">
                                    {scenario.confidence} confidence
                                  </span>
                                </div>
                                <div className="mt-3 text-2xl font-semibold">
                                  {scenario.totalRecommendedSpareCount ?? "—"}{" "}
                                  spare
                                  {scenario.totalRecommendedSpareCount === 1
                                    ? ""
                                    : "s"}
                                </div>
                                <div className="mt-3 space-y-1 text-sm opacity-70">
                                  <div>
                                    Annual planning probability:{" "}
                                    {scenario.annualFailureProbability == null
                                      ? "—"
                                      : `${(
                                          scenario.annualFailureProbability *
                                          100
                                        ).toFixed(3)}%`}
                                  </div>
                                  <div>
                                    Expected demand in window:{" "}
                                    {scenario.expectedDemand == null
                                      ? "—"
                                      : scenario.expectedDemand.toFixed(3)}
                                  </div>
                                  <div>
                                    Statistical reserve:{" "}
                                    {scenario.recommendedSpareCount ?? "—"}
                                  </div>
                                  <div>
                                    Contingency reserve:{" "}
                                    {scenario.contingencyReserve ?? 0}
                                  </div>
                                  <div>
                                    Exposure window:{" "}
                                    {scenario.exposureWindowDays ?? "—"} days
                                  </div>
                                  <div>
                                    Service level:{" "}
                                    {scenario.targetServiceLevel == null
                                      ? "—"
                                      : `${(
                                          scenario.targetServiceLevel * 100
                                        ).toFixed(2)}%`}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {canManage ? (
                      <form
                        action={updateAssessmentPopulation.bind(
                          null,
                          population.id
                        )}
                        className="mt-5 grid gap-3 md:grid-cols-2"
                      >
                        <label className="grid gap-1 text-sm">
                          <span>Mission critical?</span>
                          <select
                            name="missionCritical"
                            defaultValue={yesNoUnknown(
                              population.missionCritical
                            )}
                            className="rounded border px-3 py-2"
                          >
                            <option value="UNKNOWN">Unknown / not assessed</option>
                            <option value="YES">Yes</option>
                            <option value="NO">No</option>
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Recovery target (hours)</span>
                          <input
                            name="rtoHours"
                            type="number"
                            min="0"
                            step="0.25"
                            defaultValue={population.rtoHours ?? ""}
                            className="rounded border px-3 py-2"
                          />
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Local redundancy?</span>
                          <select
                            name="localRedundancy"
                            defaultValue={yesNoUnknown(
                              population.localRedundancy
                            )}
                            className="rounded border px-3 py-2"
                          >
                            <option value="UNKNOWN">Unknown / not assessed</option>
                            <option value="YES">Yes</option>
                            <option value="NO">No</option>
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Substitutable model available?</span>
                          <select
                            name="substitutable"
                            defaultValue={yesNoUnknown(
                              population.substitutable
                            )}
                            className="rounded border px-3 py-2"
                          >
                            <option value="UNKNOWN">Unknown / not assessed</option>
                            <option value="YES">Yes</option>
                            <option value="NO">No</option>
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Procurement lead time (days)</span>
                          <input
                            name="procurementLeadDays"
                            type="number"
                            min="0"
                            step="0.25"
                            defaultValue={population.procurementLeadDays ?? ""}
                            className="rounded border px-3 py-2"
                          />
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Repair turnaround (days)</span>
                          <input
                            name="repairTurnaroundDays"
                            type="number"
                            min="0"
                            step="0.25"
                            defaultValue={population.repairTurnaroundDays ?? ""}
                            className="rounded border px-3 py-2"
                          />
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Field replacement time (hours)</span>
                          <input
                            name="fieldReplacementHours"
                            type="number"
                            min="0"
                            step="0.25"
                            defaultValue={population.fieldReplacementHours ?? ""}
                            className="rounded border px-3 py-2"
                          />
                        </label>

                        <label className="grid gap-1 text-sm">
                          <span>Configuration / validation time (hours)</span>
                          <input
                            name="configurationHours"
                            type="number"
                            min="0"
                            step="0.25"
                            defaultValue={population.configurationHours ?? ""}
                            className="rounded border px-3 py-2"
                          />
                        </label>

                        <textarea
                          name="criticalityNotes"
                          defaultValue={population.criticalityNotes ?? ""}
                          placeholder="What business function fails or degrades?"
                          className="rounded border px-3 py-2 md:col-span-2"
                        />
                        <textarea
                          name="redundancyNotes"
                          defaultValue={population.redundancyNotes ?? ""}
                          placeholder="Failover, HA pair, coverage overlap, RAID, alternate device..."
                          className="rounded border px-3 py-2 md:col-span-2"
                        />
                        <textarea
                          name="substituteNotes"
                          defaultValue={population.substituteNotes ?? ""}
                          placeholder="Approved substitutes / compatibility limitations"
                          className="rounded border px-3 py-2 md:col-span-2"
                        />
                        <textarea
                          name="customerInputNotes"
                          defaultValue={population.customerInputNotes ?? ""}
                          placeholder="Other recovery, environment, workload, or operational context"
                          className="rounded border px-3 py-2 md:col-span-2"
                        />

                        <button
                          type="submit"
                          className="rounded border px-4 py-2 font-medium md:col-span-2"
                        >
                          Save recovery inputs
                        </button>
                      </form>
                    ) : (
                      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                        <div>
                          Mission critical:{" "}
                          <strong>
                            {population.missionCritical == null
                              ? "Not assessed"
                              : population.missionCritical
                                ? "Yes"
                                : "No"}
                          </strong>
                        </div>
                        <div>
                          RTO:{" "}
                          <strong>
                            {population.rtoHours == null
                              ? "Not supplied"
                              : `${population.rtoHours} hours`}
                          </strong>
                        </div>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="mt-10 rounded border p-5">
        <h2 className="text-xl font-semibold">What comes next</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 opacity-70">
          Depot now automatically matches any already-known published
          reliability evidence to the imported equipment population. The
          remaining work is source discovery: when the registry does not yet
          contain a defensible source, the enrichment engine should search
          approved OEM, government, public-field, and licensed sources without
          asking the customer to research or enter reliability data manually.
        </p>
      </section>
    </main>
  );
}
