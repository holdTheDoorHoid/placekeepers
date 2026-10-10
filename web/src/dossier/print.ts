// The printed lot page: one sheet per lot with the summary, what you can do, who owns it, recent
// history and sources, ending with "not legal advice". It keeps the most important lines only,
// so it fits one page; the full page is online.

import { displacementCaution } from '../config/suggestions.ts';
import { formatDate, strings } from '../strings.ts';
import type { DossierView } from './build.ts';

export const PRINT_LIMITS = { suggestions: 3, steps: 3, flags: 6, events: 10, li: 4, sources: 6, reasons: 5 } as const;

export interface PrintModel {
  title: string;
  opa: string;
  printed: string;
  summary: { kind: string; confidence: string | null; reasons: string[]; cityCalls: string | null; care: string[]; flood: string | null };
  /** Listed as available by the City's land agencies (issue #36): its lines, in order, or null. */
  listing: { title: string; lines: string[] } | null;
  actions: { label: string; route: string | null; warning: string | null; steps: string[]; cost: string; caution: string | null }[];
  /**
   * In a displacement watch area with a greening or placemaking suggestion or the box of a listed
   * lot (M4.1): the area's signs and each protection with its address, printed once at the top of
   * "What you can do" (decided by the owner on 2026-10-08), so the sheet carries what the cards
   * point to.
   */
  watch: { text: string; links: string[] } | null;
  /** Said after each caution when `watch` is printed: where to find the signs and protections. */
  watchPointer: string | null;
  /**
   * Rules for this lot (M4.6): a hearing still to come, the historic designation with "ask them
   * first", the base zoning and the overlays by name, and the brownfield sentence. Who filed an
   * appeal is on the lot page online, not on the sheet.
   */
  rules: string[];
  owner: {
    names: string[];
    mailing: string | null;
    type: string;
    /** What the City's list of public property says, in a sentence. */
    cityOwned: string | null;
    /** Each flag's title and what it means; the possible estate flag in full, as docs/ETHICS.md words it. */
    flags: { title: string; text: string }[];
    /** Why the notes about an owner who may be a person are held back, when they are. */
    held: string | null;
    tax: string;
    deedFraud: string | null;
  };
  history: {
    /** The story of the lot, each sentence with where it comes from. */
    story: string[];
    /** The timeline's 10 newest records the reader has not switched off (issue #38). */
    events: { date: string; kind: string; text: string }[];
    moreEvents: number;
    /** Said when the timeline's records from the weekly copy were not loaded or not held. */
    timelineNote: string | null;
    assessment: string | null;
    li: string[];
    notInCopy: string | null;
  };
  sources: string[];
  moreSources: string | null;
  notLegalAdvice: string;
}

function listingLines(listing: DossierView['actions']['listing'], watchPointer: string | null): PrintModel['listing'] {
  if (!listing) return null;
  const sideYard = listing.sideYard ? `${listing.sideYardLead} ${listing.sideYard.route.label}.` : null;
  const links = listing.links.map((link) => `${link.label}: ${link.url}`);
  return {
    title: listing.title,
    lines: [
      listing.text,
      listing.displacement.caution,
      // The area's signs are printed once, above the box (`watch`).
      listing.displacement.watch ? watchPointer : null,
      sideYard,
      `${listing.decline} ${listing.changes}`,
      ...links,
      listing.credit,
    ].filter(
      (line): line is string => !!line,
    ),
  };
}

function rulesLines(view: DossierView): string[] {
  const r = view.rules;
  const lines: string[] = [];
  if (r.hearing) lines.push(r.hearing.text);
  if (r.historic) lines.push(...r.historic.lines, r.historic.askFirst, r.historic.contact);
  if (r.zoning?.base) lines.push(r.zoning.base);
  if (r.zoning?.overlays.length) lines.push(`${r.zoning.overlaysIntro} ${r.zoning.overlays.map((o) => o.name).join('; ')}.`);
  if (r.brownfield) lines.push(r.brownfield.text);
  if (r.notOnList) lines.push(r.notOnList);
  return lines;
}

