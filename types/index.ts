export type PaymentStatus = "Paid" | "Partial" | "Pending";

export interface PaymentEntry {
  id: string;
  amount: number;
  date: string;
  method: string;
}

// A customer profile – persists across multiple credit entries
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

// A single credit entry for a customer
export interface Sale {
  id: string;
  customerId: string;           // FK → Customer.id
  customerName: string;         // denormalized for fast display
  customerPhone?: string;
  date: string;
  description: string;          // what the credit is for
  totalAmount: number;
  amountPaid: number;           // renamed from advancePaid
  payments: PaymentEntry[];
  balance: number;
  status: PaymentStatus;
  notes?: string;
  synced: boolean;
  updatedAt: string;
}

// Legacy – keep for backward compat during migration
export interface CustomerRecord {
  id: string;
  name: string;
  phone?: string;
  date: string;
  purchaseType: string[];
  totalAmount: number;
  payments: PaymentEntry[];
  advancePaid: number;
  balance: number;
  status: PaymentStatus;
  synced: boolean;
  updatedAt: string;
}
