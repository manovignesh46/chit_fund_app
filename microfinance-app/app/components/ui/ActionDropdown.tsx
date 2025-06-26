'use client';

import React, { useState, useRef, useEffect } from 'react';

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
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleActionClick = (action: ActionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (!action.disabled) {
      action.onClick();
    }
  };

  return (
    <div
      className={`relative inline-block text-left ${className}`}
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      // onMouseEnter={handleMouseEnter}
      // onMouseLeave={handleMouseLeave}
    >
      {/* 3-dots trigger button */}
      <button
        type="button"
        // onClick={handleClick}
          onClick={() => setIsOpen((prev: boolean) => !prev)} // Toggle for all views
        className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full hover:bg-gray-100"
        aria-label="Actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 bottom-full mb-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
        </div>
      )}
    </div>
  );
}
