import { useState } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { loadState, saveState, type MutasiKasItem } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MutasiKas() {
  const [state, setState] = useState(loadState());
  const [showForm, setShowForm] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [form, setForm] = useState<Omit<MutasiKasItem, 'id'>>({
    tanggal: new Date().toISOString().split("T")[0], noBukti: "", jenis: "setor", uraian: "", jumlah: 0, rekening: "", namaBank: "",
  });

  // Filter transaksi tunai yang belum dimutasi
  const cashPenerimaan = state.penerimaan.filter(p => p.jenis === 'tunai' && !p.sudahMutasi);
  const cashPencairan = state.pencairan.filter(p => p.pembayaran === 'tunai' && !p.sudahMutasi);

  const handleSave = () => {
    const newId = crypto.randomUUID();
    const newItem: MutasiKasItem = { id: newId, ...form };
    const updatedItems = [...state.mutasiKas, newItem];
    
    // Update status sudahMutasi di transaksi asal jika ada
    let newState = { ...state, mutasiKas: updatedItems };
    
    if (form.sourceType === 'penerimaan' && form.sourceId) {
      newState.penerimaan = newState.penerimaan.map(p => p.id === form.sourceId ? { ...p, sudahMutasi: true } : p);
    } else if (form.sourceType === 'pencairan' && form.sourceId) {
      newState.pencairan = newState.pencairan.map(p => p.id === form.sourceId ? { ...p, sudahMutasi: true } : p);
    }

    saveState(newState);
    setState(newState);
    void trackFormProgress("mutasi");
    setShowForm(false);
    setForm({ tanggal: new Date().toISOString().split("T")[0], noBukti: "", jenis: "setor", uraian: "", jumlah: 0, rekening: "", namaBank: "" });
    toast.success("Mutasi kas berhasil disimpan");
  };

  const handleDelete = (id: string) => {
    const itemToDelete = state.mutasiKas.find(i => i.id === id);
    let newState = { ...state, mutasiKas: state.mutasiKas.filter(i => i.id !== id) };

    // Reset status sudahMutasi di transaksi asal
    if (itemToDelete?.sourceType === 'penerimaan' && itemToDelete.sourceId) {
      newState.penerimaan = newState.penerimaan.map(p => p.id === itemToDelete.sourceId ? { ...p, sudahMutasi: false } : p);
    } else if (itemToDelete?.sourceType === 'pencairan' && itemToDelete.sourceId) {
      newState.pencairan = newState.pencairan.map(p => p.id === itemToDelete.sourceId ? { ...p, sudahMutasi: false } : p);
    }

    saveState(newState);
    setState(newState);
    toast.success("Mutasi kas dihapus");
  };

  const handleSelectSource = (source: any, type: 'penerimaan' | 'pencairan') => {
    setForm({
      ...form,
      tanggal: source.tanggal,
      uraian: `Mutasi Kas dari ${type === 'penerimaan' ? 'Penerimaan' : 'Pencairan SPP'}: ${source.uraian || source.nomorPencairan}`,
      jumlah: source.jumlah,
      sourceId: source.id,
      sourceType: type,
      jenis: 'setor'
    });
    setShowSourceDialog(false);
    toast.success("Data transaksi dipilih");
  };

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Mutasi Kas" subtitle="Penyetoran Penerimaan ke Bank / Pengambilan dari Bank" />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Button size="sm" onClick={() => setShowForm(true)}>Tambah Mutasi</Button>
          {(cashPenerimaan.length > 0 || cashPencairan.length > 0) && (
            <Button size="sm" variant="outline" className="text-primary border-primary hover:bg-primary/10 gap-2" onClick={() => setShowSourceDialog(true)}>
              <Link2 size={14} /> Transaksi Tunai Belum Dimutasi ({cashPenerimaan.length + cashPencairan.length})
            </Button>
          )}
        </div>

        <div className="content-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-[11px]">
                <th className="px-3 py-2 text-left border-b border-border/60">Tanggal</th>
                <th className="px-3 py-2 text-left border-b border-border/60">No Bukti</th>
                <th className="px-3 py-2 text-center border-b border-border/60">Jenis</th>
                <th className="px-3 py-2 text-left border-b border-border/60">Uraian</th>
                <th className="px-3 py-2 text-right border-b border-border/60">Jumlah</th>
                <th className="px-3 py-2 text-center border-b border-border/60">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {state.mutasiKas.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada data</td></tr>
              ) : state.mutasiKas.map(item => (
                <tr key={item.id} className="border-b border-border/40 hover:bg-muted/30 text-[11px]">
                  <td className="px-3 py-2">{item.tanggal}</td>
                  <td className="px-3 py-2">{item.noBukti}</td>
                  <td className="px-3 py-2 text-center capitalize">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.jenis === 'setor' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {item.jenis === 'setor' ? 'Setor ke Bank' : 'Ambil dari Bank'}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{item.uraian}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.jumlah.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2 text-center">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(item.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showForm && (
          <div className="content-card p-4 space-y-3 bg-muted/5 border-primary/20">
            <h3 className="text-sm font-bold font-heading text-primary">Form Mutasi Kas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label className="text-[11px]">Tanggal</Label><Input type="date" value={form.tanggal} onChange={e => setForm({...form, tanggal: e.target.value})} className="text-[11px] h-8" /></div>
              <div><Label className="text-[11px]">No Bukti</Label><Input value={form.noBukti} onChange={e => setForm({...form, noBukti: e.target.value})} className="text-[11px] h-8" placeholder="0001/STS/05.2001/2024" /></div>
              <div>
                <Label className="text-[11px]">Jenis</Label>
                <Select value={form.jenis} onValueChange={v => setForm({...form, jenis: v as 'setor' | 'ambil'})}>
                  <SelectTrigger className="text-[11px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setor" className="text-[11px]">Setor ke Bank</SelectItem>
                    <SelectItem value="ambil" className="text-[11px]">Ambil dari Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label className="text-[11px]">Uraian</Label><Input value={form.uraian} onChange={e => setForm({...form, uraian: e.target.value})} className="text-[11px] h-8" /></div>
              <div><Label className="text-[11px]">Jumlah</Label><Input type="number" value={form.jumlah} onChange={e => setForm({...form, jumlah: Number(e.target.value)})} className="text-[11px] h-8 font-medium" /></div>
            </div>
            <div className="flex gap-2 pt-2 border-t mt-4">
              <Button size="sm" onClick={handleSave} className="h-8 text-[11px]">Simpan Mutasi</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-8 text-[11px]">Batal</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-sm font-bold">Pilih Transaksi Tunai</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-6">
              {cashPenerimaan.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold mb-2 text-primary">Penerimaan Tunai</h4>
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1 text-left">Tgl</th>
                        <th className="px-2 py-1 text-left">No Bukti</th>
                        <th className="px-2 py-1 text-left">Uraian</th>
                        <th className="px-2 py-1 text-right">Jumlah</th>
                        <th className="px-2 py-1 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashPenerimaan.map(p => (
                        <tr key={p.id} className="border-b hover:bg-muted/30">
                          <td className="px-2 py-1">{p.tanggal}</td>
                          <td className="px-2 py-1">{p.noBukti}</td>
                          <td className="px-2 py-1">{p.uraian}</td>
                          <td className="px-2 py-1 text-right font-medium">{p.jumlah.toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-center">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => handleSelectSource(p, 'penerimaan')}>Pilih</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {cashPencairan.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold mb-2 text-primary">Pencairan SPP Tunai</h4>
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1 text-left">Tgl</th>
                        <th className="px-2 py-1 text-left">No Bukti</th>
                        <th className="px-2 py-1 text-right">Jumlah</th>
                        <th className="px-2 py-1 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashPencairan.map(p => (
                        <tr key={p.id} className="border-b hover:bg-muted/30">
                          <td className="px-2 py-1">{p.tanggal}</td>
                          <td className="px-2 py-1">{p.nomorPencairan}</td>
                          <td className="px-2 py-1 text-right font-medium">{p.jumlah.toLocaleString('id-ID')}</td>
                          <td className="px-2 py-1 text-center">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => handleSelectSource(p, 'pencairan')}>Pilih</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {cashPenerimaan.length === 0 && cashPencairan.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">Semua transaksi tunai sudah dimutasikan</div>
              )}
            </div>
          </div>
          <DialogFooter className="p-2 border-t bg-muted/20">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowSourceDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
