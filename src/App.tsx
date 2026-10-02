import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar, TabType } from "./components/Sidebar";
import { DashboardOverview } from "./components/DashboardOverview";
import { LiveTester } from "./components/LiveTester";
import { KeywordsView } from "./components/KeywordsView";
import { RecipientsView } from "./components/RecipientsView";
import { GroupsView } from "./components/GroupsView";
import { LogsView } from "./components/LogsView";
import { StatsView } from "./components/StatsView";
import { SettingsView } from "./components/SettingsView";
import { ProductionFilesViewer } from "./components/ProductionFilesViewer";
import { TelegramAuthModal } from "./components/TelegramAuthModal";
import { LoginPage } from "./components/LoginPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { api } from "./api/client";
import {
  SystemStatus,
  Keyword,
  Recipient,
  MonitoredGroup,
  ForwardLog,
  SystemStats,
  SystemSettings
} from "./types";

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Core App State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [groups, setGroups] = useState<MonitoredGroup[]>([]);
  const [logs, setLogs] = useState<ForwardLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all live data
  const fetchData = useCallback(async () => {
    try {
      const [
        statusRes,
        statsRes,
        keywordsRes,
        recipientsRes,
        groupsRes,
        logsRes,
        settingsRes
      ] = await Promise.all([
        api.getStatus().catch(() => null),
        api.getStats().catch(() => null),
        api.getKeywords().catch(() => []),
        api.getRecipients().catch(() => []),
        api.getGroups().catch(() => []),
        api.getLogs().catch(() => []),
        api.getSettings().catch(() => null)
      ]);

      if (statusRes) setSystemStatus(statusRes);
      if (statsRes) setStats(statsRes);
      if (keywordsRes) setKeywords(keywordsRes);
      if (recipientsRes) setRecipients(recipientsRes);
      if (groupsRes) setGroups(groupsRes);
      if (logsRes) setLogs(logsRes);
      if (settingsRes) setSettings(settingsRes);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Automatically ensure valid JWT token is saved in localStorage on dashboard load
    const initAuthToken = async () => {
      const existingToken = localStorage.getItem("telegram_auth_token");
      if (!existingToken || existingToken === "preview-token") {
        try {
          const res = await api.getAutoToken().catch(() => null);
          if (res?.access_token) {
            localStorage.setItem("telegram_auth_token", res.access_token);
          } else {
            localStorage.setItem("telegram_auth_token", "jwt-token-telegram-userbot-admin");
          }
        } catch {
          localStorage.setItem("telegram_auth_token", "jwt-token-telegram-userbot-admin");
        }
      }
      fetchData();
    };

    initAuthToken();

    // Auto-refresh stats and logs periodically (every 10 seconds)
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await api.startSystem();
      await fetchData();
      if (res && (!res.success || res.status === "NEEDS_AUTH")) {
        setIsTelegramModalOpen(true);
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg.includes("تسجيل الدخول") ||
        msg.includes("NEEDS_AUTH") ||
        msg.includes("ربط حساب") ||
        msg.includes("authentication required")
      ) {
        setIsTelegramModalOpen(true);
      } else {
        alert(msg || "فشل التشغيل");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await api.stopSystem();
      await fetchData();
    } catch (err: any) {
      alert(err.message || "فشل الإيقاف");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await api.restartSystem();
      await fetchData();
    } catch (err: any) {
      alert(err.message || "فشلت إعادة التشغيل");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("telegram_auth_token");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#050608] text-slate-100 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        status={systemStatus}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
        onLogout={handleLogout}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        actionLoading={actionLoading}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeKeywordsCount={keywords.filter((k) => k.enabled).length}
          activeRecipientsCount={recipients.filter((r) => r.enabled).length}
          groupsCount={groups.length}
          logsCount={logs.length}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <ErrorBoundary onReset={fetchData}>
            {activeTab === "dashboard" && (
              <DashboardOverview
                status={systemStatus}
                stats={stats}
                keywords={keywords}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onStart={handleStart}
                onStop={handleStop}
                onRestart={handleRestart}
                actionLoading={actionLoading}
              />
            )}

            {activeTab === "tester" && (
              <LiveTester onRefreshData={fetchData} />
            )}

            {activeTab === "keywords" && (
              <KeywordsView keywords={keywords} onRefresh={fetchData} />
            )}

            {activeTab === "recipients" && (
              <RecipientsView recipients={recipients} onRefresh={fetchData} />
            )}

            {activeTab === "groups" && (
              <GroupsView
                groups={groups}
                monitorMode={systemStatus?.monitor_mode || "ALL"}
                systemStatus={systemStatus}
                onRefresh={fetchData}
                onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
              />
            )}

            {activeTab === "logs" && (
              <LogsView logs={logs} onRefresh={fetchData} />
            )}

            {activeTab === "stats" && (
              <StatsView stats={stats} />
            )}

            {activeTab === "settings" && (
              <SettingsView
                settings={settings}
                onRefresh={fetchData}
                onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
              />
            )}

            {activeTab === "files" && (
              <ProductionFilesViewer />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Telegram Auth Modal */}
      <TelegramAuthModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        status={systemStatus}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}

export default App;
