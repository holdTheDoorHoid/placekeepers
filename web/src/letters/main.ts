// The letters page (M5.1): web/letters/index.html loads this script. The language comes first
// (src/i18n/boot.ts), then the page.
import '../app.css';
import { startLanguage } from '../i18n/boot.ts';

await startLanguage();
const [{ mount }, { default: LettersPage }] = await Promise.all([import('svelte'), import('./LettersPage.svelte')]);
mount(LettersPage, { target: document.getElementById('app')! });
