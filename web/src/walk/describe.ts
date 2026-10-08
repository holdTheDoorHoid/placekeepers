// What the map says about a street on the traffic stress layer (M3.3, `stress` in
// tiles/cycling.pmtiles, docs/CONTRACTS.md section 4), in plain sentences.

import { strings } from '../strings.ts';

export interface StressView {
  level: number;
  title: string;
  meaning: string;
  facts: string[];
}

function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

/** A street's level, what it means, and the facts behind it; null without a level from 1 to 4. */
export function describeStress(properties: Record<string, unknown>): StressView | null {
  const w = strings.walk;
  const level = whole(properties.l);
  if (level === null || level < 1 || level > 4) return null;
  const facts: string[] = [];
  const calmer = whole(properties.l2);
  if (calmer !== null && calmer >= 1 && calmer < level) facts.push(w.stressOtherWay(calmer));
  const facility = whole(properties.bf) ?? 0;
  facts.push(`${w.facilities[facility] ?? w.facilities[0]!}.`);
  const speed = whole(properties.sp);
  if (speed !== null && speed > 0) facts.push(w.stressSpeed(speed));
  const lanes = whole(properties.ln);
  if (lanes !== null && lanes > 0) facts.push(w.stressLanes(lanes));
  return { level, title: w.stressTitle(level), meaning: w.stressMeaning[level]!, facts };
}
