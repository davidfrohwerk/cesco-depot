export function sparePlan(population: number, afr: number, days: number, level: number, contingency: number) {
    if (!Number.isInteger(population) || population < 1 || !Number.isFinite(afr) || afr < 0 || afr > 1 || !Number.isFinite(days) || days <= 0 || !Number.isFinite(level) || level <= 0 || level >= 1 || !Number.isInteger(contingency) || contingency < 0)
        throw Error('Invalid planning assumptions.');
    const demand = population * afr * days / 365;
    let quantile = 0, method = 'Poisson quantile';
    if (demand <= 500) {
        let mass = Math.exp(-demand), cdf = mass;
        while (cdf < level && quantile < 10000) {
            quantile++;
            mass *= demand / quantile;
            cdf += mass;
        }
    }
    else {
        method = 'Normal approximation to Poisson (large demand)';
        let lo = -8, hi = 8;
        for (let i = 0; i < 60; i++) {
            const z = (lo + hi) / 2;
            const t = 1 / (1 + .2316419 * Math.abs(z));
            const pdf = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
            const tail = pdf * t * (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
            const cdf = z < 0 ? tail : 1 - tail;
            if (cdf < level)
                lo = z;
            else
                hi = z;
        }
        quantile = Math.max(0, Math.ceil(demand + hi * Math.sqrt(demand)));
    }
    return { demand, ordinaryReserve: quantile, contingency, total: quantile + contingency, method };
}
