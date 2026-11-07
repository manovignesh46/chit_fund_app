'use client';

/** One chit fund template (Detail template): its structural fields and fixed amounts. */
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil, PlusCircle } from 'lucide-react';

import { ApiError } from '@/lib/query/fetcher';
import { useChitFundTemplate } from '@/lib/query/chit-fund-templates';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { DescriptionList } from '@/components/kit/description-list';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { SectionCard } from '@/components/kit/section-card';
import { StatusBadge } from '@/components/kit/status-badge';

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
    </div>
  );
}

export default function ChitFundTemplateDetailPage() {
  return (
    <PageContainer fallback={<DetailSkeleton />}>
      <TemplateDetail />
    </PageContainer>
  );
}

function TemplateDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const { data: template, error, mutate } = useChitFundTemplate(id || null);
  useBreadcrumbLabel(id ? `/chit-fund-templates/${id}` : null, template?.name);

  if (!template) {
    if (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 404 || status === 403 || status === 400) {
        return (
          <EmptyState
            title="Template not found"
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/chit-fund-templates">Back to templates</Link>
              </Button>
            }
          />
        );
      }
      return <ErrorState title="Failed to load template" error={error} onRetry={() => void mutate()} />;
    }
    return <DetailSkeleton />;
  }

  const isFixed = template.chitFundType === 'Fixed';
  const pattern = template.fixedAmountsPattern || {};
  const months = Object.keys(pattern).map(Number).sort((a, b) => a - b);
  const usedBy = template._count?.chitFunds ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow={`Template #${template.id}`}
        title={template.name}
        status={template.isArchived ? <StatusBadge status="Archived" label="Archived" size="md" /> : null}
        description={template.description || undefined}
        actions={
          <>
            <Button asChild>
              <Link href={`/chit-funds/new?template=${template.id}`}>
                <PlusCircle aria-hidden="true" />
                Create fund from this
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/chit-fund-templates/${template.id}/edit`}>
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="max-w-3xl space-y-6">
        <SectionCard title="Structure">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Type', value: template.chitFundType },
              { label: 'Total amount', value: <Money value={template.totalAmount} tone="plain" />, numeric: true },
              { label: isFixed ? 'Monthly contribution (2nd+)' : 'Monthly contribution', value: <Money value={template.monthlyContribution} tone="plain" />, numeric: true },
              ...(isFixed ? [{ label: '1st month contribution', value: <Money value={template.firstMonthContribution} tone="plain" />, numeric: true }] : []),
              { label: 'Duration', value: `${template.duration} months`, numeric: true },
              { label: 'Members', value: template.membersCount, numeric: true },
              { label: 'Used by', value: `${usedBy} chit fund(s)`, numeric: true },
              ...(template.isArchived ? [{ label: 'Status', value: 'Archived' }] : []),
            ]}
          />
        </SectionCard>

        {isFixed && months.length > 0 ? (
          <SectionCard title="Fixed amounts by month">
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {months.map((m) => (
                <li key={m} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-sm text-muted-foreground">Month {m}</span>
                  <Money value={pattern[String(m)]} tone="plain" className="text-sm font-medium" />
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
