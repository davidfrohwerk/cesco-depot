const importAliases: Record<string, string[]> = {
    externalId: ['endpoint id', 'site id', 'location id', 'store number', 'store id', 'code', 'external id', 'external asset id', 'asset id', 'device id', 'equipment id', 'asset tag'],
    name: ['endpoint name', 'site name', 'location name', 'store name', 'name'],
    siteType: ['site type', 'location type', 'type'],
    addressLine1: ['address line 1', 'street', 'street address', 'address'],
    addressLine2: ['address line 2', 'suite', 'unit'],
    city: ['city'],
    state: ['state', 'province'],
    postalCode: ['zip', 'zip code', 'postal code'],
    country: ['country'],
    market: ['market', 'region'],
    contactName: ['contact', 'contact name', 'site contact'],
    contactEmail: ['email', 'contact email'],
    contactPhone: ['phone', 'telephone', 'contact phone'],
    accessNotes: ['notes', 'access notes', 'delivery notes', 'service notes'],
    active: ['enabled', 'active'],
    manufacturer: ['manufacturer', 'make', 'vendor', 'oem', 'mfr'],
    model: ['model', 'product', 'product model', 'device model'],
    serial: ['serial', 'serial number', 'serial no', 'serial #'],
    configuration: ['configuration', 'configuration version', 'config', 'image', 'image version'],
    pool: ['compatibility pool', 'pool', 'compatibility class', 'compatibility'],
    purpose: ['purpose', 'role'],
    endpointId: ['endpoint id', 'endpoint external id', 'endpoint code', 'site id', 'location id', 'store number', 'store id'],
    customerAssetTag: ['asset tag', 'customer asset tag', 'client asset tag'],
    deviceType: ['device type', 'equipment type', 'asset class', 'category'],
    description: ['asset description', 'description', 'equipment description'],
    declaredStatus: ['status', 'asset status', 'equipment status'],
    declaredVerifiedAt: ['last verified', 'last readiness verified'],
    declaredNextVerificationAt: ['next verification', 'next readiness due'],
    declaredVerificationNotes: ['verification notes', 'readiness notes', 'test notes'],
    volume: ['volume', 'storage volume'],
    recoveryTargetHours: ['recovery target', 'recovery target hours', 'rto', 'rto hours'],
};

export function inferMapping(kind: string, headers: string[]) {
    const fields = kind === 'endpoints'
        ? ['externalId', 'name', 'siteType', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country', 'market', 'contactName', 'contactEmail', 'contactPhone', 'accessNotes', 'active']
        : ['externalId', 'manufacturer', 'model', 'serial', 'configuration', 'pool', 'purpose', 'endpointId', 'customerAssetTag', 'deviceType', 'description', 'declaredStatus', 'declaredVerifiedAt', 'declaredNextVerificationAt', 'declaredVerificationNotes', 'volume', 'recoveryTargetHours'];
    const canonical = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/[^a-z0-9# ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const normalized = new Map(headers.map(h => [canonical(h), h]));
    const mapping: Record<string, string> = {};
    for (const field of fields) {
        const aliases = field === 'externalId' && kind === 'equipment'
            ? ['device id', 'external asset id', 'asset id', 'equipment id', 'asset tag', 'external id']
            : (importAliases[field] || [field]);
        const match = aliases.map(x => normalized.get(canonical(x))).find(Boolean);
        if (match) mapping[field] = match;
    }
    return mapping;
}

