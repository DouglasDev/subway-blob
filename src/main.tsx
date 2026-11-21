import { createRoot } from 'react-dom/client';
import { App } from './App';
import { arcadeMode } from './arcade';
import './global.css';

document.documentElement.dataset.arcade = String(arcadeMode);

const root = document.getElementById('app');

if (!root) throw new Error('Missing app root');
createRoot(root).render(<App />);
