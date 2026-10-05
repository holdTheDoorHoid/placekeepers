import './app.css';
import { mount } from 'svelte';
import registry from 'virtual:placekeepers/registry';
import App from './App.svelte';
import { config } from './config/index.ts';
import { initialState } from './state/init.ts';
import { readOptions } from './state/options.ts';
import { TOUCH_QUERY } from './state/screen.ts';
import { PREFS_KEY, readItem } from './state/storage.ts';
import { AppStore } from './state/store.svelte.ts';

const initial = initialState(registry, {
  hash: window.location.hash,
  width: window.innerWidth,
  height: window.innerHeight,
  touch: window.matchMedia(TOUCH_QUERY).matches,
  saved: readItem(PREFS_KEY),
});
const store = new AppStore(registry, initial, { dataBase: config.dataBase, options: readOptions(registry) });
mount(App, { target: document.getElementById('app')!, props: { store } });
