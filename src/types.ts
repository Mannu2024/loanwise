import { Timestamp } from "firebase/firestore";

export type CreditType = "credit_card" | "personal_loan" | "home_loan" | "auto_loan" | "education_loan" | "other";

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: "user" | "admin";
  createdAt: Timestamp;
}

export interface PaymentRecord {
  date: string;
  amount: number;
  note?: string;
}

export interface CreditItem {
  uid: string;
  userId: string;
  bankName: string;
  type: CreditType;
  limit?: number;
  balance: number;
  interestRate: number;
  emi: number;
  dueDate?: string;
  billingDate?: string;
  tenure?: number;
  totalAmountTaken?: number;
  emiStartDate?: string;
  emiEndDate?: string;
  nextEmiDate?: string;
  emiPaid?: number;
  emiLeft?: number;
  foreclosureAmount?: number;
  paymentHistory?: PaymentRecord[];
  createdAt: Timestamp;
}

export interface Insight {
  uid: string;
  userId: string;
  title: string;
  description: string;
  type: "warning" | "suggestion" | "info";
  createdAt: Timestamp;
}

export interface CreditHealth {
  score: number;
  utilization: number;
  totalDebt: number;
  monthlyEMI: number;
  avgInterest: number;
  debtToIncomeRatio?: number;
}
