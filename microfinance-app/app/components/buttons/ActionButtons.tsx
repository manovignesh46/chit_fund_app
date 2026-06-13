// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

interface LinkButtonProps extends ButtonProps {
  href: string;
}

interface ActionButtonProps extends ButtonProps {
  onClick: () => void;
}

/** Base button — apply a variant class via className */
export const Button = ({
  children,
  className = '',
  disabled = false,
  ...props
}: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${className} ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
);

/** Base link styled as a button */
export const LinkButton = ({
  children,
  className = '',
  href,
  disabled = false,
  ...props
}: LinkButtonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) => {
  if (disabled) {
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed ${className}`} {...props}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${className}`} {...props}>
      {children}
    </Link>
  );
};

/** Edit action — neutral secondary style (icon conveys meaning, not color) */
export const EditButton = ({ href, className = '', ...props }: LinkButtonProps) => (
  <LinkButton href={href} className={`btn-secondary ${className}`} {...props}>
    {props.children || 'Edit'}
  </LinkButton>
);

/** Export to Excel — primary (blue) */
export const ExportButton = ({
  onClick,
  className = '',
  disabled = false,
  isExporting = false,
  ...props
}: ActionButtonProps & { isExporting?: boolean }) => {
  const { isExporting: _ie, ...restProps } = props;
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isExporting}
      className={`btn-primary ${className}`}
      {...restProps}
    >
      {isExporting ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {props.children || 'Exporting...'}
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {props.children || 'Export as Excel'}
        </>
      )}
    </Button>
  );
};

/** Back / cancel — neutral */
export const BackButton = ({ href, className = '', ...props }: LinkButtonProps) => (
  <LinkButton href={href} className={`btn-neutral ${className}`} {...props}>
    {props.children || 'Back'}
  </LinkButton>
);

/** Create / add — primary (blue) */
export const CreateButton = ({ href, className = '', ...props }: LinkButtonProps) => (
  <LinkButton href={href} className={`btn-primary ${className}`} {...props}>
    {props.children || 'Create New'}
  </LinkButton>
);

/** Delete — danger (red) */
export const DeleteButton = ({
  onClick,
  className = '',
  disabled = false,
  isDeleting = false,
  ...props
}: ActionButtonProps & { isDeleting?: boolean }) => {
  const { isDeleting: _id, ...restProps } = props;
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isDeleting}
      className={`btn-danger ${className}`}
      {...restProps}
    >
      {isDeleting ? 'Deleting...' : (props.children || 'Delete')}
    </Button>
  );
};

export const ActionButtonGroup = ({
  children,
  className = '',
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  const { isExporting, setIsExporting, setShowDeleteModal, chitFund, member, loan, ...restProps } = props;
  return (
    <div className={`flex items-center gap-2 ${className}`} {...restProps}>
      {children}
    </div>
  );
};
