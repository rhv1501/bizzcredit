import { google } from "googleapis";
import { NextResponse } from "next/server";

const CUSTOMER_HEADERS = [
  "Customer ID", "Name", "Phone", "Email",
  "Created At", "Updated At",
];

const CREDIT_HEADERS = [
  "Credit ID", "Customer ID", "Customer Name", "Customer Phone", "Date", "Description",
  "Total Amount", "Amount Paid", "Balance", "Status", "Payments", "Notes",
  "Updated At",
];

export async function POST(request: Request) {
  try {
    const { customers, sales, deletedCustomerIds, deletedSaleIds } = await request.json();

    if (
      !process.env.GOOGLE_CLIENT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      return NextResponse.json(
        { success: false, error: "Google API credentials not configured in .env" },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const getRowCount = async (sheetName: string) => {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      });
      return res.data.values?.length ?? 0;
    };

    // Helper: append rows (with optional header if sheet is empty)
    const appendRows = async (sheetName: string, headers: string[], rows: unknown[][]) => {
      if (rows.length === 0) return;
      const currentRows = await getRowCount(sheetName);
      const rowsToWrite = currentRows === 0 ? [headers, ...rows] : rows;
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rowsToWrite },
      });
    };

    // Helper: get rows
    const getRows = async (sheetName: string) => {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:Z` });
        return res.data.values || [];
      } catch (e) {
        return []; // fail gracefully if sheet doesn't exist yet
      }
    };

    // ── Process Deletions ──────────────────────────────────────────────────
    const requests: any[] = [];
    
    if ((deletedCustomerIds && deletedCustomerIds.length > 0) || (deletedSaleIds && deletedSaleIds.length > 0)) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const customerSheetId = meta.data.sheets?.find(s => s.properties?.title === "Customer")?.properties?.sheetId;
      const creditSheetId = meta.data.sheets?.find(s => s.properties?.title === "Credit")?.properties?.sheetId;

      if (deletedCustomerIds && deletedCustomerIds.length > 0 && customerSheetId !== undefined) {
        const currentCustomers = await getRows("Customer");
        const rowsToDelete: number[] = [];
        for (let i = 1; i < currentCustomers.length; i++) {
          if (deletedCustomerIds.includes(currentCustomers[i][0])) {
            rowsToDelete.push(i);
          }
        }
        rowsToDelete.sort((a, b) => b - a);
        for (const rowIndex of rowsToDelete) {
          requests.push({
            deleteDimension: {
              range: { sheetId: customerSheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
            }
          });
        }
      }

      if (deletedSaleIds && deletedSaleIds.length > 0 && creditSheetId !== undefined) {
        const currentCredits = await getRows("Credit");
        const rowsToDelete: number[] = [];
        for (let i = 1; i < currentCredits.length; i++) {
          if (deletedSaleIds.includes(currentCredits[i][0])) {
            rowsToDelete.push(i);
          }
        }
        rowsToDelete.sort((a, b) => b - a);
        for (const rowIndex of rowsToDelete) {
          requests.push({
            deleteDimension: {
              range: { sheetId: creditSheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
            }
          });
        }
      }

      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests }
        });
      }
    }

    // ── Refetch data to get accurate row indices for Updates ────────────────
    const currentCustomers = await getRows("Customer");
    const currentCredits = await getRows("Credit");

    const customerIdToRow = new Map<string, number>();
    currentCustomers.forEach((row, idx) => {
      if (row[0]) customerIdToRow.set(row[0], idx + 1);
    });

    const creditIdToRow = new Map<string, number>();
    currentCredits.forEach((row, idx) => {
      if (row[0]) creditIdToRow.set(row[0], idx + 1);
    });

    // ── Process Customers (Upsert) ──────────────────────────────────────────
    const customerUpdates: any[] = [];
    const customerAppends: any[] = [];

    if (customers && customers.length > 0) {
      customers.forEach((c: any) => {
        const row = [
          c.id, c.name, c.phone || "", c.email || "", c.createdAt, c.updatedAt
        ];
        const rowIndex = customerIdToRow.get(c.id);
        if (rowIndex) {
          customerUpdates.push({
            range: `Customer!A${rowIndex}:F${rowIndex}`,
            values: [row]
          });
        } else {
          customerAppends.push(row);
        }
      });
    }

    // ── Process Credits (Upsert) ────────────────────────────────────────────
    const creditUpdates: any[] = [];
    const creditAppends: any[] = [];

    if (sales && sales.length > 0) {
      sales.forEach((s: any) => {
        const row = [
          s.id, s.customerId, s.customerName, s.customerPhone || "", s.date, s.description || "",
          s.totalAmount, s.amountPaid, s.balance, s.status,
          s.payments?.map((p: any) => `${p.method}: ₹${p.amount}`).join("; ") || "",
          s.notes || "", s.updatedAt,
        ];
        const rowIndex = creditIdToRow.get(s.id);
        if (rowIndex) {
          creditUpdates.push({
            range: `Credit!A${rowIndex}:M${rowIndex}`,
            values: [row]
          });
        } else {
          creditAppends.push(row);
        }
      });
    }

    // Execute Appends
    if (customerAppends.length > 0) await appendRows("Customer", CUSTOMER_HEADERS, customerAppends);
    if (creditAppends.length > 0) await appendRows("Credit", CREDIT_HEADERS, creditAppends);

    // Execute Updates
    const dataToUpdate = [...customerUpdates, ...creditUpdates];
    if (dataToUpdate.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: dataToUpdate
        }
      });
    }

    // ── Pull Final Data from Sheets ──────────────────────────────────────────
    const rawCustomers = await getRows("Customer");
    const rawCredits = await getRows("Credit");

    const pulledCustomers = rawCustomers.slice(1).map((row, index) => ({
      id: row[0] || `imported-cust-${index}`,
      name: row[1] || "Unknown Client",
      phone: row[2] || "",
      email: row[3] || "",
      createdAt: row[4] || new Date().toISOString(),
      updatedAt: row[5] || new Date().toISOString(),
    }));

    const pulledSales = rawCredits.slice(1).map((row, index) => {
      const paymentsStr = row[10] || "";
      let payments = [];
      if (paymentsStr) {
        payments = paymentsStr.split("; ").map((p: string, pIdx: number) => {
          const [method, amt] = p.split(": ₹");
          return {
            id: `imported-payment-${index}-${pIdx}`,
            method: method || "Cash",
            amount: parseFloat(amt) || 0,
            date: row[4] || new Date().toISOString()
          };
        });
      }

      return {
        id: row[0] || `imported-credit-${index}`,
        customerId: row[1] || "",
        customerName: row[2] || "Unknown",
        customerPhone: row[3] || "",
        date: row[4] || new Date().toISOString(),
        description: row[5] || "",
        totalAmount: parseFloat(row[6]) || 0,
        amountPaid: parseFloat(row[7]) || 0,
        balance: parseFloat(row[8]) || 0,
        status: row[9] || "Pending",
        payments,
        notes: row[11] || "",
        updatedAt: row[12] || new Date().toISOString(),
        synced: true,
      };
    });

    return NextResponse.json({
      success: true,
      synced: { customers: customers?.length ?? 0, sales: sales?.length ?? 0 },
      pulledCustomers,
      pulledSales
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    const msg = error?.cause?.message || error?.message || String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
