'use client';

/** Edit a chit fund template (Form template). Existing funds keep the values they were created with. */
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Info } from 'lucide-react';

import { ApiError } from '@/lib/query/fetcher';
import { useChitFundTemplate, type ChitFundTemplate } from '@/lib/query/chit-fund-templates';
import TemplateForm from '../../TemplateForm';
import { Button } from '@/components/ui/button';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { PageContainer, PageSkeleton } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';

export default function EditChitFundTemplatePage() {
  return (
    <PageContainer fallback={<PageSkeleton rows={8} />}>
      <EditTemplate />
    </PageContainer>
  );
}

function EditTemplate() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const { data, error, mutate } = useChitFundTemplate(id || null);
  useBreadcrumbLabel(id ? `/chit-fund-templates/${id}` : null, data?.name);

  // Prefill once: background revalidation must not overwrite what the user is typing.
  const [initial, setInitial] = React.useState<ChitFundTemplate | null>(null);
  React.useEffect(() => {
    if (data && !initial) setInitial(data);
  }, [data, initial]);

  const status = error instanceof ApiError ? error.status : 0;
  const usedBy = initial?._count?.chitFunds ?? 0;
  return (
    <div>
      <PageHeader
        title="Edit template"
        description={data?.name}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/chit-fund-templates">Cancel</Link>
          </Button>
        }
      />
      {initial ? (
        <>
          {usedBy > 0 ? (
            <p className="mb-6 flex items-start gap-2 rounded-md border border-info-border bg-info-subtle px-3 py-2 text-sm text-info-text">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {usedBy} chit fund(s) were created from this template. Editing it will <strong>not</strong> affect them — each fund keeps the values it
                was created with.
              </span>
            </p>
          ) : null}
          <TemplateForm mode="edit" templateId={id} initial={initial} />
        </>
      ) : error && (status === 404 || status === 403 || status === 400) ? (
        <EmptyState
          title="Template not found"
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/chit-fund-templates">Back to templates</Link>
            </Button>
          }
        />
      ) : error ? (
        <ErrorState title="Failed to load template" error={error} onRetry={() => void mutate()} />
      ) : (
        <PageSkeleton rows={8} />
      )}
    </div>
  );
}
