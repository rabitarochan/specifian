import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// tailwind.css pulls in the legacy index.css under a cascade layer (see that file).
import './styles/tailwind.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
