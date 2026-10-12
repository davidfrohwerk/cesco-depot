import Link from "next/link";
import { requireInternalPagePermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";
import { verifyReceivedPackage } from "@/app/actions/receiving-reconciliation";

export default async function ReceivingVerificationPage() {
  await requireInternalPagePermission("inventory.receive");
  const receipts = await prisma.receipt.findMany({
    where: { reconciliation: { is: null },
      package: { status: "RECEIVED", shipment: {
        direction: "INBOUND", externalServiceCaseId: null
      }}},
    include: { package: { include: { contents: true,
      shipment: { include: { serviceRequest: {include:{organization:true}}}}
    }}},
    orderBy: {receivedAt:"asc"}, take: 100
  });
  return <main className="mx-auto max-w-5xl p-8">
    <Link className="underline text-sm" href="/operations">← Operations</Link>
    <h1 className="mt-5 text-3xl font-bold">Receiving verification</h1>
    <p className="mt-3 opacity-70">Inspect physical contents before certifying them.
      This first workflow accepts only exact matches and good-condition receipts.
      Discrepancies remain pending for exception handling. Verification does not
      automatically create a customer charge.</p>
    <div className="mt-8 space-y-5">
      {receipts.length===0 && <p>No pending receipts.</p>}
      {receipts.map(r=>{
        const expected=r.package.contents.filter(c=>c.expected);
        const count=expected.reduce((sum,c)=>sum+c.quantity,0);
        const eligible=r.condition==="GOOD" && r.sealIntact!==false &&
          expected.length>0 && count>0 && count<=1000000;
        return <section className="rounded border p-5" key={r.id}>
          <div className="font-semibold">{r.package.shipment.serviceRequest.organization.name}</div>
          <p className="text-sm opacity-70">Package: {r.package.packageCode??r.package.id}
            {" · "}Received: {r.receivedAt.toLocaleString()}
            {" · "}Condition: {r.condition}
            {" · "}Expected units: {count}</p>
          <ul className="mt-3 list-disc pl-6 text-sm">
            {expected.map(c=><li key={c.id}>{c.quantity} × {c.description??c.assetId??"Unspecified item"}</li>)}
          </ul>
          {eligible ? <form action={verifyReceivedPackage} className="mt-5 space-y-3">
            <input type="hidden" name="receiptId" value={r.id}/>
            <label className="block text-sm">Physically inspected unit count
              <input className="mt-1 block w-full rounded border p-2" name="verifiedUnitCount"
                required type="number" min="1" max="1000000" step="1" defaultValue={count}/>
            </label>
            <label className="block text-sm">Inspection / identification notes
              <textarea className="mt-1 block w-full rounded border p-2" name="evidenceNotes"
                minLength={15} maxLength={2000} required
                placeholder="Describe identifiers checked and what you physically inspected."/>
            </label>
            <button type="submit" className="rounded border px-4 py-2 font-medium">
              Certify exact-match receipt
            </button>
          </form> :
            <p className="mt-3 text-sm font-medium">Hold for exception review: receipt condition, seal, or expected inventory is not eligible.</p>}
          <Link className="mt-4 inline-block text-sm underline" href={`/service-requests/${r.package.shipment.serviceRequestId}`}>Open service request</Link>
        </section>;
      })}
    </div>
  </main>;
}
