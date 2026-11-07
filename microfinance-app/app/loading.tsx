import { PageSkeleton } from '@/components/kit/page-container';

/** Shown while a route segment loads during navigation. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8" role="status" aria-label="Loading">
      <PageSkeleton />
    </div>
  );
}
