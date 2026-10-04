<script lang="ts">
  // The site menu: a link to the map and to every content page, plus the Data status page.
  // Used from the map's header and from every content page, so it is the one place that lists
  // them (see strings.nav.pages).
  import { config } from '../../config/index.ts';
  import { strings } from '../../strings.ts';

  let { current }: { current?: string } = $props();
</script>

<nav aria-label={strings.nav.menuLabel}>
  <ul>
    <li><a href={config.siteBase} aria-current={current === 'map' ? 'page' : undefined}>{strings.nav.map}</a></li>
    {#each strings.nav.pages as page (page.slug)}
      <li>
        <a href="{config.siteBase}{page.slug}/" aria-current={current === page.slug ? 'page' : undefined}>{page.label}</a>
      </li>
    {/each}
    <li><a href="{config.siteBase}status/" aria-current={current === 'status' ? 'page' : undefined}>{strings.header.dataStatus}</a></li>
  </ul>
</nav>

<style>
  nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  nav a {
    display: block;
    padding: 10px 12px;
    border-radius: var(--pk-radius);
    font-weight: 600;
    text-decoration: none;
    color: var(--pk-text);
  }
  nav a:hover {
    background: var(--pk-surface);
  }
  nav a[aria-current='page'] {
    background: var(--pk-accent-soft);
    color: var(--pk-accent);
  }
</style>
