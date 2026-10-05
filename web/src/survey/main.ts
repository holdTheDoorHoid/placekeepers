// The "Survey a route" page (M2.4): web/survey/index.html loads this script.
import '../app.css';
import './survey.css';
import { mount } from 'svelte';
import SurveyPage from './SurveyPage.svelte';

mount(SurveyPage, { target: document.getElementById('app')! });
