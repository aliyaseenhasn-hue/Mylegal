import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerServiceWorker } from './lib/push';
import { watchForUpdates } from './lib/version';

registerServiceWorker();
if (import.meta.env.PROD) watchForUpdates();

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
