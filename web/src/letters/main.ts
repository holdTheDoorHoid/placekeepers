// The letters page (M5.1): web/letters/index.html loads this script.
import '../app.css';
import { mount } from 'svelte';
import LettersPage from './LettersPage.svelte';

mount(LettersPage, { target: document.getElementById('app')! });
