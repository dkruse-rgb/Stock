import React from 'react';
import { createRoot } from 'react-dom/client';
import TradeTrainerReplay from './TradeTrainerReplay.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TradeTrainerReplay />
  </React.StrictMode>,
);
