'use client';

import React, { MutableRefObject } from 'react';
import Dashboard from './Dashboard';
import UnderDevelopment from './UnderDevelopment';
import SystemAdminUniversitiesTab from './SystemAdminUniversitiesTab';
import SystemAdminCompaniesTab from './SystemAdminCompaniesTab';

interface SystemAdminDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  accessToken?: string | null;
  accessTokenRef?: MutableRefObject<string | null>;
}

const SystemAdminDashboard: React.FC<SystemAdminDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
  accessToken,
  accessTokenRef,
}) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'universities':
        return (
          <SystemAdminUniversitiesTab
            accessToken={accessToken ?? ''}
            accessTokenRef={accessTokenRef}
          />
        );
      case 'companies':
        return (
          <SystemAdminCompaniesTab
            accessToken={accessToken ?? ''}
            accessTokenRef={accessTokenRef}
          />
        );
      case 'admins':
      case 'audit':
      default:
        return <UnderDevelopment moduleName={prettyTabName(activeTab)} />;
    }
  };

  return (
    <Dashboard
      title={`Hello, ${currentUserName}`}
      userName={currentUserName}
      userRole={currentUserRoleLabel}
      onToggleSidebar={onToggleSidebar}
    >
      {renderContent()}
    </Dashboard>
  );
};

function prettyTabName(tab: string): string {
  if (!tab) return 'System Admin';
  if (tab === 'admins') return 'System Admins';
  if (tab === 'audit') return 'Audit Log';
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

export default SystemAdminDashboard;
