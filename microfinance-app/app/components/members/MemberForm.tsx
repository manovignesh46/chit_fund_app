'use client';

/**
 * The one member form, used to add a member (members list) and to edit one (members list
 * row menu and the member page). It opens in a dialog (a bottom sheet on phones): the form
 * is five short fields and editing should not leave the page the user is on.
 *
 * Fields, validation messages and the request body are the ones the members page always
 * had: values are sent as typed (not trimmed), blanks as "", body
 * `{ id, name, contact, email, address, notes }` with `id: 0` when adding.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { toast } from '@/lib/toast';
import { invalidateMembers, memberWrites, type MemberBody, type MemberRecord } from '@/lib/query/members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/kit/form-field';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { errorMessage } from '@/components/kit/error-state';

export interface MemberFormValues {
  name: string;
  contact: string;
  email: string;
  address: string;
  notes: string;
}

export type MemberFormErrors = Partial<Record<keyof MemberFormValues, string>>;

export const EMPTY_MEMBER_FORM: MemberFormValues = { name: '', contact: '', email: '', address: '', notes: '' };

export function memberToForm(member: Pick<MemberRecord, 'name' | 'contact' | 'email' | 'address' | 'notes'>): MemberFormValues {
  return {
    name: member.name ?? '',
    contact: member.contact ?? '',
    email: member.email ?? '',
    address: member.address ?? '',
    notes: member.notes ?? '',
  };
}

/** The checks the members page always ran, with the same messages. */
export function validateMemberForm(v: MemberFormValues): MemberFormErrors {
  const e: MemberFormErrors = {};
  if (!v.name.trim()) e.name = 'Name is required';
  if (!v.contact.trim()) e.contact = 'Contact information is required';
  else if (!/^[0-9+\s-]{10,15}$/.test(v.contact.trim())) e.contact = 'Please enter a valid phone number';
  if (v.email && !/\S+@\S+\.\S+/.test(v.email)) e.email = 'Please enter a valid email address';
  return e;
}

export function memberBody(id: number, v: MemberFormValues): MemberBody {
  return { id, name: v.name, contact: v.contact, email: v.email, address: v.address, notes: v.notes };
}

const FIELD_ORDER: (keyof MemberFormValues)[] = ['name', 'contact', 'email', 'address', 'notes'];

export interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The member to edit; omit to add a new one. */
  member?: MemberRecord | null;
  /** Called with the saved member after the server confirms. */
  onSaved?: (member: MemberRecord) => void;
  /** Where focus returns on close (default: what had focus when it opened). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function MemberFormDialog({ open, onOpenChange, member, onSaved, returnFocusRef }: MemberFormDialogProps) {
  const editing = !!member;
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [values, setValues] = React.useState<MemberFormValues>(EMPTY_MEMBER_FORM);
  const [errors, setErrors] = React.useState<MemberFormErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Fresh values each time the dialog opens (for the member being edited, or empty).
  React.useEffect(() => {
    if (!open) return;
    setValues(member ? memberToForm(member) : EMPTY_MEMBER_FORM);
    setErrors({});
    setSubmitError(null);
    setSubmitting(false);
  }, [open, member]);

  const bind = (name: keyof MemberFormValues) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [name]: value }));
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateMemberForm(values);
    setErrors(found);
    const first = FIELD_ORDER.find((name) => found[name]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = editing && member
        ? await memberWrites.update(member.id, memberBody(member.id, values))
        : await memberWrites.create(memberBody(0, values));
      toast.success(editing ? 'Member updated' : 'Member added', { description: saved?.name ?? values.name });
      void invalidateMembers();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(errorMessage(error) ?? 'Failed to save member. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      returnFocusRef={returnFocusRef}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      title={editing ? 'Edit member' : 'Add new member'}
      description={editing ? `Update ${member?.name ?? 'this member'}'s contact details.` : 'Add a person who can borrow or join chit funds.'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {submitting ? 'Saving…' : editing ? 'Update member' : 'Add member'}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" required nativeRequired={false} error={errors.name}>
          <Input type="text" autoComplete="off" {...bind('name')} />
        </FormField>
        <FormField label="Contact number" required nativeRequired={false} error={errors.contact}>
          <Input type="text" inputMode="tel" autoComplete="off" {...bind('contact')} />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <Input type="email" autoComplete="off" {...bind('email')} />
        </FormField>
        <FormField label="Address" error={errors.address}>
          <Input type="text" autoComplete="off" {...bind('address')} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={3} {...bind('notes')} />
        </FormField>
        {submitError ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-text">
            {submitError}
          </p>
        ) : null}
      </form>
    </ResponsiveDialog>
  );
}

export default MemberFormDialog;
