import { useState, useRef } from "react";
import { collection, setDoc, doc, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { GoogleGenAI } from "@google/genai";
import { FileUp, FileText, CheckCircle2, AlertCircle, RefreshCw, X, UploadCloud, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface FileUploadProps {
  userId: string;
  onComplete: () => void;
}

export default function FileUpload({ userId, onComplete }: FileUploadProps) {
  const [files, setFiles] = useState<{ file: File, comment: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles: { file: File, comment: string }[] = [];
    let hasError = false;

    selectedFiles.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} exceeds 10MB limit.`);
        hasError = true;
      } else {
        validFiles.push({ file, comment: "" });
      }
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      if (!hasError) setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeFiles = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const allExtracted: any[] = [];

      // Process files sequentially to avoid hitting rate limits too hard, 
      // though parallel is faster. For 3-5 files sequential is fine.
      for (const { file, comment } of files) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        
        const prompt = `You are an expert financial document analyzer. Extract all credit card and loan information from the provided document.
        
        ${comment ? `USER INSTRUCTIONS FOR THIS DOCUMENT: "${comment}"\nPlease follow these instructions carefully while extracting data.` : ''}
        
        For each credit item or loan found, identify the following fields. If a value is not found, use null or 0 as appropriate.
        - bankName: The name of the lender or bank (string).
        - type: One of (credit_card, personal_loan, home_loan, auto_loan, education_loan, other).
        - balance: Current outstanding balance or principal remaining (number).
        - interestRate: Annual interest rate as a number (e.g., 12.5).
        - limit: Credit limit for cards or original loan amount for loans (number).
        - emi: Monthly installment amount or minimum due (number).
        - dueDate: Next payment due date (string, e.g., "15th of month" or "YYYY-MM-DD").
        - billingDate: Statement generation date, typically for credit cards (string).
        - tenure: Total loan duration in months (number).
        - totalAmountTaken: The original principal amount borrowed (number).
        - emiStartDate: When the first EMI was paid (YYYY-MM-DD).
        - emiEndDate: When the last EMI is scheduled (YYYY-MM-DD).
        - nextEmiDate: The date of the upcoming EMI (YYYY-MM-DD).
        - emiPaid: Number of installments already paid (number).
        - emiLeft: Number of installments remaining (number).
        - foreclosureAmount: Estimated amount to close the loan today (number).
        
        Be extremely precise with numbers. Do not include currency symbols in numbers.
        Format the output as a JSON array of objects. Return ONLY the JSON array.`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview", // Using a faster model to avoid rate limits
          contents: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: file.type } }
          ],
          config: { 
            responseMimeType: "application/json",
            temperature: 0.1 // Lower temperature for more deterministic extraction
          }
        });

        const data = JSON.parse(response.text || "[]");
        const items = Array.isArray(data) ? data : [data];
        allExtracted.push(...items);
      }
      
      setExtractedData(allExtracted);
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze the documents. Please try again or add manually.");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveExtractedData = async () => {
    try {
      const path = `users/${userId}/creditItems`;
      for (const item of extractedData) {
        // Explicitly pick fields to match Firestore rules and avoid extra keys
        const creditItem = {
          bankName: item.bankName || "Unknown",
          type: item.type || "other",
          balance: parseFloat(item.balance) || 0,
          interestRate: parseFloat(item.interestRate) || 0,
          limit: parseFloat(item.limit) || 0,
          emi: parseFloat(item.emi) || 0,
          dueDate: item.dueDate || "",
          billingDate: item.billingDate || "",
          tenure: parseInt(item.tenure) || 0,
          totalAmountTaken: parseFloat(item.totalAmountTaken) || 0,
          emiStartDate: item.emiStartDate || "",
          emiEndDate: item.emiEndDate || "",
          nextEmiDate: item.nextEmiDate || "",
          emiPaid: parseInt(item.emiPaid) || 0,
          emiLeft: parseInt(item.emiLeft) || 0,
          foreclosureAmount: parseFloat(item.foreclosureAmount) || 0,
          uid: crypto.randomUUID(),
          userId,
          createdAt: Timestamp.now(),
        };

        try {
          await setDoc(doc(db, path, creditItem.uid), creditItem);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
      onComplete();
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save the extracted data. Check permissions or data format.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Upload Documents</h1>
        <p className="text-slate-500 mt-1">Upload bank statements or loan agreements to auto-fill your profile.</p>
      </header>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        {files.length === 0 && extractedData.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,application/pdf"
              multiple
            />
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Click to upload or drag and drop</h3>
            <p className="text-slate-500 text-sm mt-1">PDF, JPG, or PNG (Max 10MB per file)</p>
          </div>
        ) : (
          <div className="space-y-6">
            {extractedData.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Selected Files ({files.length})</h3>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Add More
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*,application/pdf"
                    multiple
                  />
                </div>
                <div className="grid gap-3">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <FileText className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 truncate max-w-[200px]">{f.file.name}</p>
                            <p className="text-xs text-slate-500">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button onClick={() => removeFile(idx)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-rose-600 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="mt-1">
                        <input
                          type="text"
                          placeholder="Add instructions for AI (e.g., 'This is my HDFC credit card statement')"
                          value={f.comment}
                          onChange={(e) => {
                            const newFiles = [...files];
                            newFiles[idx].comment = e.target.value;
                            setFiles(newFiles);
                          }}
                          className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {!analyzing && extractedData.length === 0 && files.length > 0 && (
              <button
                onClick={analyzeFiles}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Start AI Analysis ({files.length} {files.length === 1 ? 'file' : 'files'})
              </button>
            )}

            {analyzing && (
              <div className="text-center py-8 space-y-4">
                <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
                <p className="text-slate-600 font-medium">AI is analyzing your documents...</p>
                <p className="text-slate-400 text-sm">This may take a few seconds per document.</p>
              </div>
            )}

            {extractedData.length > 0 && (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700 text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  Successfully extracted {extractedData.length} items from {files.length} {files.length === 1 ? 'file' : 'files'}. Please verify before saving.
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {extractedData.map((item, i) => (
                    <div key={i} className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Name</label>
                          <input 
                            value={item.bankName || ""} 
                            onChange={(e) => {
                              const newData = [...extractedData];
                              newData[i].bankName = e.target.value;
                              setExtractedData(newData);
                            }}
                            className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                          <select 
                            value={item.type || "other"} 
                            onChange={(e) => {
                              const newData = [...extractedData];
                              newData[i].type = e.target.value;
                              setExtractedData(newData);
                            }}
                            className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500"
                          >
                            <option value="credit_card">Credit Card</option>
                            <option value="personal_loan">Personal Loan</option>
                            <option value="home_loan">Home Loan</option>
                            <option value="auto_loan">Auto Loan</option>
                            <option value="education_loan">Education Loan</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance</label>
                          <input 
                            type="number"
                            value={item.balance ?? ""} 
                            onChange={(e) => {
                              const newData = [...extractedData];
                              newData[i].balance = e.target.value;
                              setExtractedData(newData);
                            }}
                            className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interest Rate (%)</label>
                          <input 
                            type="number"
                            value={item.interestRate ?? ""} 
                            onChange={(e) => {
                              const newData = [...extractedData];
                              newData[i].interestRate = e.target.value;
                              setExtractedData(newData);
                            }}
                            className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500"
                          />
                        </div>
                        {item.type !== "credit_card" && (
                          <>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EMI</label>
                              <input 
                                type="number"
                                value={item.emi ?? ""} 
                                onChange={(e) => {
                                  const newData = [...extractedData];
                                  newData[i].emi = e.target.value;
                                  setExtractedData(newData);
                                }}
                                className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenure</label>
                              <input 
                                type="number"
                                value={item.tenure ?? ""} 
                                onChange={(e) => {
                                  const newData = [...extractedData];
                                  newData[i].tenure = e.target.value;
                                  setExtractedData(newData);
                                }}
                                className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setExtractedData([])}
                    className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveExtractedData}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Confirm & Save All
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-2xl p-8 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2">How it works</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Our AI uses advanced vision models to scan your documents. It automatically detects bank names, balances, interest rates, and loan types. You can review and edit everything before it's saved to your profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
