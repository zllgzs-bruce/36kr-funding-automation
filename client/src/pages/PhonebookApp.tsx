import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { BookUser, LogOut, Database, History, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Contacts from "./Contacts";
import EditHistory from "./EditHistory";
import Login from "./Login";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "contacts" | "history";

export default function PhonebookApp() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("contacts");

  const { data: countData } = trpc.contacts.count.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* 左侧：Logo + 标题 */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <BookUser className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">话单数据库</h1>
              {countData !== undefined && (
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Database className="h-2.5 w-2.5" />
                  {countData.toLocaleString()} 条联系人
                </p>
              )}
            </div>
          </div>

          {/* 中间：Tab 导航 */}
          <nav className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("contacts")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === "contacts"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">联系人</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === "history"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">编辑历史</span>
            </button>
          </nav>

          {/* 右侧：用户信息 + 退出 */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "T"}
                </AvatarFallback>
              </Avatar>
              <span>{user?.name || "团队成员"}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">退出</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-4">
        {activeTab === "contacts" ? <Contacts /> : <EditHistory />}
      </main>
    </div>
  );
}
