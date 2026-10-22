// "Did it work?" (M5.4): web/did-it-work/index.html loads this script. The language comes first
// (src/i18n/boot.ts), then the page.
import '../app.css';
import { startLanguage } from '../i18n/boot.ts';

await startLanguage();
const [{ mount }, { default: DidItPage }] = await Promise.all([import('svelte'), import('./DidItPage.svelte')]);
mount(DidItPage, { target: document.getElementById('app')! });