export function printModel(view: DossierView, now: Date = new Date()): PrintModel {
  const reasons = view.summary.reasons ? view.summary.reasons.agree : [];
  const timeline = view.history.timeline;
  const tl = strings.dossier.history.timeline;
  const latest = view.history.assessments?.find((a) => a.marketValue !== null) ?? null;
  const flags = view.owner.flags.slice(0, PRINT_LIMITS.flags).map((f) => ({
    title: f.title,
    // The possible estate flag is never shortened: its protective parts are the point of it.
    text: f.id === 'possible_estate' ? [f.text, f.careful, f.nextStep].filter(Boolean).join(' ') : f.text,
  }));
  // With a greening or placemaking suggestion or the box of a listed lot, all of which carry a
  // caution.
  const printed = view.actions.suggestions.slice(0, PRINT_LIMITS.suggestions);
  const watch =
    view.actions.watch && (view.actions.listing || printed.some((item) => displacementCaution(item.suggestion.id) !== null))
      ? { text: view.actions.watch.text, links: view.actions.watch.links.map((link) => `${link.label}: ${link.url}`) }
      : null;
  const watchPointer = watch ? strings.displacement.printSeeAbove : null;
  const taxCenter = strings.dossier.print.taxCenter(view.owner.tax.link.url);
  const tax = view.owner.tax.flag
    ? `${view.owner.tax.flag.title}: ${view.owner.tax.flag.text} ${taxCenter}`
    : `${view.owner.tax.text ?? ''} ${taxCenter}`.trim();
  return {
    title: view.title,
    opa: view.opa,
    printed: strings.dossier.print.printed(formatDate(now.toISOString()) ?? ''),
    summary: {
      kind: view.summary.kindLabel,
      confidence: view.summary.confidence,
      reasons: reasons.slice(0, PRINT_LIMITS.reasons),
      cityCalls: view.summary.cityCalls,
      care: view.summary.care,
      flood: view.summary.flood,
    },
    listing: listingLines(view.actions.listing, watchPointer),
    actions: printed.map((item) => {
      const route = item.routes[0] ?? null;
      return {
        label: item.suggestion.label,
        route: route ? route.route.label : null,
        warning: route?.warning ?? null,
        steps: route ? route.route.steps.slice(0, PRINT_LIMITS.steps) : [],
        cost: item.suggestion.cost,
        caution: displacementCaution(item.suggestion.id),
      };
    }),
    watch,
    watchPointer,
    rules: rulesLines(view),
    owner: {
      names: view.owner.names,
      mailing: view.owner.mailing,
      type: view.owner.typeLabel,
      cityOwned: view.owner.cityOwned,
      flags,
      held: view.owner.held,
      tax,
      deedFraud: view.owner.deedFraud?.text ?? null,
    },
    history: {
      story: timeline.story.map((line) => `${line.text} ${tl.storySource(line.source)}`),
      events: timeline.newest.slice(0, PRINT_LIMITS.events),
      moreEvents: Math.max(0, timeline.shown - PRINT_LIMITS.events),
      timelineNote: timeline.status !== 'ready' ? tl.printWaiting : (timeline.notes[0]?.text ?? null),
      assessment: latest ? strings.dossier.print.lastAssessment(latest.year, latest.value) : null,
      li: (view.history.li.summary ?? []).slice(0, PRINT_LIMITS.li),
      notInCopy: view.history.notInCopy?.text ?? null,
    },
    sources: view.sources.rows.slice(0, PRINT_LIMITS.sources).map((r) => `${r.name}: ${r.when}`),
    moreSources:
      view.sources.rows.length > PRINT_LIMITS.sources ? strings.dossier.print.moreSources(view.sources.rows.length - PRINT_LIMITS.sources) : null,
    notLegalAdvice: strings.app.notAffiliated,
  };
}
