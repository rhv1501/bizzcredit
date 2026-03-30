"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Save, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import { syncToSheets } from "@/lib/sync";
import { getWhatsAppLink, generatePaymentReceiptMessage, generateOverallReminderMessage } from "@/lib/messaging";
import type { Customer, Sale, PaymentStatus } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const formSchema = z.object({
  amountPaid: z.coerce.number().min(1, "Please enter a valid amount greater than 0"),
  paymentMethod: z.string().min(1, "Select a payment method"),
});
type FormValues = z.infer<typeof formSchema>;
const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];

function RecordPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);

  // WhatsApp state
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  const {
    control,
    handleSubmit,
    watch,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      amountPaid: 0,
      paymentMethod: "Cash",
    },
  });

  const amountPaid = watch("amountPaid") ?? 0;

  useEffect(() => {
    if (!preselectedCustomerId) return;
    db.customers.get(preselectedCustomerId).then((c) => {
      if (c) handleSelectCustomer(c);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedCustomerId]);

  useEffect(() => {
    if (selectedCustomer) {
      db.sales
        .where("customerId")
        .equals(selectedCustomer.id)
        .filter(s => s.balance > 0)
        .sortBy("date")
        .then(sales => setPendingSales(sales));
    } else {
      setPendingSales([]);
    }
  }, [selectedCustomer]);

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) { setCustomerResults([]); return; }
    const all = await db.customers.toArray();
    const q = query.toLowerCase();
    setCustomerResults(
      all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
      ).slice(0, 6)
    );
  }, []);

  useEffect(() => {
    searchCustomers(customerQuery);
  }, [customerQuery, searchCustomers]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDropdown(false);
    setCustomerQuery(customer.name);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery("");
  };

  const totalPending = pendingSales.reduce((acc, s) => acc + s.balance, 0);

  async function onSubmit(values: FormValues) {
    if (!selectedCustomer) {
      toast.error("Please select a customer first.");
      return;
    }
    setIsSubmitting(true);
    try {
      let remainingAmount = Number(values.amountPaid);
      const newPaymentDate = new Date().toISOString();
      const updatedSales = [];

      // Loop through pending sales, oldest first, apply payments
      for (const sale of pendingSales) {
        if (remainingAmount <= 0) break;

        const toPay = Math.min(sale.balance, remainingAmount);
        remainingAmount -= toPay;

        const updatedPayments = [
          ...sale.payments,
          { id: crypto.randomUUID(), amount: toPay, date: newPaymentDate, method: values.paymentMethod }
        ];
        const newAmountPaid = sale.amountPaid + toPay;
        const newBalance = sale.totalAmount - newAmountPaid;
        const newStatus: PaymentStatus = newBalance === 0 ? "Paid" : newAmountPaid > 0 ? "Partial" : "Pending";

        updatedSales.push({
          ...sale,
          payments: updatedPayments,
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newStatus,
          synced: false,
          updatedAt: new Date().toISOString(),
        });
      }

      // Save updated sales back to db
      for (const sale of updatedSales) {
        await db.sales.put(sale);
      }

      // Update customer - either advanceBalance if remainingAmount > 0, or just updatedAt
      const currentAdvance = selectedCustomer.advanceBalance || 0;
      await db.customers.update(selectedCustomer.id, {
        advanceBalance: currentAdvance + remainingAmount,
        synced: false,
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Payment recorded successfully for ${selectedCustomer.name}!`);
      if (remainingAmount > 0) {
        toast.info(`₹${remainingAmount.toLocaleString("en-IN")} added to Advance Balance.`);
      }

      if (navigator.onLine) {
        syncToSheets().catch(() => {});
      }

      // WhatsApp
      if (sendWhatsapp && selectedCustomer.phone) {
        // Just send a general payment receipt
        // A generic msg: Received ₹X, total pending is now Y.
        const newTotalDue = totalPending - Number(values.amountPaid);
        const newBalanceMsg = Math.max(0, newTotalDue);
        const msg = generatePaymentReceiptMessage(selectedCustomer.name, Number(values.amountPaid), newBalanceMsg);
        
        // Also if they have advance
        let finalMsg = msg;
        if (remainingAmount > 0) {
          finalMsg += `\nAn advance balance of ₹${remainingAmount.toLocaleString("en-IN")} has been credited to your account.`;
        }

        const link = getWhatsAppLink(selectedCustomer.phone, finalMsg);
        window.open(link, "_blank");
      }

      router.push(`/customers/${selectedCustomer.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Payment</h1>
        <p className="text-muted-foreground">Select an existing customer to record a payment.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Customer Selection ── */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCustomer && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or phone..."
                  value={customerQuery}
                  onChange={(e) => { setCustomerQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                />
                {showDropdown && customerResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-md border bg-popover shadow-lg overflow-hidden">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent text-left"
                        onMouseDown={() => handleSelectCustomer(c)}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-muted-foreground text-xs">{c.phone || "No phone"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.phone || "No phone"}</p>
                </div>
                <button type="button" onClick={handleClearCustomer} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Summary before payment ── */}
        {selectedCustomer && (
          <Card className="glass-card bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Pending Dues</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-500">₹{totalPending.toLocaleString("en-IN")}</p>
                </div>
                {selectedCustomer.advanceBalance && selectedCustomer.advanceBalance > 0 && (
                   <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">Current Advance</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-500">₹{selectedCustomer.advanceBalance.toLocaleString("en-IN")}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Any payment exceeding pending dues will be saved as Advance Balance.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Payment ── */}
        {selectedCustomer && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Amount (₹) *</label>
                  <Input type="number" min={1} step="0.01" placeholder="0" {...register("amountPaid")} />
                  {errors.amountPaid && <p className="text-xs text-destructive">{errors.amountPaid.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <Controller control={control} name="paymentMethod" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>

              {/* Dynamic visualization */}
              {Number(amountPaid) > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                  {Number(amountPaid) <= totalPending ? (
                    <p>₹{Number(amountPaid).toLocaleString("en-IN")} will be applied against pending dues.</p>
                  ) : (
                    <p>
                      ₹{totalPending.toLocaleString("en-IN")} will be applied against pending dues. 
                      <strong className="text-emerald-600 dark:text-emerald-400 ml-1">
                        ₹{(Number(amountPaid) - totalPending).toLocaleString("en-IN")} will be kept as Advance Balance.
                      </strong>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── WhatsApp Toggle ── */}
        {selectedCustomer && (
          <div className="flex flex-col gap-1 px-1">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="whatsapp" 
                checked={sendWhatsapp} 
                onCheckedChange={(checked) => setSendWhatsapp(!!checked)} 
                disabled={!selectedCustomer.phone}
              />
              <label
                htmlFor="whatsapp"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Send WhatsApp Receipt to Customer
              </label>
            </div>
            {!selectedCustomer.phone && (
              <p className="text-xs text-muted-foreground pl-6">
                No phone number saved for this customer. <a href={`/customers/${selectedCustomer.id}`} className="underline hover:text-foreground">Edit profile</a> to add one.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || !selectedCustomer}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Record Payment"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function RecordPaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>}>
      <RecordPaymentForm />
    </Suspense>
  );
}
