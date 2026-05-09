import { upsertSession, getSessionId } from "@/lib/session-manager";
import { addToOfflineQueue } from "@/lib/offline-queue";

// Shared types and simple state manager using localStorage

export interface PendapatanItem {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  uraian: string;
  anggaran: number;
  /** @deprecated PAK dihapus per revisi klien — disimpan opsional untuk backward compat data lama */
  perubahanAnggaran?: number;
  sumberDana: string;
  jumlahSatuan: string;
  hargaSatuan: number;
}

export interface BelanjaItem {
  id: string;
  kodeBidang: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeRekening: string;
  namaRekening: string;
  nomorUrut: string;
  uraian: string;
  anggaran: number;
  /** @deprecated PAK dihapus per revisi klien */
  perubahanAnggaran?: number;
  jumlahSatuan: string;
  hargaSatuan: number;
  sumberDana: string;
}

export interface PembiayaanItem {
  id: string;
  jenis: 'penerimaan' | 'pengeluaran';
  kodeRekening: string;
  namaRekening: string;
  uraian: string;
  anggaran: number;
  /** @deprecated PAK dihapus per revisi klien */
  perubahanAnggaran?: number;
  jumlahSatuan: string;
  hargaSatuan: number;
  sumberDana: string;
}

export interface PenerimaanRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  sumberDana: string;
  nilai: number;
}

export interface PenerimaanItem {
  id: string;
  jenis: 'tunai' | 'bank' | 'silpa';
  tanggal: string;
  noBukti: string;
  uraian: string;
  jumlah: number;
  kodeRekening: string;
  namaRekening: string;
  penyetor: string;
  nama: string;
  alamat: string;
  ttd: string;
  rekening?: string;
  namaBank?: string;
  kppn?: string;
  rincian: PenerimaanRincian[];
  isProses?: boolean;
  /** Tunai yang sudah dipindahkan ke bank via Mutasi Kas */
  sudahMutasi?: boolean;
}

export interface SilpaRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  debet: number;
  kredit: number;
}

export interface SilpaItem {
  id: string;
  tanggal: string;
  nomorBukti: string;
  uraian: string;
  isProses: boolean;
  rincian: SilpaRincian[];
}

export interface SPPItem {
  id: string;
  jenis: 'panjar' | 'definitif' | 'pembiayaan';
  tanggalSPP: string;
  nomorSPP: string;
  uraian: string;
  jumlah: number;
  isFinal: boolean;
  rincian: SPPRincian[];
  buktiTransaksi: BuktiTransaksi[];
}

export interface SPPRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  nilai: number;
  belanjaId?: string;
  noRef?: string;
  kodeKegiatan?: string;
  kodeBidang?: string;
  namaKegiatan?: string;
}

export interface BuktiTransaksi {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  jumlah: number;
  penerima: string;
  nama: string;
  alamat: string;
  potonganPajak: PotonganPajak[];
}

export interface PotonganPajak {
  kodeRekening: string;
  namaRekening: string;
  nilai: number;
}

export interface PencairanSPP {
  id: string;
  sppId: string;
  nomorPencairan: string;
  tanggal: string;
  noCek: string;
  pembayaran: 'tunai' | 'bank';
  jumlah: number;
  potongan: number;
  netto: number;
  /** Tunai yang sudah dipindahkan ke bank via Mutasi Kas */
  sudahMutasi?: boolean;
}

export interface PenyetoranPajak {
  id: string;
  tanggal: string;
  noBukti: string;
  kodeRekening: string;
  kodeMAP: string;
  keterangan: string;
  jumlah: number;
  ntpn: string;
  jenis: 'tunai' | 'bank';
  rincianBuktiPotong: { noBukti: string; kodeRekening: string; namaRekening: string; nilai: number }[];
  /** ID-ID potongan asal yang sudah di-link ke penyetoran ini (untuk cegah double setor) */
  sumberPotonganIds?: string[];
}

export interface SaldoAwalItem {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  debet: number;
  kredit: number;
}

