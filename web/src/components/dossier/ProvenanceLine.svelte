<script lang="ts">
  // One line saying where a part of the lot page came from: live from the City, the weekly
  // snapshot (with its date), still loading, or a lookup that failed. Words carry the meaning;
  // the small mark only repeats it.
  import type { Provenance } from '../../dossier/build.ts';

  let { provenance }: { provenance: Provenance } = $props();
</script>

<p class="provenance tone-{provenance.tone}"><span class="mark" aria-hidden="true"></span>{provenance.text}</p>

<style>
  .provenance {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 2px 0 8px;
    font-size: 0.8rem;
    color: var(--pk-muted);
  }
  .mark {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--pk-border);
    transform: translateY(-1px);
  }
  .tone-live .mark {
    background: var(--pk-ok-ink);
  }
  .tone-pending .mark {
    background: transparent;
    border: 2px solid var(--pk-accent);
  }
  .tone-warning {
    color: var(--pk-stale-ink);
  }
  .tone-warning .mark {
    background: var(--pk-stale-ink);
    border-radius: 1px;
  }
</style>
