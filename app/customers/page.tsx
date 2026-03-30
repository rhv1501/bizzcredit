"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useState } from "react";
import { format } from "date-fns";
import { Search, UserPlus, Users, PlusCircle } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) return;
    setIsAdding(true);
    try {
      await db.customers.add({
        id: crypto.randomUUID(),
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        email: newCustomerEmail.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: false
      });
      setIsAddCustomerOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
    } catch (error) {
      console.error("Failed to add customer:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const customers = useLiveQuery(() =>
    db.customers.orderBy("name").toArray()
  , []);

  const allCredits = useLiveQuery(() => db.sales.toArray(), []);

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  const getCreditStats = (customerId: string) => {
    const customerCredits = allCredits?.filter(s => s.customerId === customerId) || [];
    const totalCredited = customerCredits.reduce((sum, s) => sum + s.totalAmount, 0);
    const pendingBalance = customerCredits.reduce((sum, s) => sum + s.balance, 0);
    return { creditCount: customerCredits.length, totalCredited, pendingBalance };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">All registered customers and their credit history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 shrink-0" onClick={() => setIsAddCustomerOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add Customer
          </Button>
          <Link href="/add-credit">
            <Button className="gap-2 shrink-0">
              <PlusCircle className="h-4 w-4" />
              Add Credit
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-card hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customers?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ₹{(allCredits?.reduce((s, r) => s + r.totalAmount, 0) ?? 0).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-muted-foreground">Total Credited</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                <span className="text-red-600 dark:text-red-400 font-bold text-sm">!</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ₹{(allCredits?.reduce((s, r) => s + r.balance, 0) ?? 0).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-muted-foreground">Total Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + List */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Customer Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name or phone..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No customers found</p>
              <p className="text-sm">Add a credit entry to register your first customer.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered?.map((customer) => {
                const stats = getCreditStats(customer.id);
                return (
                  <Link key={customer.id} href={`/customers/${customer.id}`}>
                    <div className="group rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold truncate group-hover:text-primary">{customer.name}</p>
                            {customer.advanceBalance && customer.advanceBalance > 0 && (
                              <span className="shrink-0 ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                +₹{customer.advanceBalance}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{customer.phone || customer.email || "No details"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-3">
                        <div>
                          <p className="font-bold text-base">{stats.creditCount}</p>
                          <p className="text-muted-foreground">Credits</p>
                        </div>
                        <div>
                          <p className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                            ₹{stats.totalCredited.toLocaleString("en-IN")}
                          </p>
                          <p className="text-muted-foreground">Credited</p>
                        </div>
                        <div>
                          <p className={`font-bold text-base ${stats.pendingBalance > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            ₹{stats.pendingBalance.toLocaleString("en-IN")}
                          </p>
                          <p className="text-muted-foreground">Due</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Since {format(new Date(customer.createdAt), "dd MMM yyyy")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer profile without adding a credit entry.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">Name</label>
              <Input
                id="name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone (Optional)</label>
              <Input
                id="phone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">Email (Optional)</label>
              <Input
                id="email"
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} disabled={!newCustomerName.trim() || isAdding}>
              {isAdding ? "Saving..." : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
