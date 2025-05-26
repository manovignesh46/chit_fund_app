// Application initialization file
// This file is responsible for starting background services and schedulers

import { startAllSchedulers } from './scheduler';

let isInitialized = false;

export function initializeApp() {
  if (isInitialized) {
    return;
  }

  console.log('Initializing microfinance application...');

  try {
    // Start all email schedulers (monthly and weekly)
    startAllSchedulers();

    isInitialized = true;
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

// Auto-initialize when this module is imported
if (typeof window === 'undefined') {
  // Only run on server side
  initializeApp();
}
