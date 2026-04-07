import { useState } from "react";
import { ReactNode } from "react";
import { UserProfile } from "../types";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { LayoutDashboard, CreditCard, Sparkles, FileUp, LogOut, User as UserIcon, Menu, X, MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  userProfile: UserProfile | null;
}

export default function Layout({ children, activeTab, setActiveTab, userProfile }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleSignOut = () => signOut(auth);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "credits", label: "Credits & Loans", icon: CreditCard },
    { id: "insights", label: "AI Insights", icon: Sparkles },
    { id: "advisor", label: "AI Advisor", icon: MessageSquare },
    { id: "upload", label: "Upload Docs", icon: FileUp },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">CreditWise</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar (Desktop & Mobile) */}
      <AnimatePresence>
        {(isMobileMenuOpen || typeof window !== "undefined" && window.innerWidth >= 768) && (
          <>
            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
              />
            )}

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className={cn(
                "w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50 md:z-0",
                "md:relative md:translate-x-0"
              )}
            >
              <div className="p-6 hidden md:flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-slate-900 tracking-tight">CreditWise</span>
              </div>

              <nav className="flex-1 px-4 space-y-1 mt-4">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                      activeTab === item.id
                        ? "bg-indigo-50 text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5 transition-colors",
                      activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                    )} />
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <div className="flex items-center gap-3 px-4 py-3 mb-4">
                  {userProfile?.photoURL ? (
                    <img src={userProfile.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{userProfile?.displayName || "User"}</p>
                    <p className="text-xs text-slate-500 truncate">{userProfile?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-73px)] md:h-screen w-full">
        <div className="max-w-6xl mx-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
