import './app.css';
import { mount } from 'svelte';
import registry from 'virtual:placekeepers/registry';
import App from './App.svelte';
import { initialState } from './state/init.ts';
import { PREFS_KEY, readItem } from './state/storage.ts';
import { AppStore } from './state/store.svelte.ts';

const initial = initialState(registry, { hash: window.location.hash, width: window.innerWidth, saved: readItem(PREFS_KEY) });
const store = new AppStore(registry, initial);
mount(App, { target: document.getElementById('app')!, props: { store } });
