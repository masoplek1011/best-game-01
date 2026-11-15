// Wave composition and difficulty: what spawns, in what order, on each wave.
// Early waves are chasers only; weavers join from wave 2, splitters from wave 3,
// and the mix, count, health and speed all grow with the wave number. The list is
// a timed queue: each entry spawns that many seconds after the wave begins.

import { KIND_CHASER, KIND_MITE, KIND_SPLITTER, KIND_WEAVER } from './enemies.js';

/** How many enemies a wave holds. */
export function waveSize(wave) {
  return 6 + wave * 3;
}

/** The share of each kind on a wave, as weights that sum loosely to 1. */
function kindWeights(wave) {
  const weights = [[KIND_CHASER, 1]];
  if (wave >= 2) weights.push([KIND_WEAVER, 0.18 + 0.03 * wave]);
  if (wave >= 3) weights.push([KIND_SPLITTER, 0.12 + 0.02 * wave]);
  return weights;
}

function pickKind(wave, random) {
  const weights = kindWeights(wave);
  let total = 0;
  for (const [, weight] of weights) total += weight;
  let roll = random() * total;
  for (const [kind, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return KIND_CHASER;
}

/** The spawn queue for `wave`: entries of { kind, at } seconds into the wave. */
export function buildWave(wave, random) {
  const queue = [];
  const count = waveSize(wave);
  let at = 0.4;
  for (let i = 0; i < count; i += 1) {
    queue.push({ kind: pickKind(wave, random), at });
    // Spawns tighten as waves rise, so late waves feel like a flood.
    at += Math.max(0.35, 1.05 - wave * 0.06) * (0.6 + random() * 0.8);
  }
  return queue;
}

/** A mite is never spawned by a wave; only a dying splitter makes one. */
export { KIND_MITE };
