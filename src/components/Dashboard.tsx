import { useState, useEffect } from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CreditItem, CreditHealth } from "../types";
import { formatCurrency, formatPercent } from "../lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { TrendingDown, TrendingUp, AlertCircle, CheckCircle2, Wallet, CreditCard as CardIcon, Landmark } from "lucide-react";
import { motion } from "motion/react";

interface DashboardProps {
  userId: string;
}

export default function Dashboard({ userId }: DashboardProps) {
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [health, setHealth] = useState<CreditHealth>({
    score: 0,
    utilization: 0,
    totalDebt: 0,
    monthlyEMI: 0,
    avgInterest: 0,
  });

  useEffect(() => {
    const q = query(collection(db, "users", userId, "creditItems"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CreditItem));
      setCredits(items);
      calculateHealth(items);
    });
    return () => unsubscribe();
  }, [userId]);

  const calculateHealth = (items: CreditItem[]) => {
    const totalDebt = items.reduce((sum, item) => sum + item.balance, 0);
    const totalLimit = items.reduce((sum, item) => sum + (item.limit || item.balance), 0);
    const monthlyEMI = items.reduce((sum, item) => sum + (item.emi || 0), 0);
    const avgInterest = items.length > 0 
      ? items.reduce((sum, item) => sum + item.interestRate, 0) / items.length 
      : 0;
    
    const utilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
    
    // Simple custom score logic
    let score = 850;
    score -= utilization * 2;
    score -= (avgInterest > 15 ? (avgInterest - 15) * 10 : 0);
    score = Math.max(300, Math.min(850, Math.round(score)));

    setHealth({ score, utilization, totalDebt, monthlyEMI, avgInterest });
  };

  const chartData = credits.map(item => ({
    name: item.bankName,
    value: item.balance,
    type: item.type
  }));

  const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 mt-1">Here's how your credit health looks today.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Credit Health Score</p>
            <p className="text-2xl font-bold text-indigo-600">{health.score}</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-indigo-100 flex items-center justify-center relative">
             <div 
               className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent transition-all duration-1000"
               style={{ transform: `rotate(${(health.score - 300) / 550 * 360}deg)` }}
             ></div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Debt", value: formatCurrency(health.totalDebt), icon: Wallet, color: "indigo", trend: "down" },
          { label: "Monthly EMI", value: formatCurrency(health.monthlyEMI), icon: Landmark, color: "blue", trend: "neutral" },
          { label: "Avg. Interest", value: formatPercent(health.avgInterest), icon: TrendingDown, color: "emerald", trend: "up" },
          { label: "Utilization", value: formatPercent(health.utilization), icon: CardIcon, color: "amber", trend: "down" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg bg-${stat.color}-50`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              {stat.trend === "down" && <TrendingDown className="w-4 h-4 text-emerald-500" />}
              {stat.trend === "up" && <TrendingUp className="w-4 h-4 text-rose-500" />}
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Debt Distribution */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Debt Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip 
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization Breakdown */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Credit Mix</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Alerts */}
      <div className="bg-indigo-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-2">Smart Optimization Tip</h3>
          <p className="text-indigo-100 max-w-2xl">
            {health.utilization > 30 
              ? "Your credit utilization is high (above 30%). Consider paying down your highest balance first to boost your credit score."
              : "Great job! Your credit utilization is within the ideal range. Keep it up to maintain a strong credit profile."}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-800 rounded-full -mr-32 -mt-32 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-800 rounded-full -ml-16 -mb-16 opacity-50"></div>
      </div>
    </div>
  );
}
