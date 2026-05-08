## Ringkasan
Eksekusi 6 paket revisi besar berdasarkan masukan klien. Saya kelompokkan agar tidak ada salah tangkap dan agar setiap perubahan dapat diuji secara terpisah.

---

## A. Rebrand Visual (Background Sawah-Sunset)

**File baru / diubah:**
- `src/assets/bg-sawah-sunset.jpg` — copy dari upload pengguna
- `src/index.css` — palet warna (HSL) baru:
  - `--background`: hijau sawah lembut
  - `--primary`: amber sunset (oranye keemasan)
  - `--accent`: ungu-lavender langit senja
  - `--secondary`: krem hangat
  - Glassmorphism panel: `backdrop-blur-xl bg-card/70`
- `src/components/AppLayout.tsx` — pasang background fullscreen (fixed, cover) dengan overlay gradient gelap-tipis agar teks tetap terbaca
- Splash screen / `Beranda.tsx` — gunakan gambar yang sama sebagai hero, tagline tetap

Semua perubahan via design tokens — tidak ada warna hardcoded di komponen.

---

## B. Sinkronisasi Data Antar Pengguna (PRIORITAS KRITIS)

**Masalah:** input user A tertimpa user B karena setiap klien melakukan `saveState` penuh (full-document overwrite). Realtime payload terakhir menang.

**Solusi: Merge-on-Receive + Per-Entity Versioning**

1. `src/data/app-state.ts`:
   - Tambah `__meta.entityVersions: Record<string, { v: number; updatedAt: number; updatedBy: string }>` keyed by `entityType:id`
   - `saveState` naikkan versi hanya entitas yang berubah (deep diff per koleksi)
   - Tambah util `mergeStates(local, remote)` — strategi:
     - Untuk array koleksi (pendapatan, belanja, spp, dll.): merge by `id`, pilih versi tertinggi; jika sama → `updatedAt` terbaru
     - Untuk konfigurasi/desa: last-write-wins per field
2. `src/hooks/use-group-realtime-sync.ts`:
   - Ganti `applyIncomingState` menjadi `mergeIncomingState` — TIDAK lagi overwrite, tapi merge entitas
   - Hilangkan kemungkinan kehilangan input bersamaan pada modul Pendapatan, Belanja, SPP, SPJ, Penerimaan, Mutasi Kas, dll.
3. Tambah optimistic write log lokal (`siskeudes_pending_writes`) — bila merge incoming menghapus item yang masih pending lokal, item lokal di-restore.
4. Kurangi debounce push ke 100ms untuk entitas kecil; broadcast hanya delta perubahan via channel.

---

## C. Restrukturisasi SPP Panjar & SPJ Kegiatan

**SPP Panjar** (`src/pages/SPPPanjar.tsx`) — kurangi jadi **2 tab**:
1. SPP
2. Rincian SPP

Hapus tab Bukti Pengeluaran & Potongan dari halaman ini (data lama tetap di-state untuk migrasi, tapi UI tidak menampilkan).

**SPJ Kegiatan** (`src/pages/SPJKegiatan.tsx`) — restrukturisasi jadi **2 menu utama**:

### Menu 1: SPJ Panjar Kegiatan
Form fields:
1. No SPP (dropdown — list SPP Panjar Final)
2. No SPJ (auto-generate)
3. Rincian SPJ (sub-table, link ke rincian SPP terpilih)
4. Bukti Kwitansi (sub-table — pindahan dari SPP Panjar lama)
5. Potongan (sub-table — pindahan dari SPP Panjar lama; tiap potongan auto-feed ke Penyetoran Pajak)

### Menu 2: Sisa Panjar
Form fields:
1. No SPJ (pilih SPJ panjar yang sudah ada)
2. Bukti Sisa (nominal sisa kembali ke kas)

