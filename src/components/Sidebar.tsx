import React from "react";
import {
  LayoutDashboard,
  Sparkles,
  KeyRound,
  Users,
  MessageSquare,
  ScrollText,
  BarChart3,
  Settings,
  FolderCode,
  CheckCircle2,
  Layers,
  Zap
} from "lucide-react";

export type TabType =
  | "dashboard"
  | "tester"
  | "keywords"
  | "recipients"
  | "groups"
  | "logs"
  | "stats"
  | "settings"
  | "files";

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeKeywordsCount: number;
  activeRecipientsCount: number;
  groupsCount: number;
  logsCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeKeywordsCount,
  activeRecipientsCount,
  groupsCount,
  logsCount,
  isOpenMobile,
  onCloseMobile
}) => {
  const menuItems = [
    {
      id: "dashboard" as TabType,
      label: "لوحة التحكم (Dashboard)",
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: "tester" as TabType,
      label: "مختبر الفحص المباشر",
      icon: Sparkles,
      badge: "LIVE",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    },
    {
      id: "keywords" as TabType,
      label: "الكلمات المفتاحية (Keywords)",
      icon: KeyRound,
      badge: activeKeywordsCount,
      badgeColor: "bg-white/10 text-slate-200 border-white/10"
    },
    {
      id: "recipients" as TabType,
      label: "المستلمون (Recipients)",
      icon: Users,
      badge: activeRecipientsCount,
      badgeColor: "bg-white/10 text-slate-200 border-white/10"
    },
    {
      id: "groups" as TabType,
      label: "المجموعات المراقبة (Groups)",
      icon: MessageSquare,
      badge: groupsCount,
      badgeColor: "bg-white/10 text-slate-200 border-white/10"
    },
    {
      id: "logs" as TabType,
      label: "سجل العمليات (Logs)",
      icon: ScrollText,
      badge: logsCount > 0 ? `${logsCount}` : null,
      badgeColor: "bg-white/10 text-slate-300 border-white/10"
    },
    {
      id: "stats" as TabType,
      label: "الإحصائيات والتحليلات",
      icon: BarChart3,
      badge: null
    },
    {
      id: "settings" as TabType,
      label: "إعدادات النظام (Settings)",
      icon: Settings,
      badge: null
    },
    {
      id: "files" as TabType,
      label: "ملفات الإنتاج والـ VPS",
      icon: FolderCode,
      badge: "Docker",
      badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20"
    }
  ];

  const handleSelect = (id: TabType) => {
    onTabChange(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-64 bg-[#0a0c10] border-l border-white/5 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } lg:static lg:z-10`}
      >
        {/* Header inside sidebar for mobile */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between lg:hidden">
          <span className="font-bold text-sm text-white">القائمة الرئيسية</span>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
            أقسام النظام / NAVIGATION
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between rounded-lg px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "opacity-60"}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span
                    className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
                      item.badgeColor || "bg-white/5 text-slate-300 border-white/10"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Info Card (Matching Mode from Immersive UI) */}
        <div className="p-4 border-t border-white/5">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-1">
              Matching Mode
            </p>
            <p className="text-xs text-blue-100 font-medium">
              1 Keyword Threshold (Enabled)
            </p>
            <p className="text-[10px] text-blue-300/70 mt-1 leading-relaxed">
              يكفي تطابق كلمة واحدة لإعادة التوجيه الفوري.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
