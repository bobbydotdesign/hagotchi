import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializeCapacitor, isNative } from './lib/capacitor'

// Initialize Capacitor before rendering
const startApp = async () => {
  if (isNative) {
    await initializeCapacitor();
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

startApp();

