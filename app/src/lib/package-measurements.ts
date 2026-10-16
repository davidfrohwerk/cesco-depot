export type MeasurementUnit = 'METRIC' | 'US';
export type MeasurementStatus = 'SIMULATED' | 'CUSTOMER_DECLARED' | 'CESCO_VERIFIED' | 'LEGACY_UNVERIFIED';
export const toDisplayLength = (cm: number, unit: MeasurementUnit) => unit === 'US' ? cm / 2.54 : cm;
export const toDisplayWeight = (kg: number, unit: MeasurementUnit) => unit === 'US' ? kg / 0.45359237 : kg;
export const toCanonicalLength = (value: number, unit: MeasurementUnit) => unit === 'US' ? value * 2.54 : value;
export const toCanonicalWeight = (value: number, unit: MeasurementUnit) => unit === 'US' ? value * 0.45359237 : value;
export function rounded(value: number): string { return Number(value.toFixed(4)).toString(); }
