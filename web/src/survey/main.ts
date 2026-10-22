// The "Survey a route" page (M2.4): web/survey/index.html loads this script. The language comes
// first (src/i18n/boot.ts), then the page.
import '../app.css';
import './survey.css';
import { startLanguage } from '../i18n/boot.ts';

await startLanguage();
const [{ mount }, { default: SurveyPage }] = await Promise.all([import('svelte'), import('./SurveyPage.svelte')]);
mount(SurveyPage, { target: document.getElementById('app')! });
