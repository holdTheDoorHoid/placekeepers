<script lang="ts">
  // The soil note (M4.6, issue #42): on a garden suggestion for a lot at or near a federal
  // brownfield record, the owner's sentence word for word, with a soil test and the EPA's guide to
  // gardening in city soil. Never "clean" or "safe".
  import { EPA_GARDEN_GUIDE_URL, SOIL_TEST_URL } from '../../config/links.ts';
  import { strings } from '../../strings.ts';

  const r = strings.dossier.rules;
</script>

<p class="soil-note small" data-testid="soil-note">
  {r.brownfield}
  <a href={SOIL_TEST_URL} target="_blank" rel="noopener noreferrer">{r.soilTest}</a>.
  <a href={EPA_GARDEN_GUIDE_URL} target="_blank" rel="noopener noreferrer">{r.gardenGuide}</a>.
</p>

<style>
  .soil-note {
    margin: 4px 0 8px;
    padding: 6px 10px;
    border-left: 3px solid var(--pk-stale-ink);
    border-radius: var(--pk-radius);
    background: var(--pk-stale-bg);
  }
</style>
