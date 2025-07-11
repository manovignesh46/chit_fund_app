'use client';

import { useEffect, useState } from 'react';

export default function TestRemaining() {
  const [loanDetails, setLoanDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loanId, setLoanId] = useState(10); // Default loan ID to test

  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First, try the debug API
        const debugResponse = await fetch(`/api/debug-loan-api?id=${loanId}`);
        const debugData = await debugResponse.json();
        
        // Then, try the regular loan detail API
        const regularResponse = await fetch(`/api/loans/consolidated?action=detail&id=${loanId}`);
        const regularData = await regularResponse.json();
        
        setLoanDetails({
          debugApi: debugData,
          regularApi: regularData,
          comparison: {
            debugHasRemainingDue: debugData.hasRemainingDue,
            regularHasRemainingDue: 'remainingDue' in regularData,
            debugRemainingDueValue: debugData.remainingDueValue,
            regularRemainingDueValue: regularData.remainingDue,
          }
        });
      } catch (err) {
        console.error('Error fetching loan data:', err);
        setError('Failed to fetch loan data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLoanData();
  }, [loanId]);
  
  const handleIdChange = (e) => {
    setLoanId(parseInt(e.target.value) || 1);
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Remaining Due Field</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">Loan ID:</label>
        <input
          type="number"
          value={loanId}
          onChange={handleIdChange}
          className="mt-1 block w-full max-w-xs p-2 border rounded-md"
        />
        <button 
          onClick={() => setLoanId(loanId)} 
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Fetch Loan
        </button>
      </div>
      
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      
      {loanDetails && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Loan Data Comparison</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-100 p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2">Debug API</h3>
              <pre className="bg-white p-3 rounded-md overflow-auto max-h-96 text-sm">
                {JSON.stringify(loanDetails.debugApi, null, 2)}
              </pre>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2">Regular API</h3>
              <pre className="bg-white p-3 rounded-md overflow-auto max-h-96 text-sm">
                {JSON.stringify(loanDetails.regularApi, null, 2)}
              </pre>
            </div>
          </div>
          
          <div className="mt-6 bg-blue-50 p-4 rounded-md">
            <h3 className="text-lg font-medium mb-2">Comparison</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Debug API has remainingDue: <span className={loanDetails.comparison.debugHasRemainingDue ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{loanDetails.comparison.debugHasRemainingDue ? "Yes" : "No"}</span></li>
              <li>Regular API has remainingDue: <span className={loanDetails.comparison.regularHasRemainingDue ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{loanDetails.comparison.regularHasRemainingDue ? "Yes" : "No"}</span></li>
              <li>Debug API remainingDue value: <span className="font-semibold">{loanDetails.comparison.debugRemainingDueValue}</span></li>
              <li>Regular API remainingDue value: <span className="font-semibold">{loanDetails.comparison.regularRemainingDueValue}</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
