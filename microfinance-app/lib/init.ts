// Application initialization file
// This file is responsible for starting background services and schedulers

import { startAllSchedulers } from './scheduler';
import { checkAndSendMissedEmails } from './emailRecovery';

let isInitialized = false;

export function initializeApp() {
  if (isInitialized) {
    return;
  }

  console.log('Initializing microfinance application...');

  try {
    // Start all email schedulers (monthly and weekly)
    startAllSchedulers();

    // Check for missed emails and send recovery emails if needed
    // Add a small delay to ensure schedulers are started first
    setTimeout(async () => {
      try {
        console.log('Checking for missed scheduled emails...');
        await checkAndSendMissedEmails();
      } catch (error) {
        console.error('Error checking for missed emails:', error);
      }
    }, 5000); // 5 second delay

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
