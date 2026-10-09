// "The Land Bank in numbers" (M4.4): web/land-bank/index.html loads this script.
import '../app.css';
import { mount } from 'svelte';
import LandBankPage from './LandBankPage.svelte';

mount(LandBankPage, { target: document.getElementById('app')! });
