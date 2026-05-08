import { useState, useEffect } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { getRekeningDetail } from "@/data/rekening-data";
import { loadState, saveState, type PenerimaanItem, type PenerimaanRincian, type SilpaItem, type SilpaRincian } from "@/data/app-state";
import { getPendapatanOptions } from "@/lib/financial-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type Mode = "view" | "tambah" | "ubah";
type ActiveTab = "silpa" | "tunai" | "bank";

// ===================== SILPA TAB =====================
function SilpaTab() {
  const [items, setItems] = useState<SilpaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  const rekeningAset = getRekeningDetail("aset");

  const emptyForm: Omit<SilpaItem, "id"> = {
    tanggal: "", nomorBukti: "", uraian: "", isProses: false, rincian: [],
  };
  const [form, setForm] = useState(emptyForm);
  const [rincianForm, setRincianForm] = useState<Omit<SilpaRincian, "id">>({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });

  useEffect(() => { setItems(loadState().silpa || []); }, []);

  const save = (newItems: SilpaItem[]) => {
    setItems(newItems);
    const state = loadState();
    state.silpa = newItems;
    saveState(state);
  };

  const selectedItem = items.find(i => i.id === selectedId);
  const totalDebet = (selectedItem || (mode !== "view" ? { rincian: form.rincian } : null))?.rincian.reduce((s, r) => s + r.debet, 0) || 0;
  const totalKredit = (selectedItem || (mode !== "view" ? { rincian: form.rincian } : null))?.rincian.reduce((s, r) => s + r.kredit, 0) || 0;

  const handleTambah = () => { setMode("tambah"); setSelectedId(null); setForm({ ...emptyForm, rincian: [] }); };
  const handleUbah = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan diubah");
    setMode("ubah"); setForm({ ...selectedItem });
  };
  const handleHapus = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan dihapus");
    if (!confirm("Yakin hapus data ini?")) return;
    save(items.filter(i => i.id !== selectedItem.id)); setSelectedId(null); toast.success("Data dihapus");
  };
  const handleBatal = () => { setMode("view"); setForm(emptyForm); };
  const handleSimpan = () => {
    if (!form.tanggal) return toast.error("Isi tanggal");
    if (mode === "ubah" && selectedId) {
      save(items.map(i => i.id === selectedId ? { ...i, ...form } : i));
      toast.success("Data diperbarui");
    } else {
      const newItem: SilpaItem = { id: crypto.randomUUID(), ...form };
      save([...items, newItem]); setSelectedId(newItem.id);
      toast.success("Data SiLPA ditambahkan");
    }
    setMode("view"); setForm(emptyForm);
    trackFormProgress("penerimaan");
  };

  const handleProses = () => {
    if (!selectedItem) return toast.error("Pilih data");
    save(items.map(i => i.id === selectedItem.id ? { ...i, isProses: true } : i));
    toast.success("Data diproses");
  };
  const handleUnProses = () => {
    if (!selectedItem) return toast.error("Pilih data");
    save(items.map(i => i.id === selectedItem.id ? { ...i, isProses: false } : i));
    toast.success("Data di-unproses");
  };

  const addRincian = () => {
    if (!rincianForm.kodeRekening) return toast.error("Pilih rekening rincian");
    const newR: SilpaRincian = { id: crypto.randomUUID(), ...rincianForm };
    setForm({ ...form, rincian: [...form.rincian, newR] });
    setRincianForm({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });
  };
  const removeRincian = (id: string) => {
    setForm({ ...form, rincian: form.rincian.filter(r => r.id !== id) });
  };

  const displayRincian = mode !== "view" ? form.rincian : (selectedItem?.rincian || []);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-center uppercase tracking-wider text-primary">Realisasi SiLPA Tahun Sebelumnya</h2>

      {/* Master Table */}
      <div className="content-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead className="text-xs font-semibold w-8">#</TableHead>
              <TableHead className="text-xs font-semibold">Tanggal</TableHead>
              <TableHead className="text-xs font-semibold">Nomor Bukti / Ref</TableHead>
              <TableHead className="text-xs font-semibold">Uraian</TableHead>
              <TableHead className="text-xs font-semibold text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">Belum ada data SiLPA</TableCell></TableRow>
            ) : items.map((item, idx) => (
              <TableRow
                key={item.id}
                className={`cursor-pointer transition-colors ${selectedId === item.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/30"}`}
                onClick={() => { if (mode === "view") setSelectedId(item.id); }}
              >
                <TableCell className="text-xs">{idx + 1}</TableCell>
                <TableCell className="text-xs">{item.tanggal}</TableCell>
                <TableCell className="text-xs font-mono">{item.nomorBukti}</TableCell>
                <TableCell className="text-xs">{item.uraian}</TableCell>
                <TableCell className="text-xs text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.isProses ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {item.isProses ? "Proses" : "Belum"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Form */}
      <div className="content-card p-4">
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-4">
          <div>
            <Label className="text-xs">Tanggal</Label>
            {mode !== "view" ? (
              <Input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} className="h-8 text-xs" />
            ) : (
              <Input value={selectedItem?.tanggal || ""} readOnly className="h-8 text-xs bg-muted" />
            )}
          </div>
          <div>
            <Label className="text-xs">Nomor Bukti / Ref</Label>
            {mode !== "view" ? (
              <Input value={form.nomorBukti} onChange={e => setForm({ ...form, nomorBukti: e.target.value })} className="h-8 text-xs" />
            ) : (
              <Input value={selectedItem?.nomorBukti || ""} readOnly className="h-8 text-xs bg-muted" />
            )}
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" variant="outline" onClick={handleProses} disabled={mode !== "view" || !selectedItem}>Proses</Button>
            <Button size="sm" variant="outline" onClick={handleUnProses} disabled={mode !== "view" || !selectedItem}>UnProses</Button>
          </div>
          <div className="col-span-3">
            <Label className="text-xs">Uraian</Label>
            {mode !== "view" ? (
              <Input value={form.uraian} onChange={e => setForm({ ...form, uraian: e.target.value })} className="h-8 text-xs" />
            ) : (
              <Input value={selectedItem?.uraian || ""} readOnly className="h-8 text-xs bg-muted" />
            )}
          </div>
        </div>

        {/* Rincian SiLPA */}
        <div className="border rounded-md p-3">
          <h4 className="text-xs font-bold mb-2">Rincian Silpa Tahun Sebelumnya</h4>
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="text-[10px] font-semibold">RincianSD</TableHead>
                <TableHead className="text-[10px] font-semibold">Nama Rincian</TableHead>
                <TableHead className="text-[10px] font-semibold text-right">Debet</TableHead>
                <TableHead className="text-[10px] font-semibold text-right">Kredit</TableHead>
                {mode !== "view" && <TableHead className="text-[10px] w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRincian.length === 0 ? (
                <TableRow><TableCell colSpan={mode !== "view" ? 5 : 4} className="text-center text-muted-foreground py-4 text-xs">Belum ada rincian</TableCell></TableRow>
              ) : displayRincian.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">{r.kodeRekening}</TableCell>
                  <TableCell className="text-xs">{r.namaRekening}</TableCell>
                  <TableCell className="text-xs text-right">{r.debet.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs text-right">{r.kredit.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                  {mode !== "view" && (
                    <TableCell><Button size="sm" variant="ghost" className="h-6 px-1 text-destructive text-[10px]" onClick={() => removeRincian(r.id)}>×</Button></TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-secondary/20 font-bold">
                <TableCell colSpan={2} className="text-xs text-right">Total</TableCell>
                <TableCell className="text-xs text-right">{totalDebet.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-xs text-right">{totalKredit.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                {mode !== "view" && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>

          {mode !== "view" && (
            <div className="grid grid-cols-5 gap-2 mt-3 items-end">
              <div>
                <Label className="text-[10px]">Kd Rincian</Label>
                <Select value={rincianForm.kodeRekening} onValueChange={v => {
                  const r = rekeningAset.find(x => x.kode === v);
                  setRincianForm({ ...rincianForm, kodeRekening: v, namaRekening: r?.uraian || "" });
                }}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{rekeningAset.map(r => <SelectItem key={r.kode} value={r.kode}><span className="text-[10px]">{r.kode}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Nama Rincian</Label>
                <Input value={rincianForm.namaRekening} readOnly className="h-7 text-[10px] bg-muted" />
              </div>
              <div>
                <Label className="text-[10px]">Debet</Label>
                <Input type="number" value={rincianForm.debet || ""} onChange={e => setRincianForm({ ...rincianForm, debet: Number(e.target.value) })} className="h-7 text-[10px]" />
              </div>
              <div>
                <Label className="text-[10px]">Kredit</Label>
                <Input type="number" value={rincianForm.kredit || ""} onChange={e => setRincianForm({ ...rincianForm, kredit: Number(e.target.value) })} className="h-7 text-[10px]" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-[10px]" onClick={addRincian}>Tambah</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t bg-secondary/30 px-4 py-2 flex items-center gap-2">
        <Button size="sm" variant={mode === "tambah" ? "default" : "outline"} onClick={handleTambah} disabled={mode !== "view"}>Tambah</Button>
        <Button size="sm" variant={mode === "ubah" ? "default" : "outline"} onClick={handleUbah} disabled={mode !== "view"}>Ubah</Button>
        <Button size="sm" variant="outline" onClick={handleHapus} disabled={mode !== "view"} className="text-destructive hover:text-destructive">Hapus</Button>
        <Button size="sm" variant="outline" onClick={handleBatal} disabled={mode === "view"}>Batal</Button>
        <Button size="sm" onClick={handleSimpan} disabled={mode === "view"}>Simpan</Button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">Record {items.length > 0 ? (items.findIndex(i => i.id === selectedId) + 1) : 0}/{items.length}</span>
        <Button size="sm" variant="outline" onClick={() => window.history.back()}>Tutup</Button>
      </div>
    </div>
  );
}

// ===================== PENERIMAAN (TUNAI/BANK) TAB =====================
function PenerimaanTab({ jenis }: { jenis: "tunai" | "bank" }) {
  const [allItems, setAllItems] = useState<PenerimaanItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [showRincian, setShowRincian] = useState(false);

  const rekeningPendapatan = getRekeningDetail("pendapatan");

  const emptyForm: Omit<PenerimaanItem, "id"> = {
    jenis, tanggal: "", noBukti: "", uraian: "", jumlah: 0,
    kodeRekening: "", namaRekening: "", penyetor: "", nama: "", alamat: "", ttd: "",
    rekening: "", namaBank: "", kppn: "", rincian: [],
  };
  const [form, setForm] = useState(emptyForm);
  const [rincianForm, setRincianForm] = useState<Omit<PenerimaanRincian, "id">>({ kodeRekening: "", namaRekening: "", sumberDana: "", nilai: 0 });

  useEffect(() => { setAllItems(loadState().penerimaan || []); }, []);

  const items = allItems.filter(i => i.jenis === jenis);

  const save = (newAll: PenerimaanItem[]) => {
    setAllItems(newAll);
    const state = loadState();
    state.penerimaan = newAll;
    saveState(state);
  };

  const selectedItem = allItems.find(i => i.id === selectedId);

  const generateNoBukti = () => {
    const count = items.length + 1;
    return `${String(count).padStart(4, "0")}/TBP/05.2001/2024`;
  };

  const handleTambah = () => { setMode("tambah"); setSelectedId(null); setForm({ ...emptyForm }); setShowRincian(false); };
  const handleUbah = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan diubah");
    setMode("ubah"); setForm({ ...selectedItem }); setShowRincian(false);
  };
  const handleHapus = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan dihapus");
    if (!confirm("Yakin hapus data ini?")) return;
    save(allItems.filter(i => i.id !== selectedItem.id)); setSelectedId(null); toast.success("Data dihapus");
  };
  const handleBatal = () => { setMode("view"); setForm(emptyForm); setShowRincian(false); };

  const handleSimpan = () => {
    if (!form.tanggal) return toast.error("Isi tanggal");
    if (!form.uraian) return toast.error("Isi uraian");
    const noBukti = form.noBukti || generateNoBukti();
    // Auto-calc jumlah from rincian
    const jumlah = form.rincian.length > 0 ? form.rincian.reduce((s, r) => s + r.nilai, 0) : form.jumlah;

    if (mode === "ubah" && selectedId) {
      save(allItems.map(i => i.id === selectedId ? { ...i, ...form, noBukti, jumlah } : i));
      toast.success("Data diperbarui");
    } else {
      const newItem: PenerimaanItem = { id: crypto.randomUUID(), ...form, noBukti, jumlah };
      save([...allItems, newItem]); setSelectedId(newItem.id);
      toast.success("Penerimaan ditambahkan");
    }
    setMode("view"); setForm(emptyForm); setShowRincian(false);
    trackFormProgress("penerimaan");
  };

  const addRincian = () => {
    if (!rincianForm.kodeRekening) return toast.error("Pilih rekening rincian");
    if (rincianForm.nilai <= 0) return toast.error("Nilai harus > 0");
    // Bridge ke Pendapatan: warning-only jika melebihi sisa anggaran
    const opts = getPendapatanOptions(loadState());
    const opt = opts.find(o => o.kodeRekening === rincianForm.kodeRekening);
    if (opt && rincianForm.nilai > opt.sisa) {
      toast.warning(`Nilai melebihi sisa anggaran Pendapatan (Rp ${opt.sisa.toLocaleString("id-ID")}). Tetap disimpan.`);
    }
    const newR: PenerimaanRincian = { id: crypto.randomUUID(), ...rincianForm };
    const newRincian = [...form.rincian, newR];
    setForm({ ...form, rincian: newRincian, jumlah: newRincian.reduce((s, r) => s + r.nilai, 0) });
    setRincianForm({ kodeRekening: "", namaRekening: "", sumberDana: "", nilai: 0 });
  };
  const removeRincian = (id: string) => {
    const newRincian = form.rincian.filter(r => r.id !== id);
    setForm({ ...form, rincian: newRincian, jumlah: newRincian.reduce((s, r) => s + r.nilai, 0) });
  };

  const displayRincian = mode !== "view" ? form.rincian : (selectedItem?.rincian || []);
  const title = jenis === "tunai" ? "Realisasi Penerimaan Tunai" : "Realisasi Penerimaan Bank";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-center uppercase tracking-wider text-primary">{title}</h2>

      {/* Master Table */}
      <div className="content-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead className="text-xs font-semibold w-8">#</TableHead>
              <TableHead className="text-xs font-semibold">Tanggal</TableHead>
              <TableHead className="text-xs font-semibold">No. Bukti</TableHead>
              <TableHead className="text-xs font-semibold">Uraian</TableHead>
              <TableHead className="text-xs font-semibold text-right">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">Belum ada data</TableCell></TableRow>
            ) : items.map((item, idx) => (
              <TableRow
                key={item.id}
                className={`cursor-pointer transition-colors ${selectedId === item.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/30"}`}
                onClick={() => { if (mode === "view") { setSelectedId(item.id); setShowRincian(false); } }}
              >
                <TableCell className="text-xs">{idx + 1}</TableCell>
                <TableCell className="text-xs">{item.tanggal}</TableCell>
                <TableCell className="text-xs font-mono">{item.noBukti}</TableCell>
                <TableCell className="text-xs">{item.uraian}</TableCell>
                <TableCell className="text-xs text-right font-medium">{item.jumlah.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Step indicator */}
      {(selectedItem || mode !== "view") && (
        <div className="flex gap-2">
          <Button size="sm" variant={!showRincian ? "default" : "outline"} onClick={() => setShowRincian(false)} className="text-xs">
            Detail Bukti
          </Button>
          <Button size="sm" variant={showRincian ? "default" : "outline"} onClick={() => setShowRincian(true)} className="text-xs">
            Detail Rincian
          </Button>
        </div>
      )}

      {/* Detail Bukti (Step 1) */}
      {!showRincian && (selectedItem || mode !== "view") && (
        <div className="content-card p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <Label className="text-xs">No Bukti</Label>
              {mode !== "view" ? (
                <Input value={form.noBukti} onChange={e => setForm({ ...form, noBukti: e.target.value })} placeholder="Auto-generate" className="h-8 text-xs" />
              ) : (
                <Input value={selectedItem?.noBukti || ""} readOnly className="h-8 text-xs bg-muted" />
              )}
            </div>
            <fieldset className="border rounded p-2 row-span-3">
              <legend className="text-[10px] font-semibold px-1">Penyetor</legend>
              <div className="space-y-2">
                <div>
                  <Label className="text-[10px]">Nama</Label>
                  {mode !== "view" ? (
                    <Input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} className="h-7 text-[10px]" />
                  ) : (
                    <Input value={selectedItem?.nama || ""} readOnly className="h-7 text-[10px] bg-muted" />
                  )}
                </div>
                <div>
                  <Label className="text-[10px]">Alamat</Label>
                  {mode !== "view" ? (
                    <Input value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} className="h-7 text-[10px]" />
                  ) : (
                    <Input value={selectedItem?.alamat || ""} readOnly className="h-7 text-[10px] bg-muted" />
                  )}
                </div>
                <div>
                  <Label className="text-[10px]">Ttd</Label>
                  {mode !== "view" ? (
                    <Input value={form.ttd} onChange={e => setForm({ ...form, ttd: e.target.value })} className="h-7 text-[10px]" />
                  ) : (
                    <Input value={selectedItem?.ttd || ""} readOnly className="h-7 text-[10px] bg-muted" />
                  )}
                </div>
              </div>
            </fieldset>
            <div>
              <Label className="text-xs">Tgl Bukti</Label>
              {mode !== "view" ? (
                <Input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} className="h-8 text-xs" />
              ) : (
                <Input value={selectedItem?.tanggal || ""} readOnly className="h-8 text-xs bg-muted" />
              )}
            </div>
            <div>
              <Label className="text-xs">Uraian</Label>
              {mode !== "view" ? (
                <Input value={form.uraian} onChange={e => setForm({ ...form, uraian: e.target.value })} className="h-8 text-xs" />
              ) : (
                <Input value={selectedItem?.uraian || ""} readOnly className="h-8 text-xs bg-muted" />
              )}
            </div>

            {jenis === "bank" && (
              <>
                <fieldset className="border rounded p-2 col-span-2">
                  <legend className="text-[10px] font-semibold px-1">Bank Penerima</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">KPPN</Label>
                      {mode !== "view" ? (
                        <Input value={form.kppn || ""} onChange={e => setForm({ ...form, kppn: e.target.value })} className="h-7 text-[10px]" />
                      ) : (
                        <Input value={selectedItem?.kppn || ""} readOnly className="h-7 text-[10px] bg-muted" />
                      )}
                    </div>
                    <div>
                      <Label className="text-[10px]">Rekening</Label>
                      {mode !== "view" ? (
                        <Input value={form.rekening || ""} onChange={e => setForm({ ...form, rekening: e.target.value })} className="h-7 text-[10px]" />
                      ) : (
                        <Input value={selectedItem?.rekening || ""} readOnly className="h-7 text-[10px] bg-muted" />
                      )}
                    </div>
                    <div>
                      <Label className="text-[10px]">Nama Bank</Label>
                      {mode !== "view" ? (
                        <Input value={form.namaBank || ""} onChange={e => setForm({ ...form, namaBank: e.target.value })} className="h-7 text-[10px]" />
                      ) : (
                        <Input value={selectedItem?.namaBank || ""} readOnly className="h-7 text-[10px] bg-muted" />
                      )}
                    </div>
                  </div>
                </fieldset>
              </>
            )}

            {jenis === "tunai" && (
              <fieldset className="border rounded p-2 col-span-2">
                <legend className="text-[10px] font-semibold px-1">Bank Penerima</legend>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Rekening</Label>
                    {mode !== "view" ? (
                      <Input value={form.rekening || ""} onChange={e => setForm({ ...form, rekening: e.target.value })} className="h-7 text-[10px]" />
                    ) : (
                      <Input value={selectedItem?.rekening || ""} readOnly className="h-7 text-[10px] bg-muted" />
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px]">Nama Bank</Label>
                    {mode !== "view" ? (
                      <Input value={form.namaBank || ""} onChange={e => setForm({ ...form, namaBank: e.target.value })} className="h-7 text-[10px]" />
                    ) : (
                      <Input value={selectedItem?.namaBank || ""} readOnly className="h-7 text-[10px] bg-muted" />
                    )}
                  </div>
                </div>
              </fieldset>
            )}

            <div>
              <Label className="text-xs">Jumlah</Label>
              {mode !== "view" ? (
                <Input type="number" value={form.jumlah || ""} onChange={e => setForm({ ...form, jumlah: Number(e.target.value) })} className="h-8 text-xs" />
              ) : (
                <Input value={selectedItem?.jumlah.toLocaleString("id-ID", { minimumFractionDigits: 2 }) || ""} readOnly className="h-8 text-xs bg-muted" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Rincian (Step 2) */}
      {showRincian && (selectedItem || mode !== "view") && (
        <div className="content-card p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold">Detail Rincian</h4>
            <div className="text-xs text-muted-foreground">
              Nomer Bukti: <span className="font-mono font-medium">{mode !== "view" ? (form.noBukti || "auto") : selectedItem?.noBukti}</span>
              <span className="ml-4">Rp {(mode !== "view" ? form.jumlah : selectedItem?.jumlah || 0).toLocaleString("id-ID", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="text-[10px] font-semibold w-8">#</TableHead>
                <TableHead className="text-[10px] font-semibold">Kd_Rincian</TableHead>
                <TableHead className="text-[10px] font-semibold">Sumber Dana</TableHead>
                <TableHead className="text-[10px] font-semibold">Nama Rekening</TableHead>
                <TableHead className="text-[10px] font-semibold text-right">Nilai</TableHead>
                {mode !== "view" && <TableHead className="text-[10px] w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRincian.length === 0 ? (
                <TableRow><TableCell colSpan={mode !== "view" ? 6 : 5} className="text-center text-muted-foreground py-4 text-xs">Belum ada rincian</TableCell></TableRow>
              ) : displayRincian.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{idx + 1}</TableCell>
                  <TableCell className="text-xs font-mono">{r.kodeRekening}</TableCell>
                  <TableCell className="text-xs">{r.sumberDana}</TableCell>
                  <TableCell className="text-xs">{r.namaRekening}</TableCell>
                  <TableCell className="text-xs text-right">{r.nilai.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                  {mode !== "view" && (
                    <TableCell><Button size="sm" variant="ghost" className="h-6 px-1 text-destructive text-[10px]" onClick={() => removeRincian(r.id)}>×</Button></TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {mode !== "view" && (
            <div className="grid grid-cols-5 gap-2 mt-3 items-end">
              <div>
                <Label className="text-[10px]">Kd Rincian (dari Pendapatan)</Label>
                <Select value={rincianForm.kodeRekening} onValueChange={v => {
                  const opts = getPendapatanOptions(loadState());
                  const o = opts.find(x => x.kodeRekening === v);
                  setRincianForm({ ...rincianForm, kodeRekening: v, namaRekening: o?.namaRekening || "", sumberDana: o?.sumberDana || rincianForm.sumberDana });
                }}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Pilih dari anggaran Pendapatan" /></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const opts = getPendapatanOptions(loadState());
                      return opts.length === 0
                        ? <SelectItem value="__empty" disabled>Belum ada Pendapatan dianggarkan</SelectItem>
                        : opts.map(o => <SelectItem key={o.pendapatanId} value={o.kodeRekening}><span className="text-[10px]">{o.kodeRekening} — Sisa: {o.sisa.toLocaleString("id-ID")}</span></SelectItem>);
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Sumber Dana</Label>
                <Select value={rincianForm.sumberDana} onValueChange={v => setRincianForm({ ...rincianForm, sumberDana: v })}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAD">PAD</SelectItem>
                    <SelectItem value="DDS">DDS (Dana Desa)</SelectItem>
                    <SelectItem value="ADD">ADD</SelectItem>
                    <SelectItem value="BHP">BHP (Bagi Hasil Pajak)</SelectItem>
                    <SelectItem value="BHR">BHR (Bagi Hasil Retribusi)</SelectItem>
                    <SelectItem value="PBK">PBK (Pendapatan Bantuan Kab)</SelectItem>
                    <SelectItem value="PBP">PBP (Pendapatan Bantuan Prov)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Nama Rekening</Label>
                <Input value={rincianForm.namaRekening} readOnly className="h-7 text-[10px] bg-muted" />
              </div>
              <div>
                <Label className="text-[10px]">Nilai</Label>
                <Input type="number" value={rincianForm.nilai || ""} onChange={e => setRincianForm({ ...rincianForm, nilai: Number(e.target.value) })} className="h-7 text-[10px]" />
              </div>
              <div>
                <Button size="sm" className="h-7 text-[10px]" onClick={addRincian}>Tambah</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="border-t bg-secondary/30 px-4 py-2 flex items-center gap-2">
        <Button size="sm" variant="outline" className="text-xs">Cetak</Button>
        <Button size="sm" variant={mode === "tambah" ? "default" : "outline"} onClick={handleTambah} disabled={mode !== "view"}>Tambah</Button>
        <Button size="sm" variant={mode === "ubah" ? "default" : "outline"} onClick={handleUbah} disabled={mode !== "view"}>Ubah</Button>
        <Button size="sm" variant="outline" onClick={handleHapus} disabled={mode !== "view"} className="text-destructive hover:text-destructive">Hapus</Button>
        <Button size="sm" variant="outline" onClick={handleBatal} disabled={mode === "view"}>Batal</Button>
        <Button size="sm" onClick={handleSimpan} disabled={mode === "view"}>Simpan</Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => window.history.back()}>Tutup</Button>
      </div>
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function PenerimaanDesa() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("silpa");

  return (
    <div className="flex flex-col h-full">
      <FormPageHeader title="Penerimaan dan Penyetoran" subtitle="Realisasi Pendapatan Desa" />

      <div className="flex-1 p-4 overflow-auto">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ActiveTab)} className="space-y-3">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="silpa" className="text-xs">SiLPA Tahun Lalu</TabsTrigger>
            <TabsTrigger value="tunai" className="text-xs">Penerimaan Tunai</TabsTrigger>
            <TabsTrigger value="bank" className="text-xs">Penerimaan Bank</TabsTrigger>
          </TabsList>

          <TabsContent value="silpa"><SilpaTab /></TabsContent>
          <TabsContent value="tunai"><PenerimaanTab jenis="tunai" /></TabsContent>
          <TabsContent value="bank"><PenerimaanTab jenis="bank" /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
