'use client';

import React, { useState, useEffect, useRef } from 'react';
import SidebarUserMenu from './SidebarUserMenu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpen }) => {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  const sidebarWidth = 256; // w-64 in tailwind
  const [translateX, setTranslateX] = useState(-sidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const translateXRef = useRef(translateX);

  // Keep ref updated with the latest translateX value
  useEffect(() => {
    translateXRef.current = translateX;
  }, [translateX]);

  // Update position when isOpen prop changes or when dragging ends.
  useEffect(() => {
    if (!isDragging) {
      setTranslateX(isOpen ? 0 : -sidebarWidth);
    }
  }, [isOpen, isDragging]);

  // Effect to handle body swipes for opening/closing sidebar
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return;
    }

    const dragState = {
      startX: 0,
      startY: 0,
      initialTranslateX: 0,
      isSwiping: false, // Indicates if we are actively controlling the sidebar movement
      lastTouchX: 0,
      lastTouchTime: 0,
      velocityX: 0,
      isOriginLeftQuarter: false, // New property
    };

    const handleTouchStart = (e: TouchEvent) => {
      dragState.startX = e.touches[0].clientX;
      dragState.startY = e.touches[0].clientY;
      dragState.initialTranslateX = translateXRef.current;
      dragState.lastTouchX = e.touches[0].clientX;
      dragState.lastTouchTime = Date.now();
      dragState.velocityX = 0; // Reset velocity on start
      dragState.isSwiping = false; // Reset active swiping state
      setIsDragging(false); // Reset dragging state
      dragState.isOriginLeftQuarter = e.touches[0].clientX < window.innerWidth / 4; // Set origin flag
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentX = e.touches[0].clientX;
      const currentTime = Date.now();
      const deltaX = currentX - dragState.startX;
      const deltaY = e.touches[0].clientY - dragState.startY;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine if it's primarily a horizontal swipe
      const isHorizontalSwipeGesture = absDeltaX > absDeltaY && absDeltaX > 5; // Threshold for horizontal swipe

      // If it's primarily a vertical swipe, or not a significant horizontal swipe, let the browser handle it.
      if (absDeltaY > absDeltaX && absDeltaY > 5 || !isHorizontalSwipeGesture) {
        // If we were already swiping the sidebar, release control
        if (dragState.isSwiping) {
          dragState.isSwiping = false;
          setIsDragging(false);
          // Reset translateX to its open/closed state if we release control mid-swipe
          setTranslateX(isOpen ? 0 : -sidebarWidth);
        }
        return; // Let browser handle native scroll or ignore small movements
      }

      // --- Prioritize Sidebar Close if Open and Swiping Left ---
      if (isOpen && deltaX < 0) { // Sidebar is open, swiping left
        if (!dragState.isSwiping) {
          dragState.isSwiping = true;
          setIsDragging(true);
        }
        e.preventDefault(); // Prevent default to take control of the swipe
        const newTranslateX = dragState.initialTranslateX + deltaX;
        const clampedX = Math.max(-sidebarWidth, Math.min(newTranslateX, 0));
        setTranslateX(clampedX);

        // Calculate velocity
        const timeDiff = currentTime - dragState.lastTouchTime;
        if (timeDiff > 0) {
          dragState.velocityX = (currentX - dragState.lastTouchX) / timeDiff; // pixels per ms
        }
        dragState.lastTouchX = currentX;
        dragState.lastTouchTime = currentTime;
        return; // Handled by sidebar, no need to check for scrollable elements
      }

      // --- Check for Horizontal Scrollable Elements (for other cases) ---
      let target = e.target as HTMLElement;
      let isTargetHorizontallyScrollableAndCanScroll = false;
      while (target && target !== document.body) {
        if (target.scrollWidth > target.clientWidth) {
          // Check if scrolling in the direction of the swipe is possible
          if ((deltaX < 0 && target.scrollLeft < target.scrollWidth - target.clientWidth) || // Swiping left, can scroll left
              (deltaX > 0 && target.scrollLeft > 0)) { // Swiping right, can scroll right
            isTargetHorizontallyScrollableAndCanScroll = true;
            break;
          }
        }
        target = target.parentElement as HTMLElement;
      }

      // If it's a horizontal swipe on a scrollable element that can still scroll, let the browser handle it.
      if (isTargetHorizontallyScrollableAndCanScroll) {
        if (dragState.isSwiping) { // If we were controlling the sidebar, release it
          dragState.isSwiping = false;
          setIsDragging(false);
          setTranslateX(isOpen ? 0 : -sidebarWidth); // Snap back
        }
        return; // Let browser handle horizontal scroll
      }

      // --- Handle Sidebar Open (if not already handled by close or scroll) ---
      const isSwipeToOpenSidebar = !isOpen && deltaX > 0 && dragState.isOriginLeftQuarter; // Sidebar closed, swiping right, and originated from left quarter

      if (isSwipeToOpenSidebar) {
        if (!dragState.isSwiping) { // Only set once
          dragState.isSwiping = true;
          setIsDragging(true);
        }
        e.preventDefault(); // Prevent default only when we are actively controlling the sidebar

        const newTranslateX = dragState.initialTranslateX + deltaX;
        const clampedX = Math.max(-sidebarWidth, Math.min(newTranslateX, 0));
        setTranslateX(clampedX);

        // Calculate velocity
        const timeDiff = currentTime - dragState.lastTouchTime;
        if (timeDiff > 0) {
          dragState.velocityX = (currentX - dragState.lastTouchX) / timeDiff; // pixels per ms
        }
        dragState.lastTouchX = currentX;
        dragState.lastTouchTime = currentTime;
      } else {
        // If it's a horizontal swipe but not a valid sidebar gesture (e.g., swiping right when sidebar is open,
        // or swiping left when sidebar is closed), and it's not a scrollable element,
        // then we just let it be, but ensure sidebar control is released.
        if (dragState.isSwiping) {
          dragState.isSwiping = false;
          setIsDragging(false);
          setTranslateX(isOpen ? 0 : -sidebarWidth); // Snap back to original state
        }
      }
    };

    const handleTouchEnd = () => {
      if (!dragState.isSwiping) {
        // If we were not actively swiping the sidebar, do nothing
        return;
      }

      dragState.isSwiping = false;
      setIsDragging(false);

      const lastTranslateX = translateXRef.current;
      const velocityThreshold = 0.3; // pixels per ms

      // Determine action based on velocity or distance
      if (dragState.velocityX > velocityThreshold) {
        onOpen(); // Fast swipe right
      } else if (dragState.velocityX < -velocityThreshold) {
        onClose(); // Fast swipe left
      } else if (lastTranslateX < -sidebarWidth / 2) {
        onClose(); // Distance-based close
      } else {
        onOpen(); // Distance-based open
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onOpen, onClose]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsExpanded(false);
    }
  }, []);

  useEffect(() => {
    const event = new CustomEvent('sidebarExpansion', { detail: { expanded: isExpanded } });
    window.dispatchEvent(event);
  }, [isExpanded]);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
        </svg>
      )
    },
    {
      name: 'Chit Funds',
      href: '/chit-funds',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: 'Loans',
      href: '/loans',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      )
    },
    {
      name: 'Members',
      href: '/members',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    {
      name: 'Partners',
      href: '/partners',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      name: 'Calendar',
      href: '/calendar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Activities',
      href: '/activities',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    }
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {(isOpen || isDragging) && (
        <div
          className="fixed inset-0 bg-black z-40 lg:hidden"
          onClick={onClose}
          style={{ 
            opacity: (translateX + sidebarWidth) / sidebarWidth * 0.5,
            transition: isDragging ? 'none' : 'opacity 0.3s ease-in-out'
          }}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-white shadow-lg z-50
          lg:translate-x-0
          w-64 lg:${isExpanded ? 'w-64' : 'w-16'}
          flex flex-col
        `}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-in-out',
        }}
        onMouseEnter={() => {
          if (window.innerWidth >= 1024) { setIsExpanded(true); }
        }}
        onMouseLeave={() => {
          if (window.innerWidth >= 1024) { setIsExpanded(false); }
        }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 min-h-16 px-4 border-b border-gray-200 bg-blue-600 text-white">
          <div className="flex items-center overflow-hidden">
            {isExpanded ? (
              <h2 className="text-lg font-bold whitespace-nowrap">AM Fincorp</h2>
            ) : (
              <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold">AF</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-blue-700 transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Menu */}
        <div className={`p-4 border-b border-gray-200 bg-gray-50 ${isExpanded ? 'block' : 'lg:hidden block'}`}>
          <SidebarUserMenu />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className={`space-y-1 ${isExpanded ? 'px-3' : 'px-2'}`}>
            {navigationItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={`
                    flex items-center ${isExpanded ? 'px-3' : 'px-2'} py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 relative group
                    ${isActive(item.href)
                      ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  title={!isExpanded ? item.name : ''}
                >
                  <span className={`${isExpanded ? 'mr-3' : 'lg:mx-auto mr-3'} ${isActive(item.href) ? 'text-blue-700' : 'text-gray-500'}`}>
                    {item.icon}
                  </span>
                  <span className={`whitespace-nowrap ${isExpanded ? 'block' : 'lg:hidden block'}`}>
                    {item.name}
                  </span>
                  {!isExpanded && (
                    <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            AM Fincorp
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;