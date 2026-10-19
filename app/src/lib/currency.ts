export function parseUsdCents(value: unknown): number {
    const raw = String(value ?? '').trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) {
        throw Error('Enter a nonnegative USD amount with up to two decimal places.');
    }
    const [whole, fraction = ''] = raw.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents)) throw Error('Amount exceeds supported range.');
    return cents;
}

/** Convert user-facing USD dollar fields into the integer-cent fields expected by the domain API. */
export function normalizeMoneyInputs(action: string, input: Record<string, unknown>): Record<string, unknown> {
    const fields: Record<string, Record<string, string>> = {
        rate: { priceDollars: 'cents' },
        editDraftRate: { priceDollars: 'cents' },
        prepareFulfillment: { shippingDollars: 'shippingCents' },
        quote: { ceilingDollars: 'ceiling' },
        amendQuote: { ceilingDollars: 'ceiling' },
        activity: { costDollars: 'costCents' },
        settle: { amountDollars: 'cents' },
        assessFailedUnit: { estimatedCostDollars: 'estimatedCostCents' },
        trainingRepairApprove: { maximumDollars: 'maxCents' },
        trainingRepairResult: { spentDollars: 'spentCents' }
    };
    const result = { ...input };
    for (const [usdKey, centsKey] of Object.entries(fields[action] || {})) {
        const amount = result[usdKey];
        result[centsKey] = action === 'assessFailedUnit' && (amount === undefined || amount === null || String(amount).trim() === '')
            ? null : parseUsdCents(amount);
        delete result[usdKey];
    }
    return result;
}
