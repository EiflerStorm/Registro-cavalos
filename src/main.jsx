import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // MANTENHA ESTA LINHA E NENHUMA OUTRA IMPORTAÇÃO DE CSS AQUI

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);