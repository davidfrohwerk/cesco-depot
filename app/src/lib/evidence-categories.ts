export const evidenceCategories = ['OTHER', 'SERIAL_PHOTO', 'PACKAGE_BEFORE', 'PACKAGE_AFTER', 'EQUIPMENT_CONDITION', 'RECEIPT', 'TEST_RESULT', 'DISPATCH', 'INSTALLATION_BEFORE', 'INSTALLATION_AFTER'] as const;
export type EvidenceCategory = typeof evidenceCategories[number];
export const photoEvidenceCategories: readonly string[] = ['SERIAL_PHOTO', 'PACKAGE_BEFORE', 'PACKAGE_AFTER', 'EQUIPMENT_CONDITION', 'INSTALLATION_BEFORE', 'INSTALLATION_AFTER'];
export function validateEvidenceCategory(category: string, mime: string) {
    if (!(evidenceCategories as readonly string[]).includes(category)) throw Error('Choose a supported evidence category.');
    if (photoEvidenceCategories.includes(category) && !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mime))
        throw Error('Photographic evidence must be JPG, PNG, WebP or HEIC.');
    return category as EvidenceCategory;
}
