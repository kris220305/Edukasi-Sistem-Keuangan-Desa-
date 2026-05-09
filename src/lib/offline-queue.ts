const DB_NAME = "siskeudes_offline_queue";
const STORE_NAME = "pending_syncs";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

export interface PendingSync {
  id?: number;
  key: string;
  payload: string;
  timestamp: number;
  retryCount: number;
}

export async function addToOfflineQueue(key: string, payload: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.add({ key, payload, timestamp: Date.now(), retryCount: 0 });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore */ }
}

export async function getAllPendingSyncs(): Promise<PendingSync[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function removePendingSync(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore */ }
}

export async function updatePendingSyncRetry(id: number, count: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.retryCount = count;
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch { /* ignore */ }
}

const MAX_RETRIES = 5;

export async function flushOfflineQueue(
  pushFn: (payload: string) => Promise<void>
): Promise<{ flushed: number; failed: number }> {
  const pending = await getAllPendingSyncs();
  let flushed = 0;
  let failed = 0;

  for (const item of pending) {
    if (item.retryCount >= MAX_RETRIES) {
      await removePendingSync(item.id!);
      failed++;
      continue;
    }
    try {
      await pushFn(item.payload);
      await removePendingSync(item.id!);
      flushed++;
    } catch {
      await updatePendingSyncRetry(item.id!, item.retryCount + 1);
      failed++;
    }
  }

  return { flushed, failed };
}
