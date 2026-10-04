import '../app.css';
import { mount } from 'svelte';
import registry from 'virtual:placekeepers/registry';
import StatusPage from './StatusPage.svelte';

mount(StatusPage, { target: document.getElementById('app')!, props: { registry } });
