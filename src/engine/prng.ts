/**
 * Mulberry32 確定性偽隨機數產生器，確保相同 Seed 在不同裝置上產生一致波次。
 */
export interface PRNG {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: ReadonlyArray<T>): T;
}

export function createPRNG(seed: number): PRNG {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, maxInclusive: number) =>
      Math.floor(min + next() * (maxInclusive - min + 1)),
    pick: <T>(items: ReadonlyArray<T>): T => {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty array');
      }
      return items[Math.floor(next() * items.length)];
    }
  };
}
