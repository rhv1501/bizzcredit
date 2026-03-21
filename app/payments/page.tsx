"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useState } from "react";
import { format } from "date-fns";
import { Search, Plus, History, ExternalLink, MessageSquare } from "lucide-react";
import Link from "next/link";
import { getWhatsAppLink, generateReminderMessage, generatePaymentReceiptMessage } from "@/lib/messaging";
import type { Sale, PaymentStatus } from "@/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [selectedCredit, setSelectedCredit] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [sendReceipt, setSendReceipt] = useState(true);

  const credits = useLiveQuery(() =>
    db.sales.where("status").anyOf(["Pending", "Partial"]).toArray()
  , []);

  const filtered = credits?.filter(s =>
    s.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (s.customerPhone && s.customerPhone.includes(search))
  );

  const totalDue    = filtered?.reduce((s, r) => s + r.balance, 0) ?? 0;
  const pendingCount = filtered?.filter(s => s.status === "Pending").length ?? 0;
  const partialCount = filtered?.filter(s => s.status === "Partial").length ?? 0;

  const openPayDialog = (credit: Sale) => {
    setSelectedCredit(credit);
    setPayAmount(credit.balance.toString());
    setPayMethod("Cash");
    setDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedCredit) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    if (amount > selectedCredit.balance) { toast.error("Amount exceeds balance"); return; }

    try {
      const newPayment = {
        id: crypto.randomUUID(), amount, date: new Date().toISOString(), method: payMethod,
      };
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
      setDialogOpen(false);

      if (sendReceipt && selectedCredit?.customerPhone) {
        const msg = generatePaymentReceiptMessage(selectedCredit.customerName, amount, newBalance);
        window.open(getWhatsAppLink(selectedCredit.customerPhone, msg), "_blank");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Payments</h1>
        <p className="text-muted-foreground">Manage outstanding dues across all customers.</p>
      </div>

      {/* Summary chips */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-card hover-lift">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-red-500">₹{totalDue.toLocaleString("en-IN")}</p>
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-amber-500">{partialCount}</p>
            <p className="text-sm text-muted-foreground">Partial Payments</p>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Fully Pending</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Outstanding Dues</CardTitle>
              <CardDescription>Partial and pending credit payments</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customer..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead>Credit Total</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered || filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      🎉 No pending payments. All dues cleared!
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((credit) => (
                    <TableRow key={credit.id}>
                      <TableCell>
                        <p className="font-medium">{credit.customerName}</p>
                        <p className="text-xs text-muted-foreground">{credit.customerPhone || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(credit.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[150px] truncate">
                        {credit.description}
                      </TableCell>
                      <TableCell className="font-medium">₹{credit.totalAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="font-bold text-red-500">₹{credit.balance.toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          credit.status === "Partial"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                        }`}>
                          {credit.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {credit.customerPhone && (
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              onClick={() => {
                                const msg = generateReminderMessage(credit.customerName, credit);
                                window.open(getWhatsAppLink(credit.customerPhone!, msg), "_blank");
                              }}
                              title="Send WhatsApp Reminder"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(credit)}>
                            <Plus className="mr-1 h-3 w-3" /> Pay
                          </Button>
                          <Link href={`/customers/${credit.customerId}`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {selectedCredit?.customerName}</DialogTitle>
            <DialogDescription>
              Credit on {selectedCredit && format(new Date(selectedCredit.date), "dd MMM yyyy")} · Balance: ₹{selectedCredit?.balance.toLocaleString("en-IN")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground text-xs">Credit Amount</p>
                <p className="font-bold text-base">₹{selectedCredit?.totalAmount.toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-md">
                <p className="text-red-600 dark:text-red-400 text-xs">Balance Due</p>
                <p className="font-bold text-base text-red-600 dark:text-red-400">₹{selectedCredit?.balance.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Amount (₹)</label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} max={selectedCredit?.balance} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v || "Cash")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "Card", "UPI", "Bank Transfer"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCredit?.customerPhone && (
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

            {/* Payment history */}
            {selectedCredit && selectedCredit.payments.length > 0 && (
              <div className="border-t pt-3">
                <p className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <History className="h-3.5 w-3.5" /> Payment History
                </p>
                <div className="space-y-1.5 max-h-36 overflow-auto">
                  {selectedCredit.payments.map(p => (
                    <div key={p.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium mr-2">₹{p.amount.toLocaleString("en-IN")}</span>
                        <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.method}</span>
                      </div>
                      <span className="text-muted-foreground">{format(new Date(p.date), "dd MMM, hh:mm a")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment}>Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
