// The map page. The language comes first (src/i18n/boot.ts): its words are written into the
// strings and the registry before anything that reads them is imported.
import './app.css';
import registry from 'virtual:placekeepers/registry';
import { startLanguage } from './i18n/boot.ts';

await startLanguage({ registry });
const { mountMap } = await import('./mount.ts');
mountMap(registry);
