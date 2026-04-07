import { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, deleteDoc, addDoc, setDoc, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { CreditItem, CreditType } from "../types";
import { formatCurrency, formatPercent, cn } from "../lib/utils";
import { Plus, Trash2, Edit2, CreditCard, Landmark, GraduationCap, Car, Home, MoreHorizontal, Filter, Search, Calendar, ChevronRight, X, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface CreditListProps {
  userId: string;
}

export default function CreditList({ userId }: CreditListProps) {
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CreditItem | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<CreditItem | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<CreditItem | null>(null);
  const [filter, setFilter] = useState<CreditType | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "this_month" | "next_3_months">("all");
  const [sortBy, setSortBy] = useState<"none" | "emi_asc" | "emi_desc">("none");
  const [search, setSearch] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const calculateProjectedInterest = (item: CreditItem) => {
    let currentBalance = item.balance;
    const monthlyRate = (item.interestRate / 100) / 12;
    const emi = item.emi || 0;
    let totalInterest = 0;
    
    if (emi <= 0 || currentBalance <= 0) return 0;
    
    for (let i = 1; i <= 360 && currentBalance > 0; i++) {
      const interestPayment = currentBalance * monthlyRate;
      const principalPayment = Math.min(emi - interestPayment, currentBalance);
      
      if (emi <= interestPayment) break;

      totalInterest += interestPayment;
      currentBalance -= principalPayment;
    }
    return totalInterest;
  };

  const totalPrincipal = credits.reduce((sum, item) => sum + item.balance, 0);
  const totalProjectedInterest = credits.reduce((sum, item) => sum + calculateProjectedInterest(item), 0);
  const totalPortfolioCost = totalPrincipal + totalProjectedInterest;

  const portfolioData = [
    { name: "Principal", value: totalPrincipal, color: "#4f46e5" },
    { name: "Projected Interest", value: totalProjectedInterest, color: "#f43f5e" }
  ];

  useEffect(() => {
    const q = query(collection(db, "users", userId, "creditItems"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCredits(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CreditItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/creditItems`);
    });
    return () => unsubscribe();
  }, [userId]);

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "users", userId, "creditItems", itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/creditItems/${itemToDelete}`);
    }
  };

  const handleEdit = (item: CreditItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const filteredCredits = credits.filter(item => {
    const matchesFilter = filter === "all" || item.type === filter;
    const matchesSearch = item.bankName.toLowerCase().includes(search.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter !== "all" && item.nextEmiDate) {
      const nextDate = new Date(item.nextEmiDate);
      const now = new Date();
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const next3MonthsEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      
      if (dateFilter === "this_month") {
        matchesDate = nextDate <= thisMonthEnd && nextDate >= new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateFilter === "next_3_months") {
        matchesDate = nextDate <= next3MonthsEnd && nextDate >= now;
      }
    }
    
    return matchesFilter && matchesSearch && matchesDate;
  }).sort((a, b) => {
    if (sortBy === "none") return 0;
    const dateA = a.nextEmiDate ? new Date(a.nextEmiDate).getTime() : Infinity;
    const dateB = b.nextEmiDate ? new Date(b.nextEmiDate).getTime() : Infinity;
    return sortBy === "emi_asc" ? dateA - dateB : dateB - dateA;
  });

  const getIcon = (type: CreditType) => {
    switch (type) {
      case "credit_card": return CreditCard;
      case "personal_loan": return Landmark;
      case "home_loan": return Home;
      case "auto_loan": return Car;
      case "education_loan": return GraduationCap;
      default: return MoreHorizontal;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Credit & Loans</h1>
          <p className="text-slate-500 mt-1">Manage all your credit cards and loan accounts.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add New Credit
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by bank name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-transparent outline-none text-sm font-medium text-slate-600"
          >
            <option value="all">All Types</option>
            <option value="credit_card">Credit Cards</option>
            <option value="personal_loan">Personal Loans</option>
            <option value="home_loan">Home Loans</option>
            <option value="auto_loan">Auto Loans</option>
            <option value="education_loan">Education Loans</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-transparent outline-none text-sm font-medium text-slate-600"
          >
            <option value="all">All Dates</option>
            <option value="this_month">This Month</option>
            <option value="next_3_months">Next 3 Months</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent outline-none text-sm font-medium text-slate-600"
          >
            <option value="none">No Sorting</option>
            <option value="emi_asc">EMI Date (Soonest)</option>
            <option value="emi_desc">EMI Date (Latest)</option>
          </select>
        </div>
      </div>

      {/* Portfolio Summary Section */}
      {credits.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative"
        >
          <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
            <div className="w-full lg:w-1/3 flex flex-col items-center">
              <h3 className="text-lg font-bold text-slate-900 mb-6 text-center">Portfolio Cost Breakdown</h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioData}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {portfolioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Principal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Interest</span>
                </div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Principal</p>
                <p className="text-3xl font-black text-slate-900">{formatCurrency(totalPrincipal)}</p>
                <p className="text-xs text-slate-500 mt-2">Current outstanding balance</p>
              </div>
              <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col justify-center">
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Projected Interest</p>
                <p className="text-3xl font-black text-rose-700">{formatCurrency(totalProjectedInterest)}</p>
                <p className="text-xs text-rose-600 mt-2">Total interest over loan terms</p>
              </div>
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col justify-center">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Total Portfolio Cost</p>
                <p className="text-3xl font-black text-indigo-700">{formatCurrency(totalPortfolioCost)}</p>
                <p className="text-xs text-indigo-600 mt-2">Principal + Projected Interest</p>
              </div>
            </div>
          </div>
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 opacity-50 z-0"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-full -ml-16 -mb-16 opacity-50 z-0"></div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredCredits.map((item) => {
            const Icon = getIcon(item.type);
            return (
              <motion.div
                layout
                key={item.uid}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-indigo-50 transition-colors">
                      <Icon className="w-6 h-6 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{item.bankName}</h3>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{item.type.replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.uid)}
                      className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Outstanding Balance</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(item.balance)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 mb-1">Interest Rate</p>
                      <p className="text-lg font-bold text-indigo-600">{formatPercent(item.interestRate)}</p>
                    </div>
                  </div>

                  {item.emi > 0 && (
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-indigo-600 font-medium">Balance after next EMI</span>
                        <span className="text-slate-400">Projected</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className="text-lg font-bold text-slate-900">
                          {(() => {
                            const monthlyRate = (item.interestRate / 100) / 12;
                            const interest = item.balance * monthlyRate;
                            const principal = Math.min(item.emi - interest, item.balance);
                            return formatCurrency(Math.max(0, item.balance - principal));
                          })()}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                          -{(() => {
                            const monthlyRate = (item.interestRate / 100) / 12;
                            const interest = item.balance * monthlyRate;
                            return formatCurrency(Math.min(item.emi - interest, item.balance));
                          })()} principal
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-50 flex justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-xs">Monthly EMI</span>
                      <span className="font-semibold text-slate-700">{item.emi ? formatCurrency(item.emi) : "N/A"}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-slate-400 text-xs">Next EMI Date</span>
                      <span className="font-semibold text-slate-700">{item.nextEmiDate || item.dueDate || "N/A"}</span>
                    </div>
                  </div>

                  {item.type !== "credit_card" && (
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">EMIs Paid/Left</p>
                        <p className="text-sm font-bold text-slate-700">{item.emiPaid || 0} / {item.emiLeft || 0}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Foreclosure</p>
                        <p className="text-sm font-bold text-indigo-600">{item.foreclosureAmount ? formatCurrency(item.foreclosureAmount) : "N/A"}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Start Date</p>
                        <p className="text-xs font-semibold text-slate-600">{item.emiStartDate || "N/A"}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">End Date</p>
                        <p className="text-xs font-semibold text-slate-600">{item.emiEndDate || "N/A"}</p>
                      </div>
                      {item.totalAmountTaken && (
                        <div className="col-span-2 p-2 bg-slate-50 rounded-lg flex justify-between items-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Loan Amount</p>
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(item.totalAmountTaken)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setSelectedSchedule(item)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-100 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </button>
                    <button
                      onClick={() => setSelectedHistory(item)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      History
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <CreditModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        userId={userId} 
        initialData={editingItem}
      />

      <RepaymentScheduleModal
        item={selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
      />

      {selectedHistory && (
        <PaymentHistoryModal
          userId={userId}
          item={selectedHistory}
          onClose={() => setSelectedHistory(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Delete Credit</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this credit item? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentHistoryModal({ userId, item, onClose }: { userId: string, item: CreditItem, onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date) return;
    setSaving(true);

    try {
      const newRecord = {
        date,
        amount: parseFloat(amount),
        note: note || undefined
      };
      const updatedHistory = [...(item.paymentHistory || []), newRecord];
      await setDoc(doc(db, "users", userId, "creditItems", item.uid), {
        ...item,
        paymentHistory: updatedHistory
      });
      setAmount("");
      setNote("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/creditItems/${item.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{item.bankName} - Payment History</h2>
            <p className="text-sm text-slate-500">Track your past EMI payments</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-lg text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <form onSubmit={handleAddPayment} className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Add New Payment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Amount Paid</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Payment Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-500">Note (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Paid via UPI"
                />
              </div>
            </div>
            <button
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Past Records</h3>
            {!item.paymentHistory || item.paymentHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500">No payment records found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {item.paymentHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record, i) => (
                  <div key={i} className="p-4 bg-white border border-slate-100 rounded-xl flex justify-between items-center hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{formatCurrency(record.amount)}</p>
                        <p className="text-xs text-slate-500">{record.date}</p>
                      </div>
                    </div>
                    {record.note && (
                      <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                        {record.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RepaymentScheduleModal({ item, onClose }: { item: CreditItem | null, onClose: () => void }) {
  const [extraPayment, setExtraPayment] = useState<number>(0);

  if (!item) return null;

  const generateSchedule = (extra: number = 0) => {
    const schedule = [];
    let currentBalance = item.balance;
    const monthlyRate = (item.interestRate / 100) / 12;
    const emi = item.emi || 0;
    const totalMonthlyPayment = emi + extra;
    const startDate = new Date();
    
    if (emi <= 0 || currentBalance <= 0) return [];

    for (let i = 1; i <= 360 && currentBalance > 0; i++) {
      const interestPayment = currentBalance * monthlyRate;
      const principalPayment = Math.min(totalMonthlyPayment - interestPayment, currentBalance);
      
      if (totalMonthlyPayment <= interestPayment && i === 1) {
        return [{
          month: 1,
          date: "N/A",
          payment: totalMonthlyPayment,
          interest: interestPayment,
          principal: 0,
          remaining: currentBalance,
          error: "Total payment is too low to cover interest. Debt will increase."
        }];
      }

      currentBalance -= principalPayment;
      
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);

      schedule.push({
        month: i,
        date: paymentDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        payment: totalMonthlyPayment,
        interest: interestPayment,
        principal: principalPayment,
        remaining: Math.max(0, currentBalance)
      });

      if (currentBalance <= 0) break;
    }
    return schedule;
  };

  const normalSchedule = generateSchedule(0);
  const acceleratedSchedule = generateSchedule(extraPayment);
  
  const timeSaved = normalSchedule.length - acceleratedSchedule.length;
  const interestSaved = normalSchedule.reduce((sum, r) => sum + r.interest, 0) - acceleratedSchedule.reduce((sum, r) => sum + r.interest, 0);

  const totalPrincipal = item.balance;
  const totalInterest = acceleratedSchedule.reduce((sum, r) => sum + r.interest, 0);
  const totalCost = totalPrincipal + totalInterest;

  const comparisonData = [
    { name: "Principal", value: totalPrincipal, color: "#4f46e5" },
    { name: "Interest", value: totalInterest, color: "#f43f5e" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{item.bankName} - Payoff Calculator</h2>
            <p className="text-sm text-slate-500">See how extra payments speed up your debt-free journey</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-lg text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Payoff Calculator Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Extra Payment
              </h3>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Monthly Extra Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={extraPayment || ""}
                    onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-indigo-100">
                <p className="text-xs font-bold text-indigo-400 uppercase mb-3">Total Cost Breakdown</p>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={comparisonData}
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {comparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    <span className="text-slate-500">Principal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-slate-500">Interest</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Time Saved</p>
                  <p className="text-3xl font-black text-emerald-700">{timeSaved} <span className="text-sm font-bold">Months</span></p>
                  <p className="text-xs text-emerald-600 mt-2 font-medium">Pay off by {acceleratedSchedule[acceleratedSchedule.length - 1]?.date || "N/A"}</p>
                </div>
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Interest Saved</p>
                  <p className="text-3xl font-black text-blue-700">{formatCurrency(Math.max(0, interestSaved))}</p>
                  <p className="text-xs text-blue-600 mt-2 font-medium">Total interest: {formatCurrency(totalInterest)}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Cost</p>
                  <p className="text-3xl font-black text-slate-900">{formatCurrency(totalCost)}</p>
                  <p className="text-xs text-slate-400 mt-2 font-medium">Principal + Interest</p>
                </div>
              </div>

              {acceleratedSchedule.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No schedule available. Please ensure EMI and Balance are correctly set.
                </div>
              ) : acceleratedSchedule[0].error ? (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  {acceleratedSchedule[0].error}
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="py-4 pl-6">Month</th>
                        <th className="py-4">Date</th>
                        <th className="py-4 text-right">Total Payment</th>
                        <th className="py-4 text-right">Principal</th>
                        <th className="py-4 text-right">Interest</th>
                        <th className="py-4 text-right pr-6">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {acceleratedSchedule.slice(0, 24).map((row) => (
                        <tr key={row.month} className="text-sm hover:bg-slate-50 transition-colors">
                          <td className="py-4 pl-6 font-medium text-slate-500">#{row.month}</td>
                          <td className="py-4 font-semibold text-slate-900">{row.date}</td>
                          <td className="py-4 text-right text-slate-600">{formatCurrency(row.payment)}</td>
                          <td className="py-4 text-right text-emerald-600 font-medium">{formatCurrency(row.principal)}</td>
                          <td className="py-4 text-right text-rose-500">{formatCurrency(row.interest)}</td>
                          <td className="py-4 text-right font-bold text-slate-900 pr-6">{formatCurrency(row.remaining)}</td>
                        </tr>
                      ))}
                      {acceleratedSchedule.length > 24 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 text-xs font-medium bg-slate-50/30 italic">
                            ... and {acceleratedSchedule.length - 24} more months until debt-free ...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CreditModal({ isOpen, onClose, userId, initialData }: { isOpen: boolean, onClose: () => void, userId: string, initialData?: CreditItem | null }) {
  const [formData, setFormData] = useState({
    bankName: "",
    type: "credit_card" as CreditType,
    limit: "",
    balance: "",
    interestRate: "",
    emi: "",
    dueDate: "",
    billingDate: "",
    tenure: "",
    totalAmountTaken: "",
    emiStartDate: "",
    emiEndDate: "",
    nextEmiDate: "",
    emiPaid: "",
    emiLeft: "",
    foreclosureAmount: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        bankName: initialData.bankName,
        type: initialData.type,
        limit: initialData.limit?.toString() || "",
        balance: initialData.balance.toString(),
        interestRate: initialData.interestRate.toString(),
        emi: initialData.emi?.toString() || "",
        dueDate: initialData.dueDate || "",
        billingDate: initialData.billingDate || "",
        tenure: initialData.tenure?.toString() || "",
        totalAmountTaken: initialData.totalAmountTaken?.toString() || "",
        emiStartDate: initialData.emiStartDate || "",
        emiEndDate: initialData.emiEndDate || "",
        nextEmiDate: initialData.nextEmiDate || "",
        emiPaid: initialData.emiPaid?.toString() || "",
        emiLeft: initialData.emiLeft?.toString() || "",
        foreclosureAmount: initialData.foreclosureAmount?.toString() || "",
      });
    } else {
      setFormData({
        bankName: "",
        type: "credit_card",
        limit: "",
        balance: "",
        interestRate: "",
        emi: "",
        dueDate: "",
        billingDate: "",
        tenure: "",
        totalAmountTaken: "",
        emiStartDate: "",
        emiEndDate: "",
        nextEmiDate: "",
        emiPaid: "",
        emiLeft: "",
        foreclosureAmount: "",
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = `users/${userId}/creditItems`;
    try {
      const creditItem = {
        bankName: formData.bankName,
        type: formData.type,
        limit: formData.limit ? parseFloat(formData.limit) : 0,
        balance: parseFloat(formData.balance) || 0,
        interestRate: parseFloat(formData.interestRate) || 0,
        emi: formData.emi ? parseFloat(formData.emi) : 0,
        dueDate: formData.dueDate || "",
        billingDate: formData.billingDate || "",
        tenure: formData.tenure ? parseInt(formData.tenure) : 0,
        totalAmountTaken: formData.totalAmountTaken ? parseFloat(formData.totalAmountTaken) : 0,
        emiStartDate: formData.emiStartDate || "",
        emiEndDate: formData.emiEndDate || "",
        nextEmiDate: formData.nextEmiDate || "",
        emiPaid: formData.emiPaid ? parseInt(formData.emiPaid) : 0,
        emiLeft: formData.emiLeft ? parseInt(formData.emiLeft) : 0,
        foreclosureAmount: formData.foreclosureAmount ? parseFloat(formData.foreclosureAmount) : 0,
        paymentHistory: initialData?.paymentHistory || [],
        uid: initialData?.uid || crypto.randomUUID(),
        userId,
        createdAt: initialData?.createdAt || Timestamp.now(),
      };

      console.log("Saving credit item to path:", path, creditItem);
      try {
        await setDoc(doc(db, path, creditItem.uid), creditItem);
      } catch (err) {
        console.error("Firestore setDoc error details:", err);
        handleFirestoreError(err, OperationType.WRITE, path);
      }

      onClose();
    } catch (error) {
      console.error("Error saving credit item:", error);
      alert("Failed to save credit item. Please check your inputs.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-900">{initialData ? 'Edit Credit Item' : 'Add New Credit Item'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-lg text-slate-400 transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Bank / Lender Name</label>
            <input
              required
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. HDFC Bank"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Credit Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CreditType })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="credit_card">Credit Card</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="home_loan">Home Loan</option>
              <option value="auto_loan">Auto Loan</option>
              <option value="education_loan">Education Loan</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Outstanding Balance</label>
            <input
              required
              type="number"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Interest Rate (%)</label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.interestRate}
              onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. 12.5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Credit Limit / Loan Amount</label>
            <input
              type="number"
              value={formData.limit}
              onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Monthly EMI / Min Due</label>
            <input
              type="number"
              value={formData.emi}
              onChange={(e) => setFormData({ ...formData, emi: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Payment Due Date</label>
            <input
              type="text"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. 15th of month"
            />
          </div>

          {formData.type === "credit_card" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Billing Date</label>
              <input
                type="text"
                value={formData.billingDate}
                onChange={(e) => setFormData({ ...formData, billingDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. 1st of month"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Tenure (Months)</label>
            <input
              type="number"
              min="0"
              max="600"
              value={formData.tenure}
              onChange={(e) => setFormData({ ...formData, tenure: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="For loans"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Total Amount Taken</label>
            <input
              type="number"
              min="0"
              value={formData.totalAmountTaken}
              onChange={(e) => setFormData({ ...formData, totalAmountTaken: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Original loan amount"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">EMI Start Date</label>
            <input
              type="date"
              value={formData.emiStartDate}
              onChange={(e) => {
                const startDate = e.target.value;
                const tenure = parseInt(formData.tenure) || 0;
                let emiPaid = "";
                let emiLeft = "";
                let emiEndDate = "";

                if (startDate && tenure > 0) {
                  const start = new Date(startDate);
                  const now = new Date();
                  const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                  const paid = Math.max(0, Math.min(tenure, diffMonths));
                  emiPaid = paid.toString();
                  emiLeft = (tenure - paid).toString();
                  
                  const end = new Date(start);
                  end.setMonth(start.getMonth() + tenure);
                  emiEndDate = end.toISOString().split('T')[0];
                }

                setFormData({ 
                  ...formData, 
                  emiStartDate: startDate,
                  emiPaid: emiPaid || formData.emiPaid,
                  emiLeft: emiLeft || formData.emiLeft,
                  emiEndDate: emiEndDate || formData.emiEndDate
                });
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">EMI End Date</label>
            <input
              type="date"
              value={formData.emiEndDate}
              onChange={(e) => setFormData({ ...formData, emiEndDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Next EMI Date</label>
            <input
              type="date"
              value={formData.nextEmiDate}
              onChange={(e) => setFormData({ ...formData, nextEmiDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">EMIs Paid</label>
            <input
              type="number"
              min="0"
              value={formData.emiPaid}
              onChange={(e) => setFormData({ ...formData, emiPaid: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Number of EMIs paid"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">EMIs Left</label>
            <input
              type="number"
              min="0"
              value={formData.emiLeft}
              onChange={(e) => setFormData({ ...formData, emiLeft: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Remaining EMIs"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Foreclosure Amount</label>
            <input
              type="number"
              min="0"
              value={formData.foreclosureAmount}
              onChange={(e) => setFormData({ ...formData, foreclosureAmount: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Current foreclosure value"
            />
          </div>

          {formData.balance && formData.interestRate && formData.emi && (
            <div className="md:col-span-2 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-900">Projected Next Month</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Live Calculation</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">Balance After EMI</p>
                  <p className="text-xl font-black text-indigo-900">
                    {(() => {
                      const balance = parseFloat(formData.balance) || 0;
                      const rate = parseFloat(formData.interestRate) || 0;
                      const emi = parseFloat(formData.emi) || 0;
                      const monthlyRate = (rate / 100) / 12;
                      const interest = balance * monthlyRate;
                      const principal = Math.min(emi - interest, balance);
                      return formatCurrency(Math.max(0, balance - principal));
                    })()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">Interest Component</p>
                  <p className="text-xl font-black text-rose-600">
                    {(() => {
                      const balance = parseFloat(formData.balance) || 0;
                      const rate = parseFloat(formData.interestRate) || 0;
                      const monthlyRate = (rate / 100) / 12;
                      return formatCurrency(balance * monthlyRate);
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 sticky bottom-0 z-10 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              Save Credit Item
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

