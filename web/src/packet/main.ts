// The packet page (M5.1): web/packet/index.html loads this script. The language comes first
// (src/i18n/boot.ts), with the registry's words, which the packet's routes and links use; then
// the page.
import '../app.css';
import './packet.css';
import registry from 'virtual:placekeepers/registry';
import { startLanguage } from '../i18n/boot.ts';

await startLanguage({ registry });
const [{ mount }, { default: PacketPage }] = await Promise.all([import('svelte'), import('./PacketPage.svelte')]);
mount(PacketPage, { target: document.getElementById('app')! });
