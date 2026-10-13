import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeDisplayPreferences } from './platform/useDisplayPreferences.js';
const stopDisplayPreferences = initializeDisplayPreferences(window);
if (import.meta.hot) import.meta.hot.dispose(stopDisplayPreferences);
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
