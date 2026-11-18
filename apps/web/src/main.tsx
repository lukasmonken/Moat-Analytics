import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import { App } from './app/App';
import './styles/index.css';
import './styles/features.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Elemento raiz do Moat Analytics ausente.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
