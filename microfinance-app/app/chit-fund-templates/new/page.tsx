// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';
import TemplateForm from '../TemplateForm';

export default function NewChitFundTemplatePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Create New Template</h1>
        <Link href="/chit-fund-templates" className="btn-neutral px-4 py-2 rounded-lg transition duration-300">
          Cancel
        </Link>
      </div>
      <TemplateForm mode="create" />
    </div>
  );
}
