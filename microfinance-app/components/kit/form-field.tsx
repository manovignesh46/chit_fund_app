import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface FormFieldProps {
  label: React.ReactNode;
  /** The control. It receives id, aria-describedby, aria-invalid and required. */
  children: React.ReactElement;
  /** Help text under the control. */
  description?: React.ReactNode;
  /** Validation message; also marks the control invalid. */
  error?: React.ReactNode;
  required?: boolean;
  /**
   * With `required`: also set the native `required` attribute (the browser then blocks
   * submit with its own message). Set false when the form validates in script and must
   * show its own messages; the field is still announced as required (aria-required).
   */
  nativeRequired?: boolean;
  /** Use this id for the control (otherwise one is generated). */
  id?: string;
  className?: string;
}

/** Label + control + help/error text, wired for screen readers. */
export function FormField({ label, children, description, error, required = false, nativeRequired = true, id, className }: FormFieldProps) {
  const generated = React.useId();
  const childProps = children.props as { id?: string; 'aria-describedby'?: string };
  const controlId = id ?? childProps.id ?? `field-${generated}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [childProps['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    required: (required && nativeRequired) || undefined,
    'aria-required': (required && !nativeRequired) || undefined,
  } as Record<string, unknown>);

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={controlId} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-destructive-text">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {description && !error ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {description && error ? (
        <p id={descriptionId} className="sr-only">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
