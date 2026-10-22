// The packet page (M5.1): web/packet/index.html loads this script.
import '../app.css';
import './packet.css';
import { mount } from 'svelte';
import PacketPage from './PacketPage.svelte';

mount(PacketPage, { target: document.getElementById('app')! });
