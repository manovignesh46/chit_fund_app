// Test the fixed date calculation
const now = new Date();
console.log('Current date:', now.toISOString());

// Original calculation (problematic)
const lastMonthStart_old = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const lastMonthEnd_old = new Date(now.getFullYear(), now.getMonth(), 0);

console.log('\nOld calculation (with timezone issues):');
console.log('Start:', lastMonthStart_old.toISOString(), '(formatted:', lastMonthStart_old.toISOString().split('T')[0], ')');
console.log('End:', lastMonthEnd_old.toISOString(), '(formatted:', lastMonthEnd_old.toISOString().split('T')[0], ')');

// Fixed calculation (using UTC)
const lastMonthStart_new = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
const lastMonthEnd_new = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));

console.log('\nNew calculation (UTC, fixed):');
console.log('Start:', lastMonthStart_new.toISOString(), '(formatted:', lastMonthStart_new.toISOString().split('T')[0], ')');
console.log('End:', lastMonthEnd_new.toISOString(), '(formatted:', lastMonthEnd_new.toISOString().split('T')[0], ')');

// Check if June 30, 2025 would be included
const june30 = new Date('2025-06-30T00:00:00.000Z');
console.log('\nJune 30, 2025 transaction date:', june30.toISOString());

const isIncluded_old = june30 >= new Date(lastMonthStart_old.toISOString().split('T')[0]) && 
                      june30 <= new Date(lastMonthEnd_old.toISOString().split('T')[0] + 'T23:59:59.999Z');
console.log('Would be included with old calculation:', isIncluded_old);

const isIncluded_new = june30 >= new Date(lastMonthStart_new.toISOString().split('T')[0]) && 
                      june30 <= new Date(lastMonthEnd_new.toISOString().split('T')[0] + 'T23:59:59.999Z');
console.log('Would be included with new calculation:', isIncluded_new);
