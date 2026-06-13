'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ActionItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string; // For Link actions
}

interface ActionDropdownProps {
  actions: ActionItem[];
  className?: string;
}

export default function ActionDropdown({ actions, className = '' }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Enhanced positioning with mobile-specific handling
  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 192; // w-48 = 12rem = 192px
      const dropdownHeight = Math.min(actions.length * 40 + 16, 200);
      const isMobile = window.innerWidth < 768;

      let topPosition: number;
      let leftPosition: number;

      if (isMobile) {
        // Mobile: Position dropdown in center of screen, above button if possible
        topPosition = Math.max(20, rect.top - dropdownHeight - 10 + window.scrollY);
        leftPosition = (window.innerWidth - dropdownWidth) / 2 + window.scrollX;

        // If dropdown would go off top of screen, position it below button
        if (topPosition < 20) {
          topPosition = rect.bottom + 10 + window.scrollY;
        }
      } else {
        // Desktop: Position above the button
        topPosition = rect.top - dropdownHeight - 10 + window.scrollY;

        // Center horizontally relative to button
        leftPosition = rect.left + (rect.width / 2) - (dropdownWidth / 2) + window.scrollX;

        // Ensure it stays within viewport horizontally
        leftPosition = Math.max(10, Math.min(leftPosition, window.innerWidth - dropdownWidth - 10 + window.scrollX));

        // Ensure it stays within viewport vertically
        topPosition = Math.max(10, topPosition);
      }

      setDropdownPosition({
        top: topPosition,
        left: leftPosition,
      });


    }
  };

  // Close dropdown when clicking outside and handle scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    const handleResize = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
      window.addEventListener('resize', handleResize);
      // Use setTimeout to ensure positioning happens after DOM update
      setTimeout(calculatePosition, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleActionClick = (action: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (!action.disabled) {
      action.onClick();
    }
  };

  return (
    <>
      <div
        className={`relative inline-block text-left ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3-dots trigger button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev: boolean) => !prev)}
          className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-700 dark:text-theme-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full hover:bg-gray-50 dark:hover:bg-surface-hover"
          aria-label="Actions"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Dropdown menu - rendered as portal */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-48 themed-card rounded-md shadow-xl border border-gray-200 dark:border-surface-border focus:outline-none"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            zIndex: 99999,
            boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          <div className="py-1">
            {actions.map((action, index) => {
              if (action.href) {
                // Link action
                return (
                  <a
                    key={index}
                    href={action.href}
                    onClick={(e) => handleActionClick(action, e)}
                    className={`group flex items-center px-4 py-2 text-sm transition-colors ${
                      action.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 dark:text-theme-secondary hover:bg-gray-50 dark:hover:bg-surface-hover hover:text-gray-900 dark:text-theme-primary'
                    } ${action.className || ''}`}
                  >
                    {action.icon && (
                      <span className="mr-3 flex-shrink-0">
                        {action.icon}
                      </span>
                    )}
                    {action.label}
                  </a>
                );
              } else {
                // Button action
                return (
                  <button
                    key={index}
                    onClick={(e) => handleActionClick(action, e)}
                    disabled={action.disabled}
                    className={`group flex items-center w-full px-4 py-2 text-sm text-left transition-colors ${
                      action.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 dark:text-theme-secondary hover:bg-gray-50 dark:hover:bg-surface-hover hover:text-gray-900 dark:text-theme-primary'
                    } ${action.className || ''}`}
                  >
                    {action.icon && (
                      <span className="mr-3 flex-shrink-0">
                        {action.icon}
                      </span>
                    )}
                    {action.label}
                  </button>
                );
              }
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
