'use client';

import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

    const openSidebar = () => {
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Handle sidebar expansion state changes
  useEffect(() => {
    const handleSidebarExpansion = (event: CustomEvent) => {
      setSidebarExpanded(event.detail.expanded);
    };

    window.addEventListener('sidebarExpansion', handleSidebarExpansion as EventListener);
    return () => {
      window.removeEventListener('sidebarExpansion', handleSidebarExpansion as EventListener);
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onOpen={openSidebar} onClose={closeSidebar} />

      {/* Main Content Area */}
      <div className={`flex flex-col flex-1 min-w-0 min-h-0 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {/* Header */}
        <Header onMenuToggle={toggleSidebar} />

        {/* Page Content */}
        <main className="flex flex-1 min-h-0 w-full flex-col overflow-y-auto pt-4 pr-3 sm:pt-4 sm:pr-4 has-[.messages-fullscreen]:overflow-hidden has-[.messages-fullscreen]:p-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