export interface SPJRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  nilai: number;
  belanjaId?: string;
  noRef?: string;
  kodeKegiatan?: string;
  namaKegiatan?: string;
}

export interface SPJPanjarItem {
  id: string;
  sppId: string;
  tanggalSPJ: string;
  nomorSPJ: string;
  nomorSPP: string;
  jumlahCair: number;
  jumlahSPJ: number;
  sisa: number;
  keterangan: string;
  /** Sub-data baru per revisi klien (SPJ Panjar Kegiatan) */
  rincianSPJ?: SPJRincian[];
  buktiKwitansi?: BuktiTransaksi[];
  potongan?: PotonganPajak[];
}

export interface SisaPanjarItem {
  id: string;
  spjId: string;
  nomorSPJ: string;
  tanggal: string;
  buktiNo: string;
  nominal: number;
  keterangan?: string;
}

export interface JurnalUmumItem {
  id: string;
  tanggal: string;
  kodeBuku: string;
  nomorBukti: string;
  uraian: string;
  posting: boolean;
  rincian: JurnalRincian[];
}

export interface JurnalRincian {
  id: string;
  kodeRekening: string;
  uraian: string;
  debet: number;
  kredit: number;
}

export interface MutasiKasItem {
  id: string;
  tanggal: string;
  noBukti: string;
  jenis: 'setor' | 'ambil';
  uraian: string;
  jumlah: number;
  rekening: string;
  namaBank: string;
  /** ID transaksi asal jika otomatis */
  sourceId?: string;
  sourceType?: 'penerimaan' | 'pencairan';
}

const STORAGE_KEY = 'siskeudes_state';

export interface KegiatanAnggaranItem {
  id: string;
  kodeBidang: string;
  kodeSubBidang: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  waktuPelaksanaan: string;
  namaPelaksana: string;
  jabatanPelaksana: string;
  keluaran: string;
  volumeKeluaran: string;
  sumberDana: string;
  paguAnggaran: number;
  outputItems: OutputItemState[];
}

export interface OutputItemState {
  id: string;
  namaPaket: string;
  nilai: number;
  targetOutput: string;
  satuan: string;
  sumberDana: string;
  keterangan: string;
}

/** Versioning meta for merge-on-receive */
export interface EntityMeta {
  v: number;
  t: number; // updated timestamp ms
  by: string; // session id
}

export interface AppState {
  pendapatan: PendapatanItem[];
  belanja: BelanjaItem[];
  pembiayaan: PembiayaanItem[];
  penerimaan: PenerimaanItem[];
  silpa: SilpaItem[];
  spp: SPPItem[];
  pencairan: PencairanSPP[];
  penyetoranPajak: PenyetoranPajak[];
  saldoAwal: SaldoAwalItem[];
  spjPanjar: SPJPanjarItem[];
  sisaPanjar?: SisaPanjarItem[];
  jurnalUmum: JurnalUmumItem[];
  mutasiKas: MutasiKasItem[];
  kegiatanAnggaran: KegiatanAnggaranItem[];
  /** key: `${collection}:${id}` → version meta. Used by merge engine. */
  __meta?: Record<string, EntityMeta>;
}

const defaultState: AppState = {
  pendapatan: [],
  belanja: [],
  pembiayaan: [],
  penerimaan: [],
  silpa: [],
  spp: [],
  pencairan: [],
  penyetoranPajak: [],
  saldoAwal: [],
  spjPanjar: [],
  sisaPanjar: [],
  jurnalUmum: [],
  mutasiKas: [],
  kegiatanAnggaran: [],
  __meta: {},
};

