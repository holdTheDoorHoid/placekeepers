// The Data status page. The language comes first (src/i18n/boot.ts), so source names and every
// word on the page are in it before the page is imported.
import '../app.css';
import registry from 'virtual:placekeepers/registry';
import { startLanguage } from '../i18n/boot.ts';

const { code } = await startLanguage({ registry });
// The browser tab in the page's language (index.html has it in English).
if (code !== 'en') {
  const [{ strings }, { plainText }] = await Promise.all([import('../strings.ts'), import('../i18n/marks.ts')]);
  document.title = plainText(`${strings.status.pageTitle}, ${strings.app.name}`);
}
const [{ mount }, { default: StatusPage }] = await Promise.all([import('svelte'), import('./StatusPage.svelte')]);
mount(StatusPage, { target: document.getElementById('app')!, props: { registry } });
