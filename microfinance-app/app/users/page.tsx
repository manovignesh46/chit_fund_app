// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { authAPI } from '../../lib/api';

interface Partner {
  id: number;
  name: string;
}

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  partnerId?: number | null;
  dataOwnerId?: number | null;
  partner?: Partner | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    partnerId: '',
    role: 'partner',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const profile = await authAPI.getCurrentUser();
      setIsPrimaryAdmin(!!profile.isPrimaryAdmin);

      if (!profile.isPrimaryAdmin) {
        setError('Only the primary admin can manage user accounts.');
        return;
      }

      const [usersRes, partnersRes] = await Promise.all([
        fetch('/api/user?action=list-users'),
        fetch('/api/partners'),
      ]);

      if (!usersRes.ok) {
        throw new Error('Failed to load users');
      }

      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      if (partnersRes.ok) {
        const partnersData = await partnersRes.json();
        setPartners(partnersData.partners || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch('/api/user?action=create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          partnerId: formData.partnerId ? parseInt(formData.partnerId) : null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setFormData({ name: '', email: '', password: '', partnerId: '', role: 'partner' });
      setShowForm(false);
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (!confirm(`Delete login account for "${userName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/user?action=delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse bg-gray-200 rounded-lg h-8 w-48 mb-6"></div>
        <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full"></div>
      </div>
    );
  }

  if (!isPrimaryAdmin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          {error || 'Only the primary admin can manage user accounts.'}
        </div>
      </div>
    );
  }

  const assignedPartnerIds = new Set(users.filter(u => u.partnerId).map(u => u.partnerId));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="page-title">User Accounts</h1>
          <p className="text-sm text-gray-700 dark:text-theme-secondary mt-1">
            Create individual login accounts for each business partner. They will log in directly — no partner selection popup.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={showForm ? 'btn-neutral' : 'btn-primary'}
        >
          {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showForm && (
        <div className="themed-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Partner Login</h2>
          {formError && (
            <div className="mb-4 p-3 alert-error text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Partner's display name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="partner@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-theme-secondary mb-1">Linked Partner</label>
                <select
                  required
                  value={formData.partnerId}
                  onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-surface-border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select partner...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id} disabled={assignedPartnerIds.has(p.id)}>
                      {p.name}{assignedPartnerIds.has(p.id) ? ' (has account)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Login Account'}
            </button>
          </form>
        </div>
      )}

      <div className="themed-card overflow-hidden">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-gray-50 dark:bg-surface-elevated">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">Partner</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-theme-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-surface-hover">
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-theme-primary">{user.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-theme-secondary">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    !user.dataOwnerId ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {!user.dataOwnerId ? 'Primary Admin' : 'Partner'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-theme-secondary">
                  {user.partner?.name || '—'}
                </td>
                <td className="px-6 py-4 text-right text-sm">
                  {!user.dataOwnerId ? (
                    <span className="text-gray-400 text-xs">Protected</span>
                  ) : (
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> Each partner gets their own email and password.
          When they log in, they are automatically linked to their partner profile — no selection popup.
          Your existing primary admin account keeps full access and can still switch partners from the header.
        </p>
      </div>
    </div>
  );
}
