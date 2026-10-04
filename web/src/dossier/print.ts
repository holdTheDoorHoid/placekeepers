// The printed lot page: one sheet per lot with the summary, what you can do, who owns it, recent
// history and sources, ending with "not legal advice". It keeps the most important lines only,
// so it fits one page; the full page is online.

import { formatDate, strings } from '../strings.ts';
import type { DossierView, TransferRow } from './build.ts';

export const PRINT_LIMITS = { suggestions: 3, steps: 3, flags: 6, transfers: 5, li: 4, sources: 8, reasons: 5 } as const;

export interface PrintModel {
  title: string;
  opa: string;
  printed: string;
  summary: { kind: string; confidence: string | null; reasons: string[]; cityCalls: string | null; care: string[] };
  actions: { label: string; route: string | null; warning: string | null; steps: string[]; cost: string }[];
  owner: {
    names: string[];
    mailing: string | null;
    type: string;
    flags: { title: string; text: string }[];
    tax: string;
    deedFraud: string | null;
  };
  history: { transfers: TransferRow[]; moreTransfers: number; assessment: string | null; li: string[] };
  sources: string[];
  notLegalAdvice: string;
}

export function printModel(view: DossierView, now: Date = new Date()): PrintModel {
  const reasons = view.summary.reasons ? view.summary.reasons.agree : [];
  const transfers = view.history.transfers ?? [];
  const latest = view.history.assessments?.find((a) => a.marketValue !== null) ?? null;
  const flags = view.owner.flags.slice(0, PRINT_LIMITS.flags).map((f) => ({ title: f.title, text: f.text }));
  const tax = view.owner.tax.flag ? `${view.owner.tax.flag.title}: ${view.owner.tax.flag.text}` : `${view.owner.tax.text ?? ''} ${view.owner.tax.link.label}: ${view.owner.tax.link.url}`.trim();
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
    },
    actions: view.actions.suggestions.slice(0, PRINT_LIMITS.suggestions).map((item) => {
      const route = item.routes[0] ?? null;
      return {
        label: item.suggestion.label,
        route: route ? route.route.label : null,
        warning: route?.warning ?? null,
        steps: route ? route.route.steps.slice(0, PRINT_LIMITS.steps) : [],
        cost: item.suggestion.cost,
      };
    }),
    owner: {
      names: view.owner.names,
      mailing: view.owner.mailing,
      type: view.owner.typeLabel,
      flags,
      tax,
      deedFraud: view.owner.deedFraud?.text ?? null,
    },
    history: {
      transfers: transfers.slice(0, PRINT_LIMITS.transfers),
      moreTransfers: Math.max(0, transfers.length - PRINT_LIMITS.transfers),
      assessment: latest ? strings.dossier.print.lastAssessment(latest.year, latest.value) : null,
      li: (view.history.li.summary ?? []).slice(0, PRINT_LIMITS.li),
    },
    sources: view.sources.rows.slice(0, PRINT_LIMITS.sources).map((r) => `${r.name}: ${r.when}`),
    notLegalAdvice: strings.app.notAffiliated,
  };
}
