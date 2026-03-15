/**
 * IndexedDB service for offline help requests.
 * Syncs to server when window.ononline fires.
 */

const DB_NAME = 'reliefLink_offline';
const DB_VERSION = 3;
const STORE_NAME = 'help_requests';
const SHIPMENTS_STORE = 'shipments';
const VOICE_SOS_STORE = 'voice_sos';

export interface HelpRequest {
  id: string;
  lat: number;
  lng: number;
  message: string;
  timestamp: number;
  synced: boolean;
  /** AI severity 1-10 from Criss analysis; default 7 if unknown */
  severity?: number;
  /** Guest ID for anonymous emergency users (RL-GUEST-xxxx) */
  guestId?: string;
}

export interface VoiceSosRecord {
  id: string;
  lat: number;
  lng: number;
  audioBlob: Blob;
  transcript: string;
  timestamp: number;
  synced: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SHIPMENTS_STORE)) {
        db.createObjectStore(SHIPMENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VOICE_SOS_STORE)) {
        db.createObjectStore(VOICE_SOS_STORE, { keyPath: 'id' });
      }
    };
  });
}

/** Save voice SOS to VOICE_SOS_STORE - audio blob + transcript for offline sync when signal returns */
export async function saveVoiceSos(
  lat: number,
  lng: number,
  audioBlob: Blob,
  transcript: string = 'Voice SOS - Need assistance'
): Promise<string> {
  const db = await openDb();
  const id = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const record: VoiceSosRecord = {
    id,
    lat,
    lng,
    audioBlob,
    transcript,
    timestamp: Date.now(),
    synced: false,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_SOS_STORE, 'readwrite');
    const store = tx.objectStore(VOICE_SOS_STORE);
    const req = store.add(record);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getUnsyncedVoiceSos(): Promise<VoiceSosRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_SOS_STORE, 'readonly');
    const store = tx.objectStore(VOICE_SOS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as VoiceSosRecord[];
      resolve(all.filter((r) => !r.synced));
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function markVoiceSosSynced(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_SOS_STORE, 'readwrite');
    const store = tx.objectStore(VOICE_SOS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as VoiceSosRecord | undefined;
      if (record) {
        record.synced = true;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveHelpRequest(request: Omit<HelpRequest, 'id' | 'synced'>): Promise<string> {
  const db = await openDb();
  const id = `help_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const record: HelpRequest = {
    ...request,
    id,
    synced: false,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getUnsyncedRequests(): Promise<HelpRequest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as HelpRequest[];
      resolve(all.filter((r) => !r.synced));
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get all help requests for ER Priority Queue (sorted by severity desc, then timestamp) */
export async function getAllHelpRequests(): Promise<HelpRequest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as HelpRequest[]).sort((a, b) => {
        const sevA = a.severity ?? 7;
        const sevB = b.severity ?? 7;
        if (sevB !== sevA) return sevB - sevA;
        return b.timestamp - a.timestamp;
      });
      resolve(all);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export interface PendingShipment {
  id: string;
  pickup: string;
  destination: string;
  packageType: string;
  packageSize: string;
  priority: string;
  deadline: string | null;
  distanceKm?: number;
  etaMinutes?: number;
  timestamp: number;
  synced: boolean;
}

export async function saveShipmentOffline(data: Omit<PendingShipment, 'id' | 'timestamp' | 'synced'>): Promise<string> {
  const db = await openDb();
  const id = `ship_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const record: PendingShipment = {
    ...data,
    id,
    timestamp: Date.now(),
    synced: false,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHIPMENTS_STORE, 'readwrite');
    const store = tx.objectStore(SHIPMENTS_STORE);
    const req = store.add(record);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function markShipmentSynced(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHIPMENTS_STORE, 'readwrite');
    const store = tx.objectStore(SHIPMENTS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.synced = true;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.synced = true;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}
