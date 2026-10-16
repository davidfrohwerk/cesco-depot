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
