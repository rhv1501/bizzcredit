import { format } from "date-fns";
import type { Sale } from "@/types";

/**
 * Format a phone number for WhatsApp (needs international format without +)
 * Assumes Indian numbers (+91) if no country code provided.
 */
export function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  // If they already typed 91 or 091 at the start:
  if (digits.length > 10 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * Generates a wa.me link with pre-filled text.
 */
export function getWhatsAppLink(phone: string, message: string): string {
  if (!phone) return "";
  const formattedPhone = formatWhatsAppNumber(phone);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates a standard receipt message for a new credit entry
 */
export function generateReceiptMessage(customerName: string, credit: Partial<Sale>, balance: number): string {
  const dateStr = format(new Date(credit.date || new Date()), "dd MMM yyyy");
  
  let msg = `Hi ${customerName},\n\n` +
    `Here is the receipt for your recent transaction with BizzCredit on ${dateStr}.\n\n` +
    `📝 *Description:* ${credit.description}\n` +
    `💰 *Total Amount:* ₹${credit.totalAmount?.toLocaleString("en-IN")}\n`;

  if (credit.amountPaid && credit.amountPaid > 0) {
    msg += `✅ *Paid Now:* ₹${credit.amountPaid.toLocaleString("en-IN")}\n`;
  }

  if (balance > 0) {
    msg += `⚠️ *Balance added to Credit:* ₹${balance.toLocaleString("en-IN")}\n`;
  } else {
    msg += `🎉 *Balance Due:* ₹0 (Fully Paid!)\n`;
  }

  msg += `\nThank you for your business!`;
  return msg;
}

/**
 * Generates a payment reminder message
 */
export function generateReminderMessage(customerName: string, credit: Sale): string {
  const dateStr = format(new Date(credit.date), "dd MMM yyyy");
  
  return `Hi ${customerName},\n\n` +
    `This is a gentle reminder from BizzCredit regarding a pending balance.\n\n` +
    `📝 *Details:* ${credit.description} (from ${dateStr})\n` +
    `⚠️ *Pending Balance:* ₹${credit.balance.toLocaleString("en-IN")}\n\n` +
    `Please clear this amount at your earliest convenience. Thank you!`;
}

/**
 * Generates an overall payment reminder message for all pending credits
 */
export function generateOverallReminderMessage(customerName: string, totalDue: number, pendingCount: number): string {
  return `Hi ${customerName},\n\n` +
    `This is a gentle reminder from BizzCredit regarding your overall pending balance.\n\n` +
    `You have ${pendingCount} pending credit record(s).\n` +
    `⚠️ *Total Pending Balance:* ₹${totalDue.toLocaleString("en-IN")}\n\n` +
    `Please clear this amount at your earliest convenience. Thank you!`;
}

/**
 * Generates a receipt message when a payment is recorded against a balance
 */
export function generatePaymentReceiptMessage(customerName: string, amountPaid: number, remainingBalance: number): string {
  const dateStr = format(new Date(), "dd MMM yyyy, hh:mm a");
  
  let msg = `Hi ${customerName},\n\n` +
    `We have received your payment of ₹${amountPaid.toLocaleString("en-IN")} on ${dateStr}.\n\n`;

  if (remainingBalance > 0) {
    msg += `⚠️ *Remaining Balance:* ₹${remainingBalance.toLocaleString("en-IN")}\n`;
  } else {
    msg += `🎉 *Your balance is now fully cleared (₹0)!*\n`;
  }

  msg += `\nThank you for your business!`;
  return msg;
}

