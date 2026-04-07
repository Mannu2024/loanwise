import { useState } from "react";
import { signInWithPopup, signInWithCustomToken, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { CreditCard, ShieldCheck, TrendingUp, Mail, Lock, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type AuthStep = "initial" | "otp" | "password";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<AuthStep>("initial");
  const [isNewUser, setIsNewUser] = useState(false);
  const [customToken, setCustomToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.success) {
        setStep("otp");
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (data.success) {
        setIsNewUser(data.isNewUser);
        if (data.isNewUser) {
          setStep("password");
        } else if (data.customToken) {
          await signInWithCustomToken(auth, data.customToken);
        }
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">CreditWise</h1>
          <p className="text-slate-600">Optimize your credit, reduce interest, and stay organized.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "initial" && (
            <motion.div
              key="initial"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Continue with Email"}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Google Account
              </button>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Check your email</h3>
                <p className="text-sm text-slate-500">We've sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span></p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[1em] font-mono py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Verify OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("initial")}
                  className="w-full text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  Change email address
                </button>
              </form>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Set your password</h3>
                <p className="text-sm text-slate-500">Create a secure password for your new account.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Create Account"}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <div className="mt-8 space-y-4 text-left border-t border-slate-100 pt-8">
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

        <p className="mt-6 text-xs text-slate-400 text-center">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
