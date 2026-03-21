"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncToSheets } from "@/lib/sync";
import { getWhatsAppLink, generateReceiptMessage, generateReminderMessage, generatePaymentReceiptMessage, generateOverallReminderMessage } from "@/lib/messaging";
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft, Plus, History, Phone, Mail,
  Pencil, Trash2, MoreVertical, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Sale, PaymentStatus } from "@/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  Partial: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Pending: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
};

const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];

// ─── Interfaces for edit state ─────────────────────────────────────────────

interface EditCustomerState {
  name: string; phone: string; email: string;
}

interface EditCreditState {
  date: string;
  description: string;
  totalAmount: string;
  amountPaid: string;
  notes: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── Payment dialog ──────────────────────────────────────────────────────
  const [selectedCredit, setSelectedCredit] = useState<Sale | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [sendReceipt, setSendReceipt] = useState(true);

  // ── Edit Customer dialog ────────────────────────────────────────────────
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<EditCustomerState>({
    name: "", phone: "", email: "",
  });

  // ── Delete Customer dialog ──────────────────────────────────────────────
  const [deleteCustomerOpen, setDeleteCustomerOpen] = useState(false);

  // ── Edit Credit dialog ──────────────────────────────────────────────────
  const [editCreditOpen, setEditCreditOpen] = useState(false);
  const [editCredit, setEditCredit] = useState<EditCreditState>({
    date: "", description: "", totalAmount: "", amountPaid: "", notes: "",
  });
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);

  // ── Delete Credit dialog ────────────────────────────────────────────────
  const [deleteCreditId, setDeleteCreditId] = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const customer = useLiveQuery(() => db.customers.get(id), [id]);
  const credits = useLiveQuery(() =>
    db.sales.where("customerId").equals(id).reverse().sortBy("date")
  , [id]);

  const totalCredited = credits?.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalPaid     = credits?.reduce((s, r) => s + r.amountPaid, 0) ?? 0;
  const totalDue      = credits?.reduce((s, r) => s + r.balance, 0) ?? 0;

  // ── Payment handlers ────────────────────────────────────────────────────
  const openPayDialog = (credit: Sale) => {
    setSelectedCredit(credit);
    setPayAmount(credit.balance.toString());
    setPayMethod("Cash");
    setPayDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedCredit) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    if (amount > selectedCredit.balance) { toast.error("Amount exceeds balance"); return; }
    try {
      const newPayment = { id: crypto.randomUUID(), amount, date: new Date().toISOString(), method: payMethod };
      const updatedPayments = [...selectedCredit.payments, newPayment];
      const newAmountPaid = selectedCredit.amountPaid + amount;
      const newBalance = selectedCredit.totalAmount - newAmountPaid;
      const newStatus: PaymentStatus = newBalance === 0 ? "Paid" : newAmountPaid > 0 ? "Partial" : "Pending";
      await db.sales.update(selectedCredit.id, {
        payments: updatedPayments,
        amountPaid: newAmountPaid,
        balance: newBalance,
        status: newStatus,
        synced: false,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Payment recorded!");
      setPayDialogOpen(false);
      
      if (sendReceipt && customer?.phone) {
        const msg = generatePaymentReceiptMessage(customer.name, amount, newBalance);
        window.open(getWhatsAppLink(customer.phone, msg), "_blank");
      }

      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to record payment."); }
  };

  const handleOverallReminder = () => {
    if (!customer?.phone) {
      toast.error("Customer phone number is missing.");
      return;
    }
    const pendingCount = credits?.filter(c => c.balance > 0).length || 0;
    const msg = generateOverallReminderMessage(customer.name, totalDue, pendingCount);
    window.open(getWhatsAppLink(customer.phone, msg), "_blank");
  };

  // ── Customer CRUD ───────────────────────────────────────────────────────
  const openEditCustomer = () => {
    if (!customer) return;
    setEditCustomer({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
    });
    setEditCustomerOpen(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editCustomer.name.trim()) { toast.error("Name is required"); return; }
    try {
      await db.customers.update(id, {
        name: editCustomer.name.trim(),
        phone: editCustomer.phone || undefined,
        email: editCustomer.email || undefined,
        synced: false,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Customer updated!");
      setEditCustomerOpen(false);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to update customer."); }
  };

  const handleDeleteCustomer = async () => {
    try {
      const linkedCredits = await db.sales.where("customerId").equals(id).toArray();
      const now = Date.now();
      await Promise.all(linkedCredits.map(c => db.deletedSyncs.add({ id: c.id, type: 'sale', timestamp: now })));
      await db.deletedSyncs.add({ id: id, type: 'customer', timestamp: now });

      await Promise.all(linkedCredits.map(c => db.sales.delete(c.id)));
      await db.customers.delete(id);
      toast.success("Customer and all their credits deleted.");
      if (navigator.onLine) syncToSheets().catch(() => {});
      router.push("/customers");
    } catch { toast.error("Failed to delete customer."); }
  };

  // ── Credit CRUD ─────────────────────────────────────────────────────────
  const openEditCredit = (credit: Sale) => {
    setEditingCreditId(credit.id);
    setEditCredit({
      date: format(new Date(credit.date), "yyyy-MM-dd"),
      description: credit.description,
      totalAmount: credit.totalAmount.toString(),
      amountPaid: credit.amountPaid.toString(),
      notes: credit.notes || "",
    });
    setEditCreditOpen(true);
  };

  const handleUpdateCredit = async () => {
    if (!editingCreditId) return;
    const total = parseFloat(editCredit.totalAmount);
    const paid = parseFloat(editCredit.amountPaid);
    if (isNaN(total) || total < 0) { toast.error("Invalid total amount"); return; }
    if (isNaN(paid) || paid < 0) { toast.error("Invalid paid amount"); return; }
    const balance = Math.max(0, total - paid);
    const status: PaymentStatus = balance === 0 && total > 0 ? "Paid" : paid > 0 && balance > 0 ? "Partial" : "Pending";
    try {
      await db.sales.update(editingCreditId, {
        date: new Date(editCredit.date).toISOString(),
        description: editCredit.description,
        totalAmount: total,
        amountPaid: paid,
        balance,
        status,
        notes: editCredit.notes || undefined,
        synced: false,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Credit updated!");
      setEditCreditOpen(false);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to update credit."); }
  };

  const handleDeleteCredit = async () => {
    if (!deleteCreditId) return;
    try {
      await db.deletedSyncs.add({ id: deleteCreditId, type: 'sale', timestamp: Date.now() });
      await db.sales.delete(deleteCreditId);
      toast.success("Credit entry deleted.");
      setDeleteCreditId(null);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to delete credit entry."); }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/customers")}>Back to Customers</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/customers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold shrink-0">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{customer.name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
              <span>Since {format(new Date(customer.createdAt), "dd MMM yyyy")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditCustomer}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" 
            onClick={handleOverallReminder}
            disabled={totalDue <= 0 || !customer.phone}
            title={!customer.phone ? "Add a phone number to send reminders" : totalDue <= 0 ? "No pending balance to remind about" : "Send WhatsApp Reminder"}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Send Reminder
          </Button>
          <Link href={`/add-credit?customerId=${customer.id}`}>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Credit
            </Button>
          </Link>
          <Button
            variant="ghost" size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteCustomerOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Credits", value: credits?.length ?? 0 },
          { label: "Total Credited", value: `₹${totalCredited.toLocaleString("en-IN")}` },
          { label: "Total Paid",    value: `₹${totalPaid.toLocaleString("en-IN")}`,    color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Balance Due",   value: `₹${totalDue.toLocaleString("en-IN")}`,     color: totalDue > 0 ? "text-red-500" : "text-emerald-500" },
        ].map(({ label, value, color = "" }) => (
          <Card key={label} className="glass-card hover-lift">
            <CardContent className="pt-6">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Credit History ── */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Credit History ({credits?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!credits || credits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No credit entries yet.</p>
          ) : (
            <div className="space-y-3">
              {credits.map((credit) => (
                <div key={credit.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{format(new Date(credit.date), "dd MMM yyyy")}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[credit.status]}`}>{credit.status}</span>
                      </div>
                      <p className="text-sm font-medium mt-1">{credit.description}</p>
                      {credit.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{credit.notes}</p>}
                    </div>
                    <div className="flex items-start gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-bold">₹{credit.totalAmount.toLocaleString("en-IN")}</p>
                        {credit.balance > 0 && <p className="text-xs text-red-500">Due: ₹{credit.balance.toLocaleString("en-IN")}</p>}
                      </div>
                      {/* Credit action menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" />}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {customer.phone && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  const msg = generateReceiptMessage(customer.name, credit, credit.balance);
                                  window.open(getWhatsAppLink(customer.phone!, msg), "_blank");
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-2" /> Send Receipt
                              </DropdownMenuItem>
                              {credit.balance > 0 && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    const msg = generateReminderMessage(customer.name, credit);
                                    window.open(getWhatsAppLink(customer.phone!, msg), "_blank");
                                  }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5 mr-2" /> Send Reminder
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => openEditCredit(credit)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Credit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteCreditId(credit.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Credit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Payment history */}
                  {credit.payments.length > 0 && (
                    <div className="space-y-1 border-t pt-2">
                      {credit.payments.map((p) => (
                        <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                          <span>₹{p.amount.toLocaleString("en-IN")} · {p.method}</span>
                          <span>{format(new Date(p.date), "dd MMM, hh:mm a")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {credit.balance > 0 && (
                    <Button size="sm" className="w-full" onClick={() => openPayDialog(credit)}>
                      <Plus className="mr-1 h-3 w-3" /> Record Payment
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ DIALOGS ═══════════════════ */}

      {/* ── Record Payment Dialog ── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedCredit && format(new Date(selectedCredit.date), "dd MMM yyyy")} · Balance: ₹{selectedCredit?.balance.toLocaleString("en-IN")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} max={selectedCredit?.balance} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Method</label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v || "Cash")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {customer?.phone && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="send-receipt" 
                  checked={sendReceipt} 
                  onCheckedChange={(c) => setSendReceipt(!!c)} 
                />
                <label htmlFor="send-receipt" className="text-sm font-medium leading-none cursor-pointer">
                  Send WhatsApp receipt
                </label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment}>Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Customer Dialog ── */}
      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer profile information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input value={editCustomer.name} onChange={e => setEditCustomer(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input value={editCustomer.phone} onChange={e => setEditCustomer(s => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input value={editCustomer.email} onChange={e => setEditCustomer(s => ({ ...s, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditCustomerOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateCustomer}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Customer Confirm ── */}
      <Dialog open={deleteCustomerOpen} onOpenChange={setDeleteCustomerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{customer.name}</strong> and all
              their <strong>{credits?.length ?? 0} credit entry(s)</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteCustomerOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCustomer}>Delete Permanently</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Credit Dialog ── */}
      <Dialog open={editCreditOpen} onOpenChange={setEditCreditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Credit Entry</DialogTitle>
            <DialogDescription>Update credit details and amounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={editCredit.date} onChange={e => setEditCredit(s => ({ ...s, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={editCredit.description} onChange={e => setEditCredit(s => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Total Amount (₹)</label>
                <Input type="number" value={editCredit.totalAmount}
                  onChange={e => setEditCredit(s => ({ ...s, totalAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount Paid (₹)</label>
                <Input type="number" value={editCredit.amountPaid}
                  onChange={e => setEditCredit(s => ({ ...s, amountPaid: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input value={editCredit.notes} onChange={e => setEditCredit(s => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditCreditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateCredit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Credit Confirm ── */}
      <Dialog open={!!deleteCreditId} onOpenChange={() => setDeleteCreditId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Credit Entry</DialogTitle>
            <DialogDescription>
              This will permanently delete this credit entry and its payment history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteCreditId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCredit}>Delete Entry</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
