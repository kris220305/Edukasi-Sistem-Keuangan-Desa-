import { loadState } from "@/data/app-state";
import FormPageHeader from "@/components/FormPageHeader";
import { generateBKU, formatRupiah } from "@/lib/financial-engine";
import { exportToPDF, getTahunAnggaran } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import KirimLaporanButton from "@/components/KirimLaporanButton";

export default function LaporanBKU() {
  const state = loadState();
  const bkuEntries = generateBKU(state);
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  const namaDesa = desaProfile.namaDesa || "Desa ___";
  const tahun = getTahunAnggaran();

  const totalPenerimaan = bkuEntries.reduce((s, e) => s + e.penerimaan, 0);
  const totalPengeluaran = bkuEntries.reduce((s, e) => s + e.pengeluaran, 0);
  
  // Saldo akhir adalah selisih dari total penerimaan dan pengeluaran di tabel BKU
  const lastSaldo = totalPenerimaan - totalPengeluaran;

  // Untuk rincian di footer, kita tetap hitung saldo riil tunai dan bank
  const totalMutasiSetor = state.mutasiKas.reduce((s, m) => s + (m.jenis === 'setor' ? m.jumlah : 0), 0);
  const totalMutasiAmbil = state.mutasiKas.reduce((s, m) => s + (m.jenis === 'ambil' ? m.jumlah : 0), 0);

  const saldoTunai = state.saldoAwal
    .filter(s => s.kodeRekening === '1.1.1.01')
    .reduce((s, i) => s + i.debet, 0)
    + state.penerimaan.filter(p => p.jenis === 'tunai').reduce((s, p) => s + p.jumlah, 0)
    - state.pencairan.filter(p => p.pembayaran === 'tunai').reduce((s, p) => s + p.jumlah, 0)
    - totalMutasiSetor
    + totalMutasiAmbil;

  const saldoBank = state.saldoAwal
    .filter(s => s.kodeRekening === '1.1.1.02')
    .reduce((s, i) => s + i.debet, 0)
    + state.penerimaan.filter(p => p.jenis === 'bank').reduce((s, p) => s + p.jumlah, 0)
    - state.pencairan.filter(p => p.pembayaran === 'bank').reduce((s, p) => s + p.jumlah, 0)
    + totalMutasiSetor
    - totalMutasiAmbil;

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Buku Kas Umum" subtitle="BKU — Seluruh transaksi tahun berjalan">
        <Button size="sm" onClick={() => exportToPDF('bku-content', `BKU_${namaDesa}_${tahun}`)} className="gap-2">
          <Download size={14} /> Download PDF
        </Button>
        <KirimLaporanButton />
      </FormPageHeader>

      <div className="flex-1 overflow-auto p-4">
        <div id="bku-content" className="bg-white text-black p-10 max-w-5xl mx-auto" style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: '11px', lineHeight: '1.4' }}>
          <div className="text-center mb-6">
            <p className="text-base font-bold tracking-wide">BUKU KAS UMUM</p>
            <p className="text-base font-bold">{namaDesa.toUpperCase()}</p>
            <p className="text-sm font-bold">TAHUN ANGGARAN {tahun}</p>
            {desaProfile.kecamatan && <p className="text-xs mt-1">KECAMATAN {desaProfile.kecamatan.toUpperCase()}</p>}
            {desaProfile.kabupaten && <p className="text-xs">{desaProfile.kabupaten.toUpperCase()}</p>}
          </div>
          <p className="text-xs mb-3">Periode 01/01/{tahun} s.d 31/12/{tahun}</p>

          <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="py-2 px-1 text-center border border-gray-400 w-8">No.</th>
                <th className="py-2 px-1 text-left border border-gray-400 w-20">Tanggal</th>
                <th className="py-2 px-1 text-left border border-gray-400 w-20">Kode Rek</th>
                <th className="py-2 px-1 text-left border border-gray-400">Uraian</th>
                <th className="py-2 px-1 text-right border border-gray-400 w-24">Penerimaan</th>
                <th className="py-2 px-1 text-right border border-gray-400 w-24">Pengeluaran</th>
                <th className="py-2 px-1 text-left border border-gray-400 w-24">No. Bukti</th>
                <th className="py-2 px-1 text-right border border-gray-400 w-24">Netto</th>
                <th className="py-2 px-1 text-right border border-gray-400 w-24">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {bkuEntries.map((e, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="py-1 px-1 text-center border border-gray-300">{e.no}</td>
                  <td className="py-1 px-1 border border-gray-300">{e.tanggal}</td>
                  <td className="py-1 px-1 border border-gray-300">{e.kodeRekening}</td>
                  <td className="py-1 px-1 border border-gray-300">{e.uraian}</td>
                  <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(e.penerimaan)}</td>
                  <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(e.pengeluaran)}</td>
                  <td className="py-1 px-1 border border-gray-300 text-[8px]">{e.noBukti}</td>
                  <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(e.netto)}</td>
                  <td className="py-1 px-1 text-right border border-gray-300">{formatRupiah(e.saldo)}</td>
                </tr>
              ))}

              <tr className="font-bold bg-gray-200">
                <td className="py-2 px-1 text-center border border-gray-400" colSpan={4}>JUMLAH</td>
                <td className="py-2 px-1 text-right border border-gray-400">{formatRupiah(totalPenerimaan)}</td>
                <td className="py-2 px-1 text-right border border-gray-400">{formatRupiah(totalPengeluaran)}</td>
                <td className="py-2 px-1 border border-gray-400"></td>
                <td className="py-2 px-1 text-right border border-gray-400">{formatRupiah(totalPenerimaan - totalPengeluaran)}</td>
                <td className="py-2 px-1 text-right border border-gray-400"></td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6" style={{ fontSize: '10px' }}>
            <p>Saldo Kas per tanggal 31 Desember {tahun} senilai Rp {formatRupiah(lastSaldo)}</p>
            <p className="mt-1">Terdiri dari:</p>
            <table className="ml-4 mt-1">
              <tbody>
                <tr><td className="pr-4">a. Tunai</td><td className="text-right">Rp {formatRupiah(Math.max(saldoTunai, 0))}</td></tr>
                <tr><td className="pr-4">b. Bank</td><td className="text-right">Rp {formatRupiah(Math.max(saldoBank, 0))}</td></tr>
                <tr className="font-bold"><td className="pr-4">Jumlah</td><td className="text-right">Rp {formatRupiah(lastSaldo)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mt-10 flex justify-between" style={{ fontSize: '10px' }}>
            <div className="text-center">
              <p>Diverifikasi Oleh,</p>
              <p>Sekretaris Desa</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{desaProfile.sekretarisNama || "___"}</p>
              <p className="mt-6">Kaur Keuangan</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{desaProfile.bendaharaNama || "___"}</p>
            </div>
            <div className="text-center">
              <p>{desaProfile.kecamatan || "___"}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p>Disetujui oleh,</p>
              <p>Kepala Desa</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{desaProfile.kepalaDesaNama || "___"}</p>
            </div>
          </div>
          <p className="mt-10 text-[8px] text-gray-400 text-center">Dicetak oleh Sistem Pengelolaan Keuangan Desa for Education</p>
        </div>
      </div>
    </div>
  );
}
