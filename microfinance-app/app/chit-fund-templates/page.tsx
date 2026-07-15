// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { chitFundTemplateAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/formatUtils';

export default function ChitFundTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await chitFundTemplateAPI.getAll();
      setTemplates(data.templates || []);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleArchive = async (id, name) => {
    if (!confirm(`Archive template "${name}"? Existing chit funds are not affected.`)) return;
    try {
      await chitFundTemplateAPI.delete(id); // soft-archive by default
      await load();
    } catch (e) {
      alert(e?.message || 'Failed to archive template');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Chit Fund Templates</h1>
        <div className="flex gap-3">
          <Link href="/chit-funds" className="btn-neutral px-4 py-2 rounded-lg transition duration-300">
            Chit Funds
          </Link>
          <Link href="/chit-fund-templates/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            New Template
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : templates.length === 0 ? (
        <div className="themed-card p-8 text-center">
          <p className="text-gray-700 dark:text-theme-secondary mb-4">No templates yet.</p>
          <Link href="/chit-fund-templates/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Create your first template
          </Link>
        </div>
      ) : (
        <div className="themed-card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-surface-border">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">Members</th>
                <th className="px-4 py-3 text-right">Used by</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-surface-border">
              {templates.map((t) => (
                <tr key={t.id} className="text-sm">
                  <td className="px-4 py-3">
                    <Link href={`/chit-fund-templates/${t.id}`} className="text-blue-600 hover:underline font-medium">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${t.chitFundType === 'Fixed' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                      {t.chitFundType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(t.totalAmount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.duration} mo</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.membersCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t._count?.chitFunds ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link href={`/chit-funds/new?template=${t.id}`} className="text-green-600 hover:underline">Create fund</Link>
                      <Link href={`/chit-fund-templates/${t.id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
                      <button onClick={() => handleArchive(t.id, t.name)} className="text-red-600 hover:underline">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
