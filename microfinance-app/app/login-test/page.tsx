'use client';

import React, { useState } from 'react';
import { authAPI } from '@/lib/api';

export default function LoginTest() {
  const [email, setEmail] = useState('amfincorp1@gmail.com');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugInfo = async () => {
    setDebugLoading(true);
    try {
      const response = await fetch('/api/debug');
      const data = await response.json();
      setDebugInfo(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch debug info');
    } finally {
      setDebugLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Login Test Page</h1>
      
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Test Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block mb-1">Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block mb-1">Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? 'Logging in...' : 'Test Login'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-4">
            <h3 className="font-semibold">Login Result:</h3>
            <pre className="p-3 bg-gray-100 rounded overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Environment Debug</h2>
        <button
          onClick={fetchDebugInfo}
          disabled={debugLoading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
        >
          {debugLoading ? 'Loading...' : 'Fetch Debug Info'}
        </button>

        {debugInfo && (
          <div className="mt-4">
            <h3 className="font-semibold">Debug Information:</h3>
            <pre className="p-3 bg-gray-100 rounded overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
