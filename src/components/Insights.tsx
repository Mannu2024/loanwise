import { useState, useEffect } from "react";
import { collection, query, onSnapshot, addDoc, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CreditItem, Insight } from "../types";
import { GoogleGenAI } from "@google/genai";
import { Sparkles, AlertTriangle, Lightbulb, Info, Trash2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";

interface InsightsProps {
  userId: string;
}

export default function Insights({ userId }: InsightsProps) {
  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users", userId, "creditItems"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCredits(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CreditItem)));
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const q = query(collection(db, "users", userId, "insights"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInsights(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Insight)));
    });
    return () => unsubscribe();
  }, [userId]);

  const generateInsights = async () => {
    if (credits.length === 0) return;
    setGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Analyze the following credit/loan data and provide 3-4 actionable financial insights. 
      Format each insight as a JSON object with: title, description, type (warning, suggestion, info).
      
      Data: ${JSON.stringify(credits.map(c => ({
        bank: c.bankName,
        type: c.type,
        balance: c.balance,
        interest: c.interestRate,
        emi: c.emi
      })))}
      
      Return ONLY a JSON array of objects.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const newInsights = JSON.parse(response.text || "[]");
      
      // Clear old insights and add new ones
      for (const insight of insights) {
        await deleteDoc(doc(db, "users", userId, "insights", insight.uid));
      }

      for (const item of newInsights) {
        await addDoc(collection(db, "users", userId, "insights"), {
          ...item,
          uid: crypto.randomUUID(),
          userId,
          createdAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error("Error generating insights:", error);
    } finally {
      setGenerating(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "warning": return AlertTriangle;
      case "suggestion": return Lightbulb;
      default: return Info;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "warning": return "rose";
      case "suggestion": return "amber";
      default: return "blue";
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Insights</h1>
          <p className="text-slate-500 mt-1">Personalized suggestions to optimize your debt.</p>
        </div>
        <button
          onClick={generateInsights}
          disabled={generating || credits.length === 0}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {generating ? "Analyzing..." : "Refresh Insights"}
        </button>
      </header>

      {credits.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <Info className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No data to analyze</h3>
          <p className="text-slate-500 max-w-md mx-auto">Add some credit cards or loans first so our AI can provide personalized insights for you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {insights.map((insight, i) => {
              const Icon = getIcon(insight.type);
              const color = getColor(insight.type);
              return (
                <motion.div
                  key={insight.uid}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group`}
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full bg-${color}-500`}></div>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-${color}-50`}>
                      <Icon className={`w-6 h-6 text-${color}-600`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{insight.title}</h3>
                      <div className="text-slate-600 text-sm leading-relaxed prose prose-slate max-w-none">
                        <ReactMarkdown>{insight.description}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {insights.length === 0 && !generating && credits.length > 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">Click "Refresh Insights" to get AI-powered suggestions.</p>
        </div>
      )}
    </div>
  );
}
