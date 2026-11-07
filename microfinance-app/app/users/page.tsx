'use client';

/**
 * User accounts (List template, primary admin only): one login per business partner.
 * "Add user" opens the create form in a dialog; Delete asks first. The requests, bodies
 * and checks are the ones this page always used (lib/query/users.ts); the server decides
 * who may list, create and delete.
 */
import * as React from 'react';
import { Info, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { toast } from '@/lib/toast';
import { invalidateUsers, useUsers, usePartnerOptions, userWrites, type AppUser } from '@/lib/query/users';
import { usePartner } from '../contexts/PartnerContext';
import PasswordInput from '../components/ui/PasswordInput';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/kit/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/kit/data-table';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { FormField } from '@/components/kit/form-field';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer, PageSkeleton } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';

const EMPTY_FORM = { name: '', email: '', password: '', partnerId: '', role: 'partner' };

export default function UsersPage() {
  return (
    <PageContainer className="max-w-5xl">
      <Users />
    </PageContainer>
  );
}

function RoleBadge({ user }: { user: AppUser }) {
  const primary = !user.dataOwnerId;
  return (
    <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border bg-muted px-2 text-xs font-medium text-muted-foreground">
      {primary ? <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> : null}
      {primary ? 'Primary Admin' : 'Partner'}
    </span>
  );
}

function Users() {
  const { isPrimaryAdmin, currentUser, loading: profileLoading, error: profileError, refreshPartners } = usePartner();
  const users = useUsers(isPrimaryAdmin);
  const partners = usePartnerOptions(isPrimaryAdmin);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AppUser | null>(null);

  if (profileLoading) return <PageSkeleton rows={4} />;

  // The account could not be read at all (PartnerContext keeps it even when only the partners list failed).
  if (!currentUser && profileError) {
    return <ErrorState title="Couldn't check your account" error={profileError} onRetry={() => void refreshPartners()} />;
  }

  if (!isPrimaryAdmin) {
    return (
      <div className="rounded-lg border border-warning-border bg-warning-subtle px-4 py-3 text-sm text-warning-text" role="status">
        Only the primary admin can manage user accounts.
      </div>
    );
  }

  const rows = users.data?.users ?? [];
  const assignedPartnerIds = new Set(rows.filter((u) => u.partnerId).map((u) => u.partnerId));

  const deleteUser = async (user: AppUser) => {
    try {
      await userWrites.remove(user.id);
    } catch (error) {
      toast.error(`Couldn't delete ${user.name}'s login`, { description: errorMessage(error) ?? 'Failed to delete user' });
      return;
    }
    toast.success('Login account deleted', { description: user.name });
    void invalidateUsers();
  };

  const columns: DataTableColumn<AppUser>[] = [
    { id: 'name', header: 'Name', cell: (u) => <span className="font-medium text-foreground">{u.name}</span> },
    { id: 'email', header: 'Email', cell: (u) => <span className="break-all text-muted-foreground">{u.email}</span> },
    { id: 'role', header: 'Role', cell: (u) => <RoleBadge user={u} /> },
    { id: 'partner', header: 'Partner', cell: (u) => u.partner?.name || <span className="text-muted-foreground">—</span> },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (u) =>
        !u.dataOwnerId ? (
          <span className="text-xs text-muted-foreground">Protected</span>
        ) : (
          <Button variant="ghost" size="sm" className="text-destructive-text hover:bg-destructive-subtle hover:text-destructive-text" onClick={() => setDeleting(u)}>
            <Trash2 aria-hidden="true" />
            Delete
            <span className="sr-only"> {u.name}</span>
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User accounts"
        count={users.data ? rows.length : undefined}
        description="Create individual login accounts for each business partner. They will log in directly — no partner selection popup."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus aria-hidden="true" />
            Add user
          </Button>
        }
      />

      {users.error && rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <ErrorState title="Couldn't load user accounts" error={users.error} onRetry={() => void users.mutate()} />
        </div>
      ) : (
        <DataTable<AppUser>
          label="User accounts"
          mode="client"
          columns={columns}
          rows={rows}
          getRowId={(u) => u.id}
          isInitialLoading={!users.data && !users.error}
          isRefreshing={users.isValidating && !!users.data}
          skeletonRows={3}
          emptyState={<EmptyState title="No user accounts yet" description="Add a login for each business partner." />}
          renderCard={(u) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{u.name}</p>
                  <p className="break-all text-sm text-muted-foreground">{u.email}</p>
                </div>
                <RoleBadge user={u} />
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Partner: <span className="text-foreground">{u.partner?.name || '—'}</span>
                </span>
                {!u.dataOwnerId ? (
                  <span className="text-xs text-muted-foreground">Protected</span>
                ) : (
                  <Button variant="outline" size="sm" className="text-destructive-text" onClick={() => setDeleting(u)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                    <span className="sr-only"> {u.name}</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      )}

      <div className="mt-4 flex gap-3 rounded-lg border border-info-border bg-info-subtle p-4 text-sm text-info-text">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>How it works:</strong> Each partner gets their own email and password. When they log in, they are automatically linked to their
          partner profile — no selection popup. Your existing primary admin account keeps full access and can still switch partners from the header.
        </p>
      </div>

      <CreateUserDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        partners={partners.data?.partners ?? []}
        assignedPartnerIds={assignedPartnerIds}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete login account for "${deleting.name}"?` : 'Delete login account?'}
        description="This cannot be undone. The partner's records stay; only their login is removed."
        confirmLabel="Delete login"
        onConfirm={async () => {
          if (deleting) await deleteUser(deleting);
        }}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  partners,
  assignedPartnerIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: { id: number; name: string }[];
  assignedPartnerIds: Set<number | null | undefined>;
}) {
  const formId = React.useId();
  const [formData, setFormData] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // A fresh form each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSubmitting(false);
  }, [open]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      // The body the page has always sent: the form values, partnerId as a number (or null).
      const created = await userWrites.create({
        ...formData,
        partnerId: formData.partnerId ? parseInt(formData.partnerId) : null,
      });
      toast.success('Login account created', { description: created?.email ?? formData.email });
      void invalidateUsers();
      onOpenChange(false);
    } catch (err) {
      setFormError(errorMessage(err) ?? 'Failed to create user');
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      title="Create partner login"
      description="The partner signs in with this email and password and is linked to the partner you choose."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {submitting ? 'Creating…' : 'Create login account'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleCreate} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" required>
            <Input
              type="text"
              autoComplete="off"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Partner's display name"
            />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              autoComplete="off"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="partner@email.com"
            />
          </FormField>
          <FormField label="Password" required description="At least 8 characters.">
            <PasswordInput
              minLength={8}
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 8 characters"
            />
          </FormField>
          <FormField label="Linked partner" required>
            <NativeSelect
              value={formData.partnerId}
              onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
              placeholder="Select partner..."
              options={partners.map((p) => ({
                value: String(p.id),
                label: `${p.name}${assignedPartnerIds.has(p.id) ? ' (has account)' : ''}`,
                disabled: assignedPartnerIds.has(p.id),
              }))}
            />
          </FormField>
        </div>
        {formError ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {formError}
          </p>
        ) : null}
      </form>
    </ResponsiveDialog>
  );
}
