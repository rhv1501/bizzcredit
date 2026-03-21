import Dexie, { type EntityTable } from 'dexie';
import type { Customer, Sale, CustomerRecord } from '@/types';

export const db = new Dexie('BizzCreditDB') as Dexie & {
  customers: EntityTable<Customer, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  records: EntityTable<CustomerRecord, 'id'>; // legacy compat
  deletedSyncs: EntityTable<{ id: string, type: 'sale' | 'customer', timestamp: number }, 'id'>;
};

// Fresh schema – no migration needed
db.version(1).stores({
  customers: 'id, name, phone, createdAt, updatedAt',
  sales: 'id, customerId, customerName, date, status, synced, updatedAt',
  records: 'id, name, phone, date, status, synced, updatedAt',
});

// V2 - added deletedSyncs
db.version(2).stores({
  deletedSyncs: 'id, type, timestamp',
});