const COLLECTIONS = [
  'pendapatan','belanja','pembiayaan','penerimaan','silpa','spp',
  'pencairan','penyetoranPajak','saldoAwal','spjPanjar','sisaPanjar',
  'jurnalUmum','mutasiKas','kegiatanAnggaran',
] as const;

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const state: AppState = { ...defaultState, ...parsed, __meta: parsed.__meta || {} };

    // Migration logic per client revision (one-time migration check)
    let migrated = false;
    if (state.spp && state.spp.length > 0) {
      state.spp.forEach(spp => {
        if (spp.jenis === 'panjar' && spp.buktiTransaksi && spp.buktiTransaksi.length > 0) {
          // Find first SPJ for this SPP
          const firstSpj = state.spjPanjar?.find(spj => spj.sppId === spp.id);
          if (firstSpj) {
            // If SPJ has no bukti yet, migrate them from SPP
            if (!firstSpj.buktiKwitansi || firstSpj.buktiKwitansi.length === 0) {
              firstSpj.buktiKwitansi = [...spp.buktiTransaksi];
              
              // Also migrate potongan to SPJ level if not present
              const allPot = spp.buktiTransaksi.flatMap(bt => bt.potonganPajak || []);
              if (allPot.length > 0 && (!firstSpj.potongan || firstSpj.potongan.length === 0)) {
                firstSpj.potongan = allPot;
              }
              
              // We keep bukti in SPP for safety/backward-compat as per plan, 
              // but SPJ now owns them for the new UI.
              migrated = true;
            }
          }
        }
      });
    }

    if (migrated) {
      // If we did a migration, we should save it back to localStorage
      // But we can't call saveState here as it would be circular/recursive.
      // We'll just update localStorage directly.
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    }

    return state;
  } catch {
    return { ...defaultState };
  }
}

/**
 * Bump version metadata for entities that changed compared to previous state.
 * Called inside saveState so every write also stamps versions.
 */
function bumpVersions(prev: AppState, next: AppState): AppState {
  const me = (() => { try { return getSessionId(); } catch { return 'local'; } })();
  const meta: Record<string, EntityMeta> = { ...(next.__meta || prev.__meta || {}) };
  const now = Date.now();
  for (const col of COLLECTIONS) {
    const prevArr = (prev[col] as { id: string }[] | undefined) || [];
    const nextArr = (next[col] as { id: string }[] | undefined) || [];
    const prevMap = new Map(prevArr.map(x => [x.id, x]));
    const nextMap = new Map(nextArr.map(x => [x.id, x]));
    // Updated or new
    for (const [id, item] of nextMap) {
      const before = prevMap.get(id);
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
        const cur = meta[`${col}:${id}`];
        meta[`${col}:${id}`] = { v: (cur?.v || 0) + 1, t: now, by: me };
      }
    }
    // Deleted: leave a tombstone so merge knows
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        const cur = meta[`${col}:${id}`];
        meta[`${col}:${id}`] = { v: (cur?.v || 0) + 1, t: now, by: me };
        meta[`${col}:${id}__deleted`] = { v: 1, t: now, by: me };
      }
    }
  }
  return { ...next, __meta: meta };
}

/**
 * Three-way merge of incoming remote state into local state, per-entity by id.
 * - Higher meta.v wins; tie → newer t wins; tie → remote wins (deterministic).
 * - Tombstones (`${col}:${id}__deleted`) remove the entity if their version >= local v.
 * - Collections without ids (or scalars) are last-write-wins by overall meta timestamp.
 */
