import path from "node:path";

export const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024;

export function evidenceStorageRoot() {
  return (
    process.env.EVIDENCE_STORAGE_ROOT ??
    path.resolve(process.cwd(), "../data/evidence")
  );
}

export function evidenceAbsolutePath(storageKey: string) {
  const root = evidenceStorageRoot();
  const absolute = path.resolve(root, storageKey);

  if (
    absolute !== root &&
    !absolute.startsWith(root + path.sep)
  ) {
    throw new Error("Invalid evidence storage key.");
  }

  return absolute;
}

export function safeDownloadFilename(filename: string | null) {
  const candidate = filename?.trim() || "evidence-file";
  return candidate.replace(/[\r\n"\\/]/g, "_");
}
