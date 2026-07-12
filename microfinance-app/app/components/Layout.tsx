'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const isMessagesPage = pathname === '/messages';
  const isLoginPage = pathname === '/login';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
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

  useEffect(() => {
    const handleSidebarExpansion = (event: CustomEvent) => {
      setSidebarExpanded(event.detail.expanded);
    };

    window.addEventListener('sidebarExpansion', handleSidebarExpansion as EventListener);
    return () => {
      window.removeEventListener('sidebarExpansion', handleSidebarExpansion as EventListener);
    };
  }, []);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-surface">
      <Sidebar isOpen={sidebarOpen} onOpen={openSidebar} onClose={closeSidebar} />

      <div className={`flex flex-col flex-1 min-w-0 min-h-0 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-64' : 'lg:ml-16'}`}>
        <Header onMenuToggle={toggleSidebar} />

        <main
          className={`flex flex-1 min-h-0 w-full flex-col ${
            isMessagesPage ? 'overflow-hidden p-0' : 'overflow-y-auto pt-4 pr-3 sm:pt-4 sm:pr-4'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
