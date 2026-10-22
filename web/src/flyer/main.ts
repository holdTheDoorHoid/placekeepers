// The neighbor flyer page (M5.2): web/flyer/index.html loads this script. The language comes
// first (src/i18n/boot.ts), then the page.
import '../app.css';
import { startLanguage } from '../i18n/boot.ts';

await startLanguage();
const [{ mount }, { default: FlyerPage }] = await Promise.all([import('svelte'), import('./FlyerPage.svelte')]);
mount(FlyerPage, { target: document.getElementById('app')! });
