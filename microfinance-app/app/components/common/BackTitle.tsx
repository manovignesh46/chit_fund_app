'use client';

import Link from 'next/link';

interface BackTitleProps {
  title: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export default function BackTitle({ title, href, onClick, ariaLabel, className = '' }: BackTitleProps) {
  const content = (
    <>
      <svg className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
      <h1 className="page-title">{title}</h1>
    </>
  );

  const sharedClassName = `inline-flex items-center gap-1.5 sm:gap-2 -ml-1 sm:-ml-2 px-1 sm:px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel || `Back to ${title}`} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel || `Back to ${title}`} className={sharedClassName}>
      {content}
    </button>
  );
}
