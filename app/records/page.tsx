"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useState } from "react";
import { format } from "date-fns";
import { Search, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { PaymentStatus } from "@/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  Partial: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Pending: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
};

export default function RecordsPage() {
  const [search, setSearch] = useState("");

  const credits = useLiveQuery(() =>
    db.sales.orderBy("date").reverse().toArray()
  , []);

  const filtered = credits?.filter(s =>
    s.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (s.customerPhone && s.customerPhone.includes(search)) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ["Date", "Customer", "Phone", "Description", "Total", "Paid", "Balance", "Status"];
    const rows = filtered.map(s => [
      format(new Date(s.date), "dd/MM/yyyy"),
      `"${s.customerName}"`,
      `"${s.customerPhone || ""}"`,
      `"${s.description}"`,
      s.totalAmount,
      s.amountPaid,
      s.balance,
      s.status,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credits_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit Records</h1>
          <p className="text-muted-foreground">All credit entries across all customers.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="shrink-0 gap-2 w-full sm:w-auto">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>All Credits ({filtered?.length ?? 0})</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customer or description..."
                className="pl-8 w-full"
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
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Balance</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered || filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No credit records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((credit) => (
                    <TableRow key={credit.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(credit.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium line-clamp-1">{credit.customerName}</p>
                        <p className="text-xs text-muted-foreground">{credit.customerPhone || "—"}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[180px] truncate">
                        {credit.description}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{credit.totalAmount.toLocaleString("en-IN")}
                        <div className="sm:hidden mt-1 flex flex-col gap-1">
                          {credit.balance > 0 && (
                            <span className="text-xs font-bold text-red-500">
                              Bal: ₹{credit.balance.toLocaleString("en-IN")}
                            </span>
                          )}
                          <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[credit.status]}`}>
                            {credit.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={`hidden sm:table-cell ${credit.balance > 0 ? "font-bold text-red-500" : "text-muted-foreground"}`}>
                        ₹{credit.balance.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[credit.status]}`}>
                          {credit.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customers/${credit.customerId}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
