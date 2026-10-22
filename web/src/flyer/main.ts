// The neighbor flyer page (M5.2): web/flyer/index.html loads this script.
import '../app.css';
import { mount } from 'svelte';
import FlyerPage from './FlyerPage.svelte';

mount(FlyerPage, { target: document.getElementById('app')! });
