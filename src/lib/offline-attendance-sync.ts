import type { AttendancePunchType } from "@/lib/attendance-records";

export type OfflineAttendanceQueueItem = {
  client_id: string;
  employee_id: string;
  type: AttendancePunchType;
  created_at: number;
  attempts: number;
  next_attempt_at: number;
  image_blob: Blob;
};

const DB_NAME = "hris-offline";
const DB_VERSION = 1;
const STORE = "attendanceQueue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "client_id" });
        store.createIndex("next_attempt_at", "next_attempt_at", { unique: false });
        store.createIndex("created_at", "created_at", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

function idb<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export function makeClientId(): string {
  // Matches requirement: Date.now() + Math.random()
  return `${Date.now()}-${Math.random()}`;
}

export async function enqueueOfflineAttendancePunch(input: {
  employee_id: string;
  type: AttendancePunchType;
  image_blob: Blob;
}): Promise<OfflineAttendanceQueueItem> {
  if (typeof indexedDB === "undefined") {
    throw new Error("Offline queue requires a browser environment");
  }
  const employeeId = input.employee_id.trim();
  if (!employeeId) throw new Error("employee_id is missing");

  const now = Date.now();
  const item: OfflineAttendanceQueueItem = {
    client_id: makeClientId(),
    employee_id: employeeId,
    type: input.type,
    created_at: now,
    attempts: 0,
    next_attempt_at: now,
    image_blob: input.image_blob,
  };

  const db = await openDb();
  await idb(db, "readwrite", store => store.add(item));
  db.close();
  return item;
}

export async function listDueOfflineAttendancePunches(now = Date.now()): Promise<OfflineAttendanceQueueItem[]> {
  const db = await openDb();
  const all = await idb<OfflineAttendanceQueueItem[]>(db, "readonly", store => store.getAll());
  db.close();
  return (all ?? []).filter(i => (i.next_attempt_at ?? 0) <= now).sort((a, b) => a.created_at - b.created_at);
}

export async function removeOfflineAttendancePunch(client_id: string): Promise<void> {
  const db = await openDb();
  await idb(db, "readwrite", store => store.delete(client_id));
  db.close();
}

export async function updateOfflineAttendancePunch(
  client_id: string,
  patch: Partial<Pick<OfflineAttendanceQueueItem, "attempts" | "next_attempt_at">>
): Promise<void> {
  const db = await openDb();
  const current = await idb<OfflineAttendanceQueueItem | undefined>(db, "readonly", store => store.get(client_id));
  if (!current) {
    db.close();
    return;
  }
  const updated: OfflineAttendanceQueueItem = { ...current, ...patch };
  await idb(db, "readwrite", store => store.put(updated));
  db.close();
}

export function computeNextAttemptAt(attempts: number): number {
  // Exponential backoff with cap: 2s, 4s, 8s, ... up to 5 minutes.
  const baseMs = 2000;
  const maxMs = 5 * 60 * 1000;
  const delay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempts)));
  return Date.now() + delay;
}