export function mergeStates(local: AppState, remote: Partial<AppState>): AppState {
  const out: AppState = { ...local, __meta: { ...(local.__meta || {}) } };
  const remoteMeta = remote.__meta || {};
  const meta = out.__meta!;

  const winner = (col: string, id: string) => {
    const a = meta[`${col}:${id}`];
    const b = remoteMeta[`${col}:${id}`];
    if (!a) return 'remote';
    if (!b) return 'local';
    if (b.v > a.v) return 'remote';
    if (b.v < a.v) return 'local';
    if (b.t > a.t) return 'remote';
    if (b.t < a.t) return 'local';
    return 'remote';
  };

  for (const col of COLLECTIONS) {
    const localArr = (local[col] as { id: string }[] | undefined) || [];
    const remoteArr = (remote[col] as { id: string }[] | undefined) || [];
    const map = new Map<string, { id: string }>();
    for (const x of localArr) map.set(x.id, x);
    for (const r of remoteArr) {
      const w = winner(col, r.id);
      if (w === 'remote') map.set(r.id, r);
    }
    // Apply tombstones
    for (const key of Object.keys(remoteMeta)) {
      if (!key.startsWith(`${col}:`) || !key.endsWith('__deleted')) continue;
      const id = key.slice(col.length + 1, -('__deleted'.length));
      
      // Optimistic protection: if it's pending local, don't delete
      const pending: Record<string, number> = JSON.parse(localStorage.getItem('siskeudes_pending_writes') || '{}');
      if (pending[`${col}:${id}`]) continue;

      const w = winner(col, id);
      if (w === 'remote') map.delete(id);
    }
    // Merge meta
    for (const [k, v] of Object.entries(remoteMeta)) {
      if (!k.startsWith(`${col}:`)) continue;
      const cur = meta[k];
      if (!cur || v.v > cur.v || (v.v === cur.v && v.t > cur.t)) meta[k] = v;
    }
    (out as unknown as Record<string, unknown[]>)[col] = Array.from(map.values());
  }
  return out;
}

// Debounced backend push so a burst of saveState() calls collapses into ONE round-trip.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;
let lastPushedState = "";

async function flushPush() {
  pushTimer = null;
  const state = pendingState;
  pendingState = null;
  if (!state) return;
  try {
    if (localStorage.getItem('siskeudes_admin_impersonate')) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastPushedState) return;

    window.dispatchEvent(new CustomEvent("siskeudes:sync-status", { detail: "syncing" }));

    lastPushedState = serialized;
    const payload = JSON.parse(serialized) as Record<string, unknown>;
    localStorage.setItem('siskeudes_last_local_write_at', String(Date.now()));
    await upsertSession({ form_data: payload });

    // Clear pending writes after successful sync
    localStorage.removeItem('siskeudes_pending_writes');

    window.dispatchEvent(new CustomEvent("siskeudes:sync-status", { detail: "saved" }));
    window.dispatchEvent(new CustomEvent("siskeudes:dirty", { detail: false }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("siskeudes:sync-status", { detail: "idle" }));
    }, 2000);
  } catch (error) {
    console.error("Sync failed:", error);
    window.dispatchEvent(new CustomEvent("siskeudes:sync-status", { detail: "error" }));
    window.dispatchEvent(new CustomEvent("siskeudes:dirty", { detail: true }));
    await addToOfflineQueue("form_data", serialized);
  }
}

export function flushSaveStateNow() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    flushPush();
  }
}

export function saveState(state: AppState, immediate = false) {
  const prev = loadState();
  const next = bumpVersions(prev, state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  try { localStorage.setItem('siskeudes_app_state', JSON.stringify(next)); } catch { /* ignore */ }

  // Track pending writes for optimistic restore during merge
  try {
    const pending: Record<string, number> = JSON.parse(localStorage.getItem('siskeudes_pending_writes') || '{}');
    const now = Date.now();
    for (const col of COLLECTIONS) {
      const arr = (next[col] as { id: string }[] | undefined) || [];
      arr.forEach(item => {
        pending[`${col}:${item.id}`] = now;
      });
    }
    localStorage.setItem('siskeudes_pending_writes', JSON.stringify(pending));
  } catch(e) {}

  pendingState = next;
  if (pushTimer) clearTimeout(pushTimer);

  window.dispatchEvent(new CustomEvent("siskeudes:dirty", { detail: true }));

  if (immediate) {
    flushPush();
  } else {
    pushTimer = setTimeout(flushPush, 200);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    import('@/lib/offline-queue').then(({ flushOfflineQueue }) => {
      flushOfflineQueue(async (payload: string) => {
        const data = JSON.parse(payload);
        await upsertSession({ form_data: data });
      }).then(({ flushed, failed }) => {
        if (flushed > 0) {
          window.dispatchEvent(new CustomEvent('siskeudes:sync-status', { detail: 'saved' }));
          window.dispatchEvent(new CustomEvent('siskeudes:dirty', { detail: failed > 0 }));
        }
      });
    });
  });
}
