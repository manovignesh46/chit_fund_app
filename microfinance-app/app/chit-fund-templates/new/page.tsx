'use client';

/** New chit fund template (Form template). */
import * as React from 'react';
import Link from 'next/link';

import TemplateForm from '../TemplateForm';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';

export default function NewChitFundTemplatePage() {
  return (
    <PageContainer>
      <PageHeader
        title="New template"
        description="The amounts and duration new chit funds can start from."
        actions={
          <Button variant="ghost" asChild>
            <Link href="/chit-fund-templates">Cancel</Link>
          </Button>
        }
      />
      <TemplateForm mode="create" />
    </PageContainer>
  );
}
