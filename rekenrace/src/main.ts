import { RACE } from './config.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) app.textContent = `Blue Dog Rekenrace — ${RACE.distance} baan-eenheden`;
