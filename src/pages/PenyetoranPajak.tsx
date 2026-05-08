import { useState } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { loadState, saveState, type PenyetoranPajak as PenyetoranPajakItem } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen, Link2 } from "lucide-react";
import { toast } from "sonner";
import { rekeningData } from "@/data/rekening-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Mode = "view" | "add" | "edit";
type ActiveTab = "penyetoran" | "rincianBuktiPotong";

export default function PenyetoranPajak() {
  const [state, setState] = useState(loadState());
  const [selected, setSelected] = useState<PenyetoranPajakItem | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [activeTab, setActiveTab] = useState<ActiveTab>("penyetoran");
  const [showPotonganDialog, setShowPotonganDialog] = useState(false);

  const pajakRekening = rekeningData.filter(r => r.kode.startsWith("7.1"));

  // Kumpulkan semua potongan dari SEMUA sumber (SPP + SPJ Panjar Kegiatan)
  const allBuktiPotong = [
    ...state.spp.flatMap(s => s.buktiTransaksi.flatMap(bt => bt.potonganPajak.map(p => ({
      id: `${bt.noBukti}-${p.kodeRekening}`,
      noBukti: bt.noBukti, kodeRekening: p.kodeRekening, namaRekening: p.namaRekening, nilai: p.nilai,
      sumber: `SPP ${s.jenis === 'panjar' ? 'Panjar' : s.jenis === 'definitif' ? 'Definitif' : 'Pembiayaan'} ${s.nomorSPP}`,
    })))),
    ...(state.spjPanjar || []).flatMap(spj => (spj.potongan || []).map(p => ({
      id: `${spj.nomorSPJ}-${p.kodeRekening}`,
      noBukti: spj.nomorSPJ, kodeRekening: p.kodeRekening, namaRekening: p.namaRekening, nilai: p.nilai,
      sumber: `SPJ Panjar ${spj.nomorSPJ}`,
    }))),
  ];

  // Filter potongan yang belum disetorkan
  const disetorkanIds = state.penyetoranPajak.flatMap(p => p.rincianBuktiPotong.map(r => `${r.noBukti}-${r.kodeRekening}`));
  const availablePotongan = allBuktiPotong.filter(p => !disetorkanIds.includes(p.id) || (selected?.rincianBuktiPotong.some(r => `${r.noBukti}-${r.kodeRekening}` === p.id)));

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    noBukti: "",
    kodeRekening: "",
    kodeMAP: "",
    keterangan: "",
    jumlah: 0,
    ntpn: "",
    jenis: "tunai" as "tunai" | "bank",
    namaWP: "",
    alamatWP: "",
    npwp: "",
    ttd: "",
  });

  const [selectedBuktiPotong, setSelectedBuktiPotong] = useState<typeof allBuktiPotong>([]);
  const [rincianForm, setRincianForm] = useState({
    noBuktiPotong: "", kodeRekening: "", namaRekening: "", nilai: 0,
  });

  const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2 });

  const handleAmbilPotongan = (potongan: typeof allBuktiPotong[0]) => {
    // Jika sudah ada di selectedBuktiPotong, jangan tambah lagi
    if (selectedBuktiPotong.some(p => p.id === potongan.id)) {
      toast.error("Potongan sudah dipilih");
      return;
    }

    const newSelected = [...selectedBuktiPotong, potongan];
    setSelectedBuktiPotong(newSelected);
    
    // Update total jumlah di form
    const total = newSelected.reduce((sum, p) => sum + p.nilai, 0);
    
    // Auto-fill kode rekening jika belum diisi
    const newKodeRekening = form.kodeRekening || potongan.kodeRekening;
    
    setForm({
      ...form,
      jumlah: total,
      kodeRekening: newKodeRekening,
      keterangan: form.keterangan || `Penyetoran Pajak dari ${potongan.sumber}`
    });
    
    toast.success("Potongan ditambahkan");
  };

  const handleTambah = () => {
    setMode("add");
    setSelected(null);
    const count = state.penyetoranPajak.length + 1;
    setForm({
      tanggal: new Date().toISOString().split("T")[0],
      noBukti: `${String(count).padStart(4, "0")}/SSP/05.2001/2024`,
      kodeRekening: "", kodeMAP: "", keterangan: "",
      jumlah: 0, ntpn: "", jenis: "tunai",
      namaWP: "", alamatWP: "", npwp: "", ttd: "",
    });
    setSelectedBuktiPotong([]);
  };

  const handleUbah = () => {
    if (!selected) { toast.error("Pilih data terlebih dahulu"); return; }
    setMode("edit");
    setForm({
      tanggal: selected.tanggal, noBukti: selected.noBukti,
      kodeRekening: selected.kodeRekening, kodeMAP: selected.kodeMAP,
      keterangan: selected.keterangan, jumlah: selected.jumlah,
      ntpn: selected.ntpn, jenis: selected.jenis,
      namaWP: "", alamatWP: "", npwp: "", ttd: "",
    });
    setSelectedBuktiPotong((selected.rincianBuktiPotong || []).map(b => ({ ...b, sumber: (b as any).sumber || "Manual" })));
  };

  const handleHapus = () => {
    if (!selected) { toast.error("Pilih data terlebih dahulu"); return; }
    const newState = { ...state, penyetoranPajak: state.penyetoranPajak.filter(p => p.id !== selected.id) };
    saveState(newState);
    setState(newState);
    setSelected(null);
    toast.success("Data penyetoran pajak dihapus");
  };

  const handleSimpan = () => {
    if (!form.noBukti || !form.kodeRekening) { toast.error("Lengkapi data"); return; }
    const newItem: PenyetoranPajakItem = {
      id: mode === "edit" && selected ? selected.id : crypto.randomUUID(),
      tanggal: form.tanggal, noBukti: form.noBukti,
      kodeRekening: form.kodeRekening, kodeMAP: form.kodeMAP,
      keterangan: form.keterangan, jumlah: form.jumlah,
      ntpn: form.ntpn, jenis: form.jenis,
      rincianBuktiPotong: selectedBuktiPotong,
    };

    let newPenyetoran;
    if (mode === "edit" && selected) {
      newPenyetoran = state.penyetoranPajak.map(p => p.id === selected.id ? newItem : p);
    } else {
      newPenyetoran = [...state.penyetoranPajak, newItem];
    }
    const newState = { ...state, penyetoranPajak: newPenyetoran };
    saveState(newState);
    setState(newState);
    setSelected(newItem);
    trackFormProgress("pajak");
    setMode("view");
    toast.success("Data penyetoran pajak disimpan");
  };

  const addRincianBuktiPotong = () => {
    if (!rincianForm.noBuktiPotong || !rincianForm.kodeRekening) { toast.error("Lengkapi data rincian"); return; }
    setSelectedBuktiPotong([...selectedBuktiPotong, {
      noBukti: rincianForm.noBuktiPotong,
      kodeRekening: rincianForm.kodeRekening,
      namaRekening: rincianForm.namaRekening,
      nilai: rincianForm.nilai,
      sumber: "Manual",
    }]);
    setRincianForm({ noBuktiPotong: "", kodeRekening: "", namaRekening: "", nilai: 0 });
  };

  // Double-click: Penyetoran row → navigate to Rincian Bukti tab
  const handlePenyetoranDoubleClick = (item: PenyetoranPajakItem) => {
    setSelected(item);
    setMode("view");
    setSelectedBuktiPotong((item.rincianBuktiPotong || []).map(b => ({ ...b, sumber: (b as any).sumber || "Manual" })));
    setActiveTab("rincianBuktiPotong");
  };

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Data Penyetoran Pajak" subtitle="Pemotongan dan penyetoran pajak" />

      <div className="flex-1 p-4 flex gap-0">
        <div className="flex flex-col border border-border rounded-l-md overflow-hidden bg-muted/30">
          <button onClick={() => setActiveTab("penyetoran")}
            className={`px-3 py-6 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === "penyetoran" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>Penyetoran</button>
          <button onClick={() => setActiveTab("rincianBuktiPotong")}
            className={`px-3 py-6 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === "rincianBuktiPotong" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>Rincian Bukti</button>
        </div>

        <div className="flex-1 border border-l-0 border-border rounded-r-md bg-card flex flex-col overflow-hidden">
          {activeTab === "penyetoran" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 text-[11px]">
                      <TableHead className="font-semibold">Tgl Bukti</TableHead>
                      <TableHead className="font-semibold">No Bukti</TableHead>
                      <TableHead className="font-semibold">Keterangan</TableHead>
                      <TableHead className="font-semibold text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.penyetoranPajak.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada data</TableCell></TableRow>
                    ) : state.penyetoranPajak.map(item => (
                      <TableRow key={item.id}
                        className={`cursor-pointer text-[11px] ${selected?.id === item.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelected(item); setMode("view"); }}
                        onDoubleClick={() => handlePenyetoranDoubleClick(item)}>
                        <TableCell>{item.tanggal}</TableCell>
                        <TableCell className="font-mono">{item.noBukti}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.keterangan}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(item.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 space-y-2 bg-muted/10">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">No Bukti</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.noBukti : selected?.noBukti || ""}
                        onChange={e => setForm({...form, noBukti: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Tgl Bukti</Label>
                      <Input type="date" className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.tanggal : selected?.tanggal || ""}
                        onChange={e => setForm({...form, tanggal: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Kd Rincian</Label>
                      <Select value={mode !== "view" ? form.kodeRekening : selected?.kodeRekening || ""}
                        disabled={mode === "view"}
                        onValueChange={v => setForm({...form, kodeRekening: v})}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih" /></SelectTrigger>
                        <SelectContent>{pajakRekening.map(r => <SelectItem key={r.kode} value={r.kode} className="text-xs">{r.kode} - {r.uraian}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {mode !== "view" && (
                      <div className="flex items-center gap-2 pl-20">
                        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary" onClick={() => setShowPotonganDialog(true)}>
                          <Link2 size={10} /> Ambil Data Potongan
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Kode MAP</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"} placeholder="411211-100"
                        value={mode !== "view" ? form.kodeMAP : selected?.kodeMAP || ""}
                        onChange={e => setForm({...form, kodeMAP: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Keterangan</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.keterangan : selected?.keterangan || ""}
                        onChange={e => setForm({...form, keterangan: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Jumlah</Label>
                      <Input type="number" className="h-7 text-[11px] text-right font-medium" readOnly={mode === "view"}
                        value={mode !== "view" ? form.jumlah || "" : selected?.jumlah || ""}
                        onChange={e => setForm({...form, jumlah: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="px-3 py-1 border border-border rounded bg-muted/30 mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">Identitas Penyetor</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Nama WP</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.namaWP : ""}
                        onChange={e => setForm({...form, namaWP: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Ttd</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.ttd : ""}
                        onChange={e => setForm({...form, ttd: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">NTPN</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.ntpn : selected?.ntpn || ""}
                        onChange={e => setForm({...form, ntpn: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Jenis</Label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1 text-[11px]">
                          <input type="radio" name="jenisPajak" value="tunai" disabled={mode === "view"}
                            checked={(mode !== "view" ? form.jenis : selected?.jenis) === "tunai"}
                            onChange={() => setForm({...form, jenis: "tunai"})} />
                          Tunai
                        </label>
                        <label className="flex items-center gap-1 text-[11px]">
                          <input type="radio" name="jenisPajak" value="bank" disabled={mode === "view"}
                            checked={(mode !== "view" ? form.jenis : selected?.jenis) === "bank"}
                            onChange={() => setForm({...form, jenis: "bank"})} />
                          Bank
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "rincianBuktiPotong" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/20">
                <p className="text-[11px]">
                  <span className="font-semibold">No Bukti:</span>{" "}
                  <span className="font-mono">{selected?.noBukti || form.noBukti || "-"}</span>
                </p>
              </div>

              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 text-[11px]">
                      <TableHead className="font-semibold">No_Bukti</TableHead>
                      <TableHead className="font-semibold">Kd_Rincian</TableHead>
                      <TableHead className="font-semibold">Nama Rincian</TableHead>
                      <TableHead className="font-semibold text-right">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(mode !== "view" ? selectedBuktiPotong : selected?.rincianBuktiPotong || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada rincian bukti potong</TableCell></TableRow>
                    ) : (mode !== "view" ? selectedBuktiPotong : selected?.rincianBuktiPotong || []).map((bp, idx) => (
                      <TableRow key={idx} className="text-[11px] hover:bg-muted/50">
                        <TableCell className="font-mono">{bp.noBukti}</TableCell>
                        <TableCell>{bp.kodeRekening}</TableCell>
                        <TableCell>{bp.namaRekening}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(bp.nilai)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {mode !== "view" && (
                <div className="p-4 space-y-2 bg-muted/10">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] w-28 shrink-0">No Bukti Potong</Label>
                    <Input className="h-7 text-[11px]" value={rincianForm.noBuktiPotong}
                      onChange={e => setRincianForm({...rincianForm, noBuktiPotong: e.target.value})} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] w-28 shrink-0">Kd Rincian</Label>
                    <Select value={rincianForm.kodeRekening}
                      onValueChange={v => {
                        const r = pajakRekening.find(x => x.kode === v);
                        setRincianForm({...rincianForm, kodeRekening: v, namaRekening: r?.uraian || ""});
                      }}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent>{pajakRekening.map(r => <SelectItem key={r.kode} value={r.kode} className="text-xs">{r.kode} - {r.uraian}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] w-28 shrink-0">Nama Rincian</Label>
                    <Input className="h-7 text-[11px]" readOnly value={rincianForm.namaRekening} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] w-28 shrink-0">Nilai</Label>
                    <Input type="number" className="h-7 text-[11px] text-right" value={rincianForm.nilai || ""}
                      onChange={e => setRincianForm({...rincianForm, nilai: Number(e.target.value)})} />
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={addRincianBuktiPotong}>
                    <Plus size={12} />Tambah Rincian
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleTambah}><Plus size={12} />Tambah</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleUbah}><Pencil size={12} />Ubah</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleHapus}><Trash2 size={12} />Hapus</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setMode("view")}><X size={12} />Batal</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleSimpan}><Save size={12} />Simpan</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Printer size={12} />Cetak</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => window.history.back()}><DoorOpen size={12} />Tutup</Button>
      </div>

      <Dialog open={showPotonganDialog} onOpenChange={setShowPotonganDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-sm font-bold">Pilih Data Potongan Pajak</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 text-[10px]">
                  <TableHead className="font-semibold">Sumber</TableHead>
                  <TableHead className="font-semibold">No Bukti</TableHead>
                  <TableHead className="font-semibold">Kd Rekening</TableHead>
                  <TableHead className="font-semibold text-right">Nilai</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availablePotongan.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">Tidak ada data potongan tersedia</TableCell></TableRow>
                ) : availablePotongan.map(p => (
                  <TableRow key={p.id} className="text-[10px] hover:bg-muted/50">
                    <TableCell>{p.sumber}</TableCell>
                    <TableCell className="font-mono">{p.noBukti}</TableCell>
                    <TableCell>{p.kodeRekening}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(p.nilai)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => handleAmbilPotongan(p)}>Pilih</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="p-2 border-t bg-muted/20">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowPotonganDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
