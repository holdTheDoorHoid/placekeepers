// The printed lot page: one sheet per lot with the summary, what you can do, who owns it, recent
// history and sources, ending with "not legal advice". It keeps the most important lines only,
// so it fits one page; the full page is online.

import { isGreening } from '../config/suggestions.ts';
import { formatDate, strings } from '../strings.ts';
import type { DossierView, TransferRow } from './build.ts';

export const PRINT_LIMITS = { suggestions: 3, steps: 3, flags: 6, transfers: 4, li: 4, sources: 6, reasons: 5 } as const;

export interface PrintModel {
  title: string;
  opa: string;
  printed: string;
  summary: { kind: string; confidence: string | null; reasons: string[]; cityCalls: string | null; care: string[]; flood: string | null };
  actions: { label: string; route: string | null; warning: string | null; steps: string[]; cost: string; caution: string | null }[];
  owner: {
    names: string[];
    mailing: string | null;
    type: string;
    /** Each flag's title and what it means; the possible estate flag in full, as docs/ETHICS.md words it. */
    flags: { title: string; text: string }[];
    /** Why the notes about an owner who may be a person are held back, when they are. */
    held: string | null;
    tax: string;
    deedFraud: string | null;
  };
  history: { transfers: TransferRow[]; moreTransfers: number; assessment: string | null; li: string[]; notInCopy: string | null };
  sources: string[];
  moreSources: string | null;
  notLegalAdvice: string;
}

export function printModel(view: DossierView, now: Date = new Date()): PrintModel {
  const reasons = view.summary.reasons ? view.summary.reasons.agree : [];
  const transfers = view.history.transfers ?? [];
  const latest = view.history.assessments?.find((a) => a.marketValue !== null) ?? null;
  const flags = view.owner.flags.slice(0, PRINT_LIMITS.flags).map((f) => ({
    title: f.title,
    // The possible estate flag is never shortened: its protective parts are the point of it.
    text: f.id === 'possible_estate' ? [f.text, f.careful, f.nextStep].filter(Boolean).join(' ') : f.text,
  }));
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
    actions: view.actions.suggestions.slice(0, PRINT_LIMITS.suggestions).map((item) => {
      const route = item.routes[0] ?? null;
      return {
        label: item.suggestion.label,
        route: route ? route.route.label : null,
        warning: route?.warning ?? null,
        steps: route ? route.route.steps.slice(0, PRINT_LIMITS.steps) : [],
        cost: item.suggestion.cost,
        caution: isGreening(item.suggestion.id) ? strings.displacement.caution : null,
      };
    }),
    owner: {
      names: view.owner.names,
      mailing: view.owner.mailing,
      type: view.owner.typeLabel,
      flags,
      held: view.owner.held,
      tax,
      deedFraud: view.owner.deedFraud?.text ?? null,
    },
    history: {
      transfers: transfers.slice(0, PRINT_LIMITS.transfers),
      moreTransfers: Math.max(0, transfers.length - PRINT_LIMITS.transfers),
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
