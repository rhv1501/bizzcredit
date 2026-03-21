"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Save, Search, UserPlus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import { syncToSheets } from "@/lib/sync";
import { getWhatsAppLink, generateReceiptMessage } from "@/lib/messaging";
import type { Customer, PaymentStatus } from "@/types";

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

// ─── Zod Schema ────────────────────────────────────────────────────────────

const formSchema = z.object({
  // Customer fields (used when creating a new customer)
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerPhone: z.string().optional().default(""),
  customerEmail: z.string().optional().default(""),
  // Credit fields
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  totalAmount: z.coerce.number().min(0),
  amountPaid: z.coerce.number().min(0),
  paymentMethod: z.string().min(1, "Select a payment method"),
  notes: z.string().optional().default(""),
});

type FormValues = z.infer<typeof formSchema>;

const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];

// ─── Inner Component (uses useSearchParams – must be wrapped in Suspense) ────

function AddCreditForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // WhatsApp state
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      totalAmount: 0,
      amountPaid: 0,
      paymentMethod: "Cash",
      notes: "",
    },
  });

  const totalAmount = watch("totalAmount") ?? 0;
  const amountPaid = watch("amountPaid") ?? 0;
  const balance = Math.max(0, Number(totalAmount) - Number(amountPaid));

  const paymentStatus: PaymentStatus =
    balance === 0 && Number(totalAmount) > 0
      ? "Paid"
      : Number(amountPaid) > 0 && balance > 0
      ? "Partial"
      : "Pending";

  const statusColor = { Paid: "text-emerald-500", Partial: "text-amber-500", Pending: "text-red-500" }[paymentStatus];

  // ── Pre-select customer if navigated from customer page ──────────────────

  useEffect(() => {
    if (!preselectedCustomerId) return;
    db.customers.get(preselectedCustomerId).then((c) => {
      if (c) handleSelectCustomer(c);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedCustomerId]);

  // ── Customer Search ──────────────────────────────────────────────────────

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
    setIsNewCustomer(false);
    setShowDropdown(false);
    setCustomerQuery(customer.name);
    setValue("customerName", customer.name);
    setValue("customerPhone", customer.phone || "");
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setCustomerQuery("");
    setValue("customerName", "");
    setValue("customerPhone", "");
  };

  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(true);
    setShowDropdown(false);
    setValue("customerName", customerQuery);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      let customerId: string;

      if (selectedCustomer) {
        customerId = selectedCustomer.id;
        await db.customers.update(customerId, {
          synced: false,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // New customer – create profile first
        customerId = crypto.randomUUID();
        await db.customers.add({
          id: customerId,
          name: values.customerName,
          phone: values.customerPhone || undefined,
          email: values.customerEmail || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
        });
      }

      // Create the credit record
      const payments = values.amountPaid > 0
        ? [{ id: crypto.randomUUID(), amount: values.amountPaid, date: new Date().toISOString(), method: values.paymentMethod }]
        : [];

      await db.sales.add({
        id: crypto.randomUUID(),
        customerId,
        customerName: values.customerName,
        customerPhone: values.customerPhone || undefined,
        date: new Date(values.date).toISOString(),
        description: values.description,
        totalAmount: values.totalAmount,
        amountPaid: values.amountPaid,
        payments,
        balance,
        status: paymentStatus,
        notes: values.notes || undefined,
        synced: false,
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Credit recorded for ${values.customerName}!`);

      if (navigator.onLine) {
        syncToSheets().catch(() => {});
      }

      // Handle WhatsApp Redirect
      const phone = selectedCustomer ? selectedCustomer.phone : values.customerPhone;
      if (sendWhatsapp && phone) {
        const message = generateReceiptMessage(values.customerName, {
          date: values.date,
          description: values.description,
          totalAmount: values.totalAmount,
          amountPaid: values.amountPaid
        }, balance);
        const link = getWhatsAppLink(phone, message);
        window.open(link, "_blank");
      }

      router.push(selectedCustomer ? `/customers/${customerId}` : "/records");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save credit entry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Credit</h1>
        <p className="text-muted-foreground">Search for an existing customer or add a new one.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Customer Selection ── */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            {!selectedCustomer && !isNewCustomer && (
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
                {/* Dropdown results */}
                {showDropdown && (customerResults.length > 0 || customerQuery.trim()) && (
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
                    {customerQuery.trim() && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent text-primary font-medium border-t"
                        onMouseDown={handleNewCustomer}
                      >
                        <UserPlus className="h-4 w-4" />
                        Add &quot;{customerQuery}&quot; as new customer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected existing customer badge */}
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

            {/* New customer form fields */}
            {(isNewCustomer || (!selectedCustomer && !customerQuery)) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Name *</label>
                  <Input placeholder="John Doe" {...register("customerName")} />
                  {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input placeholder="+91 9876543210" {...register("customerPhone")} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Email (optional)</label>
                  <Input placeholder="john@example.com" {...register("customerEmail")} />
                </div>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Credit Date *</label>
              <Input type="date" {...register("date")} className="max-w-xs" />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ── Credit Details ── */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Credit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Input
                placeholder="What is this credit for? e.g. Groceries, Monthly supplies, Services..."
                {...register("description")}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input placeholder="Any extra notes..." {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        {/* ── Payment ── */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Amount (₹) *</label>
                <Input type="number" min={0} step="0.01" placeholder="0" {...register("totalAmount")} />
                {errors.totalAmount && <p className="text-xs text-destructive">{errors.totalAmount.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Paid Now (₹)</label>
                <Input type="number" min={0} step="0.01" placeholder="0" {...register("amountPaid")} />
                <p className="text-xs text-muted-foreground">Remaining goes as credit</p>
              </div>
            </div>

            {/* Live breakdown */}
            <div className="grid grid-cols-3 divide-x rounded-lg border overflow-hidden">
              <div className="p-3 text-center bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="font-bold text-base">₹{Number(totalAmount || 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 text-center bg-emerald-50 dark:bg-emerald-500/10">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Paid Now</p>
                <p className="font-bold text-base text-emerald-600 dark:text-emerald-400">₹{Number(amountPaid || 0).toLocaleString("en-IN")}</p>
              </div>
              <div className={`p-3 text-center ${balance > 0 ? "bg-red-50 dark:bg-red-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"}`}>
                <p className={`text-xs mb-1 ${balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>Goes as Credit</p>
                <p className={`font-bold text-base ${balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  ₹{balance.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Payment method — only relevant if something was paid */}
            {Number(amountPaid) > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Controller control={control} name="paymentMethod" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── WhatsApp Toggle ── */}
        <div className="flex items-center space-x-2 px-1">
          <Checkbox 
            id="whatsapp" 
            checked={sendWhatsapp} 
            onCheckedChange={(checked) => setSendWhatsapp(!!checked)} 
            disabled={!(selectedCustomer?.phone || watch("customerPhone"))}
          />
          <label
            htmlFor="whatsapp"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Send WhatsApp Receipt to Customer
          </label>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Credit"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Page export with Suspense boundary ──────────────────────────────────────

export default function AddCreditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>}>
      <AddCreditForm />
    </Suspense>
  );
}
