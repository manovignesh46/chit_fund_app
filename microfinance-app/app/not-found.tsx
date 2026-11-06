'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 404. Makes no requests and does not assume a session. */
export default function NotFound() {
  const router = useRouter();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion aria-hidden="true" className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you asked for does not exist or has moved. Check the address, or go back.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
