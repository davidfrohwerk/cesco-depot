import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationPermission } from "@/lib/access-scope";
import {
  evidenceAbsolutePath,
  safeDownloadFilename,
} from "@/lib/evidence-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const { id } = await context.params;

  const evidence = await prisma.evidence.findUnique({
    where: { id },
    select: {
      organizationId: true,
      originalFilename: true,
      mimeType: true,
      storageKey: true,
      sha256: true,
    },
  });

  if (!evidence || !evidence.storageKey) {
    notFound();
  }

  await requireOrganizationPermission(
    "evidence.view",
    evidence.organizationId
  );

  let bytes: Buffer;

  try {
    bytes = await readFile(
      evidenceAbsolutePath(evidence.storageKey)
    );
  } catch {
    notFound();
  }

  const filename = safeDownloadFilename(
    evidence.originalFilename
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        evidence.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Evidence-SHA256": evidence.sha256 ?? "",
    },
  });
}
