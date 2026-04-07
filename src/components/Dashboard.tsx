import { useState, useEffect } from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CreditItem, CreditHealth } from "../types";
import { formatCurrency, formatPercent } from "../lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { TrendingDown, TrendingUp, AlertCircle, CheckCircle2, Wallet, CreditCard as CardIcon, Landmark, Calendar } from "lucide-react";
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
  const [nextMonthEMI, setNextMonthEMI] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "users", userId, "creditItems"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CreditItem));
      setCredits(items);
      calculateHealth(items);
      calculateNextMonthEMI(items);
    });
    return () => unsubscribe();
  }, [userId]);

  const calculateNextMonthEMI = (items: CreditItem[]) => {
    const now = new Date();
    const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
    const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

    const totalNextMonth = items.reduce((sum, item) => {
      // If there's a specific nextEmiDate, check if it's in the next month
      if (item.nextEmiDate) {
        const emiDate = new Date(item.nextEmiDate);
        if (emiDate.getMonth() === nextMonth && emiDate.getFullYear() === nextMonthYear) {
          return sum + (item.emi || 0);
        }
      } else if (item.emi > 0 && item.balance > 0) {
        // If no specific date but has active EMI and balance, assume it's due next month
        return sum + item.emi;
      }
      return sum;
    }, 0);

    setNextMonthEMI(totalNextMonth);
  };

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
    balance: item.balance,
    limit: item.limit || item.totalAmountTaken || item.balance,
    type: item.type
  }));

  const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-8">
      {/* Utilization Alert */}
      {health.utilization > 30 && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-4 text-rose-800"
        >
          <div className="p-2 bg-rose-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-rose-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold">High Credit Utilization Alert</h4>
            <p className="text-sm opacity-90">Your credit utilization is {formatPercent(health.utilization)}, which is above the recommended 30%. This may negatively impact your credit score.</p>
          </div>
          <div className="hidden md:block">
            <button className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all">
              View Credits
            </button>
          </div>
        </motion.div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: "Total Debt", value: formatCurrency(health.totalDebt), icon: Wallet, color: "indigo", trend: "down" },
          { label: "Monthly EMI", value: formatCurrency(health.monthlyEMI), icon: Landmark, color: "blue", trend: "neutral" },
          { label: "Next Month EMI", value: formatCurrency(nextMonthEMI), icon: Calendar, color: "violet", trend: "neutral" },
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
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Debt Distribution</h3>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Balance vs Limit</span>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  cursor={{ fill: "#f8fafc" }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: "20px" }} />
                <Bar dataKey="limit" fill="#e2e8f0" radius={[6, 6, 0, 0]} name="Total Limit/Loan" />
                <Bar dataKey="balance" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Current Balance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization Breakdown */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Credit Mix</h3>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Portfolio</span>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.filter(d => d.balance > 0)}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="balance"
                  stroke="none"
                >
                  {chartData.filter(d => d.balance > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  formatter={(value: number) => [formatCurrency(value), "Balance"]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                />
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
