// What the map says about a SEPTA stop someone opened: plain sentences built from the tile
// properties of docs/CONTRACTS.md section 4 (`stops` in tiles/transit.pmtiles). Kept apart from
// the component so the wording can be tested. A stop without a SEPTA count says so; nothing is
// ever estimated.

import { strings } from '../strings.ts';

const MODE_BUS = 1;
const MODE_TROLLEY = 2;
const MODE_METRO = 4;
const MODE_RAIL = 8;
const PEAK_MINUTES = 120;
const MIDDAY_MINUTES = 240;

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export type StopKind = 'bus' | 'trolley' | 'busTrolley' | 'metro' | 'rail';

/** What kind of stop the mode bits `md` describe: a stop buses or trolleys use is a stop. */
export function stopKind(md: unknown): StopKind {
  const bits = int(md) ?? 0;
  const bus = (bits & MODE_BUS) !== 0;
  const trolley = (bits & MODE_TROLLEY) !== 0;
  if (bus && trolley) return 'busTrolley';
  if (bus) return 'bus';
  if (trolley) return 'trolley';
  if (bits & MODE_METRO) return 'metro';
  if (bits & MODE_RAIL) return 'rail';
  return 'bus';
}

function vehicleKey(kind: StopKind): string {
  return kind === 'metro' || kind === 'rail' ? 'train' : kind;
}

/** A time of SEPTA's service day, which runs past midnight: 410 is "6:50 AM", 1530 "1:30 AM". */
export function clock(minutes: number): string {
  const day = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(day / 60);
  const mins = day % 60;
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${String(mins).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "a bus about every 12 minutes", or "only 2 buses" when so few come that an average misleads. */
export function waitWords(kind: StopKind, minutes: number, window: number): string {
  const t = strings.transit;
  const key = vehicleKey(kind);
  const departures = Math.round(window / minutes);
  if (departures <= 3) return t.only(t.vehicles[key]!, t.vehiclesMany[key]!, Math.max(1, departures));
  return t.every(t.vehicles[key]!, minutes);
}

export interface StopView {
  title: string;
  kind: string;
  routes: string | null;
  often: string[];
  riders: string[];
  details: string[];
}

export function describeStop(properties: Record<string, unknown>): StopView {
  const t = strings.transit;
  const kind = stopKind(properties.md);
  const name = text(properties.nm) ?? t.detailsTitle;
  const station = kind === 'metro' || kind === 'rail';
  // "Erie" is "Erie station"; "15th St/City Hall, B1" and "Gray 30th St Station" stay as written.
  const routeList = (text(properties.r) ?? '').split(',').filter(Boolean);

  const often: string[] = [];
  const weekday = int(properties.tw) ?? 0;
  if (weekday === 0) often.push(t.noWeekday);
  const peak = int(properties.hp);
  if (peak) often.push(t.peak(waitWords(kind, peak, PEAK_MINUTES)));
  for (const [day, key] of [
    ['wk', 'hm'],
    ['sa', 'hs'],
    ['su', 'hu'],
  ] as const) {
    const minutes = int(properties[key]);
    const label = t.days[day]!;
    often.push(minutes ? t.midday(label, waitWords(kind, minutes, MIDDAY_MINUTES)) : t.noService(label));
  }
  often.push(t.trips(weekday, int(properties.ts) ?? 0, int(properties.tu) ?? 0));
  const busiest = int(properties.bh);
  if (busiest && weekday) often.push(t.busiest(busiest));
  const first = int(properties.ft);
  const last = int(properties.lt);
  if (int(properties.nt)) often.push(t.allNight);
  else if (weekday && first !== null && last !== null) {
    often.push(t.firstLast(clock(first), last >= 1440 ? t.afterMidnight(clock(last)) : clock(last)));
  }
  const evening = int(properties.ev);
  if (weekday && evening !== null && !int(properties.nt)) often.push(t.evening(evening));

  const riders: string[] = [];
  const boardings = int(properties.b);
  if (boardings !== null) {
    riders.push(t.boardings(boardings, text(properties.bp) ?? ''));
    const at = text(properties.bx);
    if (at) riders.push(t.countedAt(at));
  } else {
    riders.push(station ? t.noStationCounts : t.noBoardings);
  }

  const details: string[] = [];
  const sid = text(properties.sid);
  if (sid) details.push(t.stopNumber(sid));
  const former = text(properties.fid);
  if (former) details.push(t.formerNumbers(former.split(',').join(', ')));
  const wc = int(properties.wc);
  if (wc !== null && t.wheelchair[wc]) details.push(t.wheelchair[wc]!);

  return {
    title: kind === 'metro' && !/station|center|loop|terminal|,/i.test(name) ? t.stationName(name) : name,
    kind: t.kinds[kind],
    routes: routeList.length === 0 ? null : routeList.length === 1 ? t.route(routeList[0]!) : t.routes(routeList.join(', ')),
    often,
    riders,
    details,
  };
}
