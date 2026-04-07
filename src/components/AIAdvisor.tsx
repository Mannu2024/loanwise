import { useState, useEffect, useRef } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CreditItem } from "../types";
import { GoogleGenAI } from "@google/genai";
import { Send, Bot, User as UserIcon, Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import { motion } from "motion/react";

interface AIAdvisorProps {
  userId: string;
}

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
}

export default function AIAdvisor({ userId }: AIAdvisorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      text: "Hello! I am your AI Financial Advisor. I have analyzed your portfolio. Ask me anything about your credit cards, loans, or overall financial health!"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [portfolioData, setPortfolioData] = useState<CreditItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      const q = query(collection(db, "users", userId, "creditItems"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => doc.data() as CreditItem);
      setPortfolioData(items);
    };
    fetchPortfolio();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const systemInstruction = `You are an expert financial advisor. The user is asking a question about their financial portfolio. 
      Here is their current portfolio data in JSON format:
      ${JSON.stringify(portfolioData, null, 2)}
      
      Please analyze this data and answer the user's question in detail. Be helpful, clear, and format your response using Markdown for readability. Do not expose the raw JSON to the user, but use the data to provide specific insights, calculations, and advice.`;

      const contents = [
        ...messages.filter(m => m.id !== "welcome").map(m => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }]
        })),
        { role: "user", parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
        }
      });

      setMessages(prev => [...prev, { id: Date.now().toString(), role: "model", text: response.text || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      console.error("Error generating AI response:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "model", text: "I'm sorry, I encountered an error while analyzing your portfolio. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Bot className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">AI Financial Advisor</h2>
          <p className="text-xs text-slate-500">Ask anything about your portfolio</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-indigo-600" : "bg-emerald-100"}`}>
              {msg.role === "user" ? <UserIcon className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none"}`}>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <div className="markdown-body text-sm prose prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-50">
                  <Markdown>{msg.text}</Markdown>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              <span className="text-sm text-slate-500">Analyzing your portfolio...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g., How much total EMI do I have to pay next month?"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
