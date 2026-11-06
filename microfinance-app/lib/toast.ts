/**
 * Toasts without putting sonner in the page bundle: the module is imported on the first
 * toast (the <Toaster> in app/providers.tsx already loads it after first paint, so it is
 * normally cached by then). Same call shapes as sonner's `toast`.
 */
type Sonner = typeof import('sonner');
type ToastFn = Sonner['toast'];
type Message = Parameters<ToastFn>[0];
type Options = Parameters<ToastFn>[1];

let sonner: Promise<Sonner> | null = null;
const load = () => (sonner ??= import('sonner'));
const call = (pick: (t: ToastFn) => (message: Message, options?: Options) => unknown) => (message: Message, options?: Options) => {
  void load().then(({ toast: t }) => pick(t)(message, options));
};

export const toast = Object.assign(
  call((t) => t),
  {
    success: call((t) => t.success),
    error: call((t) => t.error),
    warning: call((t) => t.warning),
    info: call((t) => t.info),
  }
);
