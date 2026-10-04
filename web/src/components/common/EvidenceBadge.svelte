<script lang="ts">
  // An evidence badge from docs/EVIDENCE.md. The words carry the meaning, never color alone.
  import type { Evidence } from '../../registry/types.ts';
  import { strings } from '../../strings.ts';

  let { level }: { level: Evidence } = $props();
  const badge = $derived(strings.evidence[level]);
</script>

<span class="badge badge-{level}" title={badge.meaning}>{badge.label}</span>

<style>
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    vertical-align: middle;
  }
  .badge-strong {
    background: #e4f1e7;
    color: #1c4d2b;
  }
  .badge-moderate {
    background: #e3edf5;
    color: #1d4a6b;
  }
  .badge-mixed {
    background: #fbf0dc;
    color: #634410;
  }
  .badge-weak {
    background: #f0ebf6;
    color: #4a3363;
  }
  .badge-not_violence {
    background: #eeeeee;
    color: #3b3b3b;
  }
  .badge-context {
    background: #ecebe6;
    color: #44423b;
  }
</style>
