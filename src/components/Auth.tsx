import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { CreditCard, ShieldCheck, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

export default function Auth() {
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">CreditWise</h1>
        <p className="text-slate-600 mb-8">Optimize your credit, reduce interest, and stay organized.</p>

        <div className="space-y-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-100 p-1.5 rounded-lg mt-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Secure Tracking</h3>
              <p className="text-slate-500 text-xs">All your loans and cards in one secure place.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-1.5 rounded-lg mt-0.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Smart Insights</h3>
              <p className="text-slate-500 text-xs">AI-powered suggestions to save on interest.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>

        <p className="mt-6 text-xs text-slate-400">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
