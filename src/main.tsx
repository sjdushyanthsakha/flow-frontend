import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import App from './App';
import { initializeTheme } from './theme';
import './styles/index.css';
import './styles/dark.css';
import './styles/operations.css';

initializeTheme();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider><App /></AuthProvider>
  </React.StrictMode>,
);
