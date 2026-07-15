// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TemplateForm from '../../TemplateForm';
import { chitFundTemplateAPI } from '../../../../lib/api';

export default function EditChitFundTemplatePage() {
  const params = useParams();
  const id = Number(params.id);
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await chitFundTemplateAPI.getById(id);
        setInitial(data);
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
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-700 dark:text-theme-secondary">Loading template...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !initial) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">{error || 'Template not found'}</p>
        <Link href="/chit-fund-templates" className="text-blue-600 hover:underline">Back to templates</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Edit Template</h1>
        <Link href="/chit-fund-templates" className="btn-neutral px-4 py-2 rounded-lg transition duration-300">
          Cancel
        </Link>
      </div>
      {initial._count?.chitFunds > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {initial._count.chitFunds} chit fund(s) were created from this template. Editing it will <strong>not</strong> affect them —
          each fund keeps the values it was created with.
        </div>
      )}
      <TemplateForm mode="edit" templateId={id} initial={initial} />
    </div>
  );
}