**Tipe baru di app-state:**
```ts
SPJPanjarItem += { rincianSPJ: SPJRincian[]; buktiKwitansi: BuktiTransaksi[]; potongan: PotonganPajak[] }
SisaPanjarItem = { id, spjId, noSPJ, tanggal, nominal, buktiNo }
```

Migrasi data lama: bila SPP panjar lama punya bukti/potongan, otomatis dipindahkan ke SPJ pertama untuk SPP tersebut (one-time migration di `loadState`).

---

## D. Otomatisasi Penyetoran Pajak

`src/pages/PenyetoranPajak.tsx` + `src/lib/financial-engine.ts`:

- Tambah selector `getAllPotonganPajak(state)` yang mengumpulkan SEMUA potongan dari:
  - SPJ Kegiatan (Panjar)
  - SPP Definitif
  - SPP Pembiayaan
  - Bukti Pengeluaran lain yang punya potongan
- Setiap entry membawa metadata: `{ sumber: "SPJ Kegiatan" | "SPP Definitif" | ..., refNo: string, tanggal, kodeRekening, namaRekening, nilai }`
- Halaman Penyetoran Pajak menampilkan tabel "Potongan Belum Disetor" + tombol "Setor" → buat record penyetoran dengan `sumberAsal` ter-prefill dan terkunci (read-only).
- Status `sudahDisetor` ditandai pada potongan asal (via id mapping) — bukan duplikasi.

---

## E. Penerimaan Desa — Tunai → Mutasi Kas → Bank

`src/pages/PenerimaanDesa.tsx` + `src/pages/MutasiKas.tsx` + `src/pages/LaporanBKU.tsx`:

**Aturan baru:**
- Penerimaan **Tunai** → catat di Buku Kas Tunai saja (BKU); TIDAK menambah Buku Bank.
- Untuk masuk ke Bank harus melalui **Mutasi Kas**:
  - Form Mutasi Kas baru menampilkan opsi "Sumber: Penerimaan Tunai Belum Dimutasi" → user pilih satu/lebih entry → nominal terjumlah → catat sebagai mutasi (Keluar Kas Tunai → Masuk Kas Bank).
  - Penerimaan Tunai yang sudah dimutasi diberi flag `sudahMutasi: true` agar tidak muncul lagi di pilihan.
- Penerimaan **Bank** tetap langsung masuk Buku Bank (tidak melalui mutasi).
- Laporan BKU diperbarui: Penerimaan Tunai tidak menambah baris "penerimaan bank"; mutasi muncul sebagai pasangan keluar-masuk.

---

## F. Laporan Penjabaran APBDes

`src/pages/LaporanPenjabaran.tsx`:
- Hapus kolom **Perubahan** dan **Sumber Dana**
- Sisakan kolom: Kode | Uraian | **Anggaran** | **Setelah PAK**
- Update PDF export di `src/lib/pdf-export.ts` mengikuti struktur baru (header tabel, lebar kolom, dan total).

---

## Teknis & QA
- Tidak menyentuh `src/integrations/supabase/client.ts` & `types.ts`.
- Tidak ada perubahan skema DB — semua merge logic berjalan di klien (form_data JSON).
- Setelah implementasi: smoke-check via build + scroll preview tiap modul terdampak.
- Memory: simpan keputusan struktural baru (SPP Panjar 2-tab, SPJ 2-menu, alur Tunai→Mutasi, Penjabaran 2 kolom anggaran) di `mem://logic/*`.

---

## Urutan Eksekusi
1. App-state: tipe baru + merge engine + migrasi
2. Realtime hook merge mode
3. SPP Panjar (kurangi tab)
4. SPJ Kegiatan (restrukturisasi 2 menu + sub-form)
5. Penyetoran Pajak otomatis
6. Penerimaan Tunai → Mutasi Kas
7. Laporan Penjabaran (hapus kolom)
8. Rebrand visual (background + palet)
9. Update memory

Setelah Anda setujui, saya eksekusi seluruhnya berurutan dalam satu sesi.