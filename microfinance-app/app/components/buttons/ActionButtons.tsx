'use client';

import React from 'react';
import Link from 'next/link';

// Common button props interface
interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

// Link button props interface
interface LinkButtonProps extends ButtonProps {
  href: string;
}

// Action button props interface
interface ActionButtonProps extends ButtonProps {
  onClick: () => void;
}

/**
 * Base button component with common styling
 */
export const Button = ({ 
  children, 
  className = '', 
  disabled = false,
  ...props 
}: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      className={`px-4 py-2 rounded-lg transition duration-300 ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * Base link component styled as a button
 */
export const LinkButton = ({ 
  children, 
  className = '', 
  href,
  disabled = false,
  ...props 
}: LinkButtonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) => {
  if (disabled) {
    return (
      <span
        className={`px-4 py-2 rounded-lg transition duration-300 ${className} opacity-50 cursor-not-allowed`}
        {...props}
      >
        {children}
      </span>
    );
  }
  
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg transition duration-300 ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
};

/**
 * Edit button component
 */
export const EditButton = ({ href, className = '', ...props }: LinkButtonProps) => {
  return (
    <LinkButton
      href={href}
      className={`bg-yellow-600 text-white hover:bg-yellow-700 ${className}`}
      {...props}
    >
      {props.children || 'Edit'}
    </LinkButton>
  );
};

/**
 * Export button component
 */
export const ExportButton = ({ 
  onClick, 
  className = '', 
  disabled = false,
  isExporting = false,
  ...props 
}: ActionButtonProps & { isExporting?: boolean }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isExporting}
      className={`${
        isExporting ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
      } text-white flex items-center ${className}`}
      {...props}
    >
      {isExporting ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {props.children || 'Exporting...'}
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          {props.children || 'Export as Excel'}
        </>
      )}
    </Button>
  );
};

/**
 * Back button component
 */
export const BackButton = ({ href, className = '', ...props }: LinkButtonProps) => {
  return (
    <LinkButton
      href={href}
      className={`bg-gray-200 text-gray-700 hover:bg-gray-300 ${className}`}
      {...props}
    >
      {props.children || 'Back'}
    </LinkButton>
  );
};

/**
 * Create button component
 */
export const CreateButton = ({ href, className = '', ...props }: LinkButtonProps) => {
  return (
    <LinkButton
      href={href}
      className={`bg-green-600 text-white hover:bg-green-700 ${className}`}
      {...props}
    >
      {props.children || 'Create New'}
    </LinkButton>
  );
};

/**
 * Delete button component
 */
export const DeleteButton = ({ 
  onClick, 
  className = '', 
  disabled = false,
  isDeleting = false,
  ...props 
}: ActionButtonProps & { isDeleting?: boolean }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isDeleting}
      className={`${
        disabled ? 'bg-gray-300 text-gray-500' : 'bg-red-600 hover:bg-red-700 text-white'
      } ${className}`}
      {...props}
    >
      {isDeleting ? 'Deleting...' : (props.children || 'Delete')}
    </Button>
  );
};

/**
 * Action button group component
 */
export const ActionButtonGroup = ({ 
  children,
  className = '',
  ...props
}: { 
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={`flex space-x-3 ${className}`} {...props}>
      {children}
    </div>
  );
};
