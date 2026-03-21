import Dexie, { type EntityTable } from 'dexie';
import type { Customer, Sale, CustomerRecord } from '@/types';

export const db = new Dexie('BizzCreditDB') as Dexie & {
  customers: EntityTable<Customer, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  records: EntityTable<CustomerRecord, 'id'>; // legacy compat
};

// Fresh schema – no migration needed
db.version(1).stores({
  customers: 'id, name, phone, createdAt, updatedAt',
  sales: 'id, customerId, customerName, date, status, synced, updatedAt',
  records: 'id, name, phone, date, status, synced, updatedAt',
});
