export const rateUnitOptions = [
 {value:'each',label:'Per item / device'},
 {value:'fulfillment',label:'Per fulfillment order'},
 {value:'job',label:'Per job'},
 {value:'hour',label:'Per labor hour'},
 {value:'part',label:'Per replacement part'},
 {value:'shipment',label:'Per shipment'},
 {value:'cubic-foot-day',label:'Per cubic foot per day'},
 {value:'reserved-unit-month',label:'Per reserved unit per month'},
 {value:'unit-month',label:'Per unit per month'}
] as const;
export function normalizeRateUnit(input: string): string {
 const unit = input.trim().toLowerCase();
 const alias: Record<string,string> = {'item':'each','items':'each','per item':'each','per device':'each','per fulfillment':'fulfillment','cubic foot-day':'cubic-foot-day','cubic foot day':'cubic-foot-day','hours':'hour','per hour':'hour','each':'each'};
 const normalized = alias[unit] || unit;
 if (!rateUnitOptions.some(x => x.value === normalized)) throw Error('Choose a supported pricing unit.');
 return normalized;
}
