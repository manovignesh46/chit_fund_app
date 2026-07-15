// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { chitFundTemplateAPI } from '../../../lib/api';
import { formatCurrency } from '../../../lib/formatUtils';

export default function ChitFundTemplateDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await chitFundTemplateAPI.getById(id);
        setTemplate(data);
      } catch (e) {
        setError(e?.message || 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">{error || 'Template not found'}</p>
        <Link href="/chit-fund-templates" className="text-blue-600 hover:underline">Back to templates</Link>
      </div>
    );
  }

  const isFixed = template.chitFundType === 'Fixed';
  const pattern = template.fixedAmountsPattern || {};
  const months = Object.keys(pattern).map(Number).sort((a, b) => a - b);

  const Row = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-surface-border">
      <span className="text-sm text-gray-500 dark:text-theme-secondary">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="page-title">{template.name}</h1>
        <div className="flex gap-3">
          <Link href="/chit-fund-templates" className="btn-neutral px-4 py-2 rounded-lg transition duration-300">Back</Link>
          <Link href={`/chit-fund-templates/${id}/edit`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">Edit</Link>
          <Link href={`/chit-funds/new?template=${id}`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">Create fund from this</Link>
        </div>
      </div>

      <div className="themed-card p-6 max-w-2xl">
        {template.description && (
          <p className="text-sm text-gray-600 dark:text-theme-secondary mb-4">{template.description}</p>
        )}
        <Row label="Type" value={template.chitFundType} />
        <Row label="Total Amount" value={formatCurrency(template.totalAmount)} />
        <Row label={isFixed ? 'Monthly Contribution (2nd+)' : 'Monthly Contribution'} value={formatCurrency(template.monthlyContribution)} />
        {isFixed && <Row label="1st Month Contribution" value={formatCurrency(template.firstMonthContribution)} />}
        <Row label="Duration" value={`${template.duration} months`} />
        <Row label="Members" value={template.membersCount} />
        <Row label="Used by" value={`${template._count?.chitFunds ?? 0} chit fund(s)`} />
        {template.isArchived && <Row label="Status" value="Archived" />}
      </div>

      {isFixed && months.length > 0 && (
        <div className="themed-card p-6 max-w-2xl mt-6">
          <h2 className="text-lg font-semibold mb-4">Fixed Amounts by Month</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {months.map((m) => (
              <div key={m} className="flex justify-between border border-gray-100 dark:border-surface-border rounded px-3 py-2">
                <span className="text-sm text-gray-500 dark:text-theme-secondary">Month {m}</span>
                <span className="text-sm font-medium tabular-nums">{formatCurrency(pattern[m])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
