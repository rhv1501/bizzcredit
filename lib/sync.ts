import { db } from "@/lib/db";

/**
 * Syncs all unsynced sales (and their customers) to Google Sheets.
 * Returns { synced: number } or throws on API error.
 */
export async function syncToSheets(): Promise<{ synced: number }> {
  const [allCustomers, allSales, allDeleted] = await Promise.all([
    db.customers.toArray(),
    db.sales.toArray(),
    db.deletedSyncs.toArray(),
  ]);

  const unsyncedSales = allSales.filter((s) => s.synced === false);

  const unsyncedCustomerIds = new Set(unsyncedSales.map((s) => s.customerId));
  const unsyncedCustomers = allCustomers.filter((c) =>
    unsyncedCustomerIds.has(c.id)
  );

  const deletedCustomerIds = allDeleted.filter(d => d.type === 'customer').map(d => d.id);
  const deletedSaleIds = allDeleted.filter(d => d.type === 'sale').map(d => d.id);

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      customers: unsyncedCustomers, 
      sales: unsyncedSales,
      deletedCustomerIds,
      deletedSaleIds
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Sync failed");
  }

  // Mark synced in local DB and merge pulled data
  await db.transaction("rw", db.customers, db.sales, db.deletedSyncs, async () => {
    // Mark pushed sales as synced
    for (const sale of unsyncedSales) {
      await db.sales.update(sale.id, { synced: true });
    }

    // Clear pushed deletions
    if (allDeleted.length > 0) {
      await db.deletedSyncs.bulkDelete(allDeleted.map(d => d.id));
    }

    // Process pulled data to remove locally deleted/missing records
    if (data.pulledCustomers) {
      const pulledCustomerIds = new Set(data.pulledCustomers.map((c: any) => c.id));
      for (const localCust of allCustomers) {
        // Safe to delete if it's missing from sheets AND is not unsynced locally right now
        if (!pulledCustomerIds.has(localCust.id) && !unsyncedCustomerIds.has(localCust.id)) {
          await db.customers.delete(localCust.id);
        }
      }
    }

    if (data.pulledSales) {
      const pulledSaleIds = new Set(data.pulledSales.map((s: any) => s.id));
      for (const localSale of allSales) {
        // Safe to delete if it's considered fully synced locally but missing from sheets
        if (localSale.synced && !pulledSaleIds.has(localSale.id)) {
          await db.sales.delete(localSale.id);
        }
      }
    }

    // Merge pulled customers (overwrite is safe for flat objects)
    if (data.pulledCustomers && data.pulledCustomers.length > 0) {
      await db.customers.bulkPut(data.pulledCustomers);
    }

    // Insert pulled sales only if they don't already exist locally
    // This preserves local rich JSON objects (like payment UUIDs) while allowing new records to sync down
    if (data.pulledSales && data.pulledSales.length > 0) {
      for (const pulledSale of data.pulledSales) {
        const existing = await db.sales.get(pulledSale.id);
        if (!existing) {
          await db.sales.add(pulledSale as any);
        }
      }
    }
  });

  return { synced: unsyncedSales.length };
}
