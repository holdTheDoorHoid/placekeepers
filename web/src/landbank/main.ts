// "The Land Bank in numbers" (M4.4): web/land-bank/index.html loads this script. The language
// comes first (src/i18n/boot.ts), then the page.
import '../app.css';
import { startLanguage } from '../i18n/boot.ts';

await startLanguage();
const [{ mount }, { default: LandBankPage }] = await Promise.all([import('svelte'), import('./LandBankPage.svelte')]);
mount(LandBankPage, { target: document.getElementById('app')! });
