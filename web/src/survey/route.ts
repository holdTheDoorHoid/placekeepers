// What the map says about a SEPTA route someone tapped (M2.4): its name, the kind of vehicle,
// how often it comes at midday on weekdays, and for a bus or trolley route a link to its survey
// sheet. Built from the `routes` tile properties of docs/CONTRACTS.md section 4.

import { stopKind, waitWords } from '../transit/describe.ts';
import { strings } from '../strings.ts';

const MIDDAY_MINUTES = 240;

export interface RouteView {
  id: string;
  title: string;
  name: string | null;
  kind: string;
  often: string | null;
  /** the survey page for this route, under the site root; only for buses and trolleys */
  survey: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : typeof value === 'number' ? String(value) : null;
}

export function describeRoute(properties: Record<string, unknown>): RouteView | null {
  const id = text(properties.id);
  if (!id) return null;
  const t = strings.transit;
  const kind = stopKind(properties.md);
  const short = text(properties.r) ?? id;
  const minutes = Number(properties.hm);
  const kinds: Record<string, string> = {
    bus: t.routeBus,
    busTrolley: t.routeBus,
    trolley: t.routeTrolley,
    metro: t.routeMetro,
    rail: t.routeRail,
  };
  return {
    id,
    title: strings.survey.routeTitle(short),
    name: text(properties.nm),
    kind: kinds[kind] ?? t.routeBus,
    often: Number.isFinite(minutes) && minutes > 0 ? t.midday(t.days.wk!, waitWords(kind, minutes, MIDDAY_MINUTES)) : null,
    survey: kind === 'metro' || kind === 'rail' ? null : `survey/?route=${encodeURIComponent(id)}`,
  };
}

/** One view per route, in the order tapped: routes sharing a street are listed once each. */
export function describeRoutes(features: Record<string, unknown>[]): RouteView[] {
  const seen = new Set<string>();
  const views: RouteView[] = [];
  for (const properties of features) {
    const view = describeRoute(properties);
    if (!view || seen.has(view.id)) continue;
    seen.add(view.id);
    views.push(view);
  }
  return views;
}
