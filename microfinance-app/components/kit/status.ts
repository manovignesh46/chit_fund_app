/**
 * The one status map (SPEC "Semantics"). Every status shown in the app resolves
 * here to a tone, a style and an icon, so "Completed" looks the same everywhere.
 * Keys are normalised (lower case, no spaces/hyphens/underscores):
 * "InterestOnly", "Interest Only" and "interest-only" are the same status.
 *
 * Lives under components/ (not lib/) so Tailwind sees the class names.
 */

export type StatusTone = 'success' | 'info' | 'warning' | 'destructive' | 'neutral';
export type StatusVariant = 'soft' | 'solid' | 'outline';
export type StatusIconName = 'dot' | 'clock' | 'check' | 'alert' | 'ban';

export interface StatusStyle {
  /** Display label (the canonical spelling). */
  label: string;
  tone: StatusTone;
  variant: StatusVariant;
  icon: StatusIconName;
  /** De-emphasised (e.g. Cancelled). */
  muted?: boolean;
}

export const STATUS_MAP: Readonly<Record<string, StatusStyle>> = {
  active: { label: 'Active', tone: 'success', variant: 'soft', icon: 'dot' },
  upcoming: { label: 'Upcoming', tone: 'info', variant: 'soft', icon: 'dot' },
  pending: { label: 'Pending', tone: 'neutral', variant: 'outline', icon: 'dot' },
  duetoday: { label: 'Due Today', tone: 'warning', variant: 'soft', icon: 'clock' },
  duetomorrow: { label: 'Due Tomorrow', tone: 'warning', variant: 'soft', icon: 'clock' },
  paid: { label: 'Paid', tone: 'success', variant: 'soft', icon: 'check' },
  interestonly: { label: 'Interest Only', tone: 'info', variant: 'soft', icon: 'dot' },
  partial: { label: 'Partial', tone: 'warning', variant: 'soft', icon: 'dot' },
  overdue: { label: 'Overdue', tone: 'destructive', variant: 'soft', icon: 'alert' },
  missed: { label: 'Missed', tone: 'destructive', variant: 'soft', icon: 'alert' },
  defaulted: { label: 'Defaulted', tone: 'destructive', variant: 'solid', icon: 'alert' },
  nonrecoverable: { label: 'Non-Recoverable', tone: 'destructive', variant: 'outline', icon: 'ban' },
  completed: { label: 'Completed', tone: 'neutral', variant: 'soft', icon: 'check' },
  closed: { label: 'Closed', tone: 'neutral', variant: 'soft', icon: 'dot' },
  settled: { label: 'Settled', tone: 'neutral', variant: 'soft', icon: 'check' },
  cancelled: { label: 'Cancelled', tone: 'neutral', variant: 'outline', icon: 'dot', muted: true },
};

export function normaliseStatus(status: string): string {
  return status.toLowerCase().replace(/[\s\-_]+/g, '');
}

/** Style for any status string; unknown statuses render neutral with their own text. */
export function getStatusStyle(status: string | null | undefined): StatusStyle {
  const raw = (status ?? '').trim();
  const known = raw ? STATUS_MAP[normaliseStatus(raw)] : undefined;
  return known ?? { label: raw || 'Unknown', tone: 'neutral', variant: 'soft', icon: 'dot' };
}

/** Badge colour classes by tone and variant (token-based, both themes). */
export const STATUS_CLASSES: Readonly<Record<StatusTone, Readonly<Record<StatusVariant, string>>>> = {
  success: {
    soft: 'bg-success-subtle text-success-text border-success-border',
    solid: 'bg-success text-success-foreground border-transparent',
    outline: 'bg-transparent text-success-text border-success-text/60',
  },
  info: {
    soft: 'bg-info-subtle text-info-text border-info-border',
    solid: 'bg-primary text-primary-foreground border-transparent',
    outline: 'bg-transparent text-info-text border-info-text/60',
  },
  warning: {
    soft: 'bg-warning-subtle text-warning-text border-warning-border',
    solid: 'bg-warning text-warning-foreground border-transparent',
    outline: 'bg-transparent text-warning-text border-warning-text/60',
  },
  destructive: {
    soft: 'bg-destructive-subtle text-destructive-text border-destructive-border',
    solid: 'bg-destructive text-destructive-foreground border-transparent',
    outline: 'bg-transparent text-destructive-text border-destructive-text/60',
  },
  neutral: {
    soft: 'bg-muted text-muted-foreground border-border',
    solid: 'bg-secondary-foreground text-secondary border-transparent',
    outline: 'bg-transparent text-muted-foreground border-input',
  },
};

/** Text colour per tone, for figures and icons that carry a status meaning. */
export const TONE_TEXT: Readonly<Record<StatusTone, string>> = {
  success: 'text-success-text',
  info: 'text-info-text',
  warning: 'text-warning-text',
  destructive: 'text-destructive-text',
  neutral: 'text-foreground',
};
