import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import SiteLockGuard from "@/components/SiteLockGuard";
import Beranda from "@/pages/Beranda";
import DataUmumDesa from "@/pages/DataUmumDesa";
import ParameterBidangKegiatan from "@/pages/ParameterBidangKegiatan";
import ParameterSumberDana from "@/pages/ParameterSumberDana";
import ParameterRekening from "@/pages/ParameterRekening";
import ParameterOutputKegiatan from "@/pages/ParameterOutputKegiatan";

import DetailKegiatan from "@/pages/DetailKegiatan";
import PendapatanDesa from "@/pages/PendapatanDesa";
import BelanjaDesa from "@/pages/BelanjaDesa";
import PembiayaanDesa from "@/pages/PembiayaanDesa";
import PenerimaanDesa from "@/pages/PenerimaanDesa";
import SPPPanjar from "@/pages/SPPPanjar";
import SPPDefinitif from "@/pages/SPPDefinitif";
import SPPPembiayaan from "@/pages/SPPPembiayaan";
import PencairanSPPPage from "@/pages/PencairanSPPPage";
import SPJKegiatan from "@/pages/SPJKegiatan";
import PenyetoranPajak from "@/pages/PenyetoranPajak";
import MutasiKas from "@/pages/MutasiKas";
import JurnalUmum from "@/pages/JurnalUmum";
import SaldoAwal from "@/pages/SaldoAwal";
import LaporanLRA from "@/pages/LaporanLRA";
import LaporanNeraca from "@/pages/LaporanNeraca";
import LaporanBKU from "@/pages/LaporanBKU";
import LaporanBKPPajak from "@/pages/LaporanBKPPajak";
import LaporanPenjabaran from "@/pages/LaporanPenjabaran";
import LaporanLRAPerKegiatan from "@/pages/LaporanLRAPerKegiatan";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import TentangAplikasi from "@/pages/TentangAplikasi";
import GroupRoom from "@/pages/GroupRoom";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const SiteLockGuardLayout = () => (
  <SiteLockGuard><AppLayout /></SiteLockGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Admin routes - outside SiteLockGuard */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />

          {/* User routes - protected by SiteLockGuard */}
          <Route element={<SiteLockGuardLayout />}>
            <Route path="/" element={<Beranda />} />
            <Route path="/data-umum" element={<DataUmumDesa />} />
            <Route path="/group-room" element={<GroupRoom />} />
            <Route path="/parameter/bidang-kegiatan" element={<ParameterBidangKegiatan />} />
            <Route path="/parameter/sumber-dana" element={<ParameterSumberDana />} />
            <Route path="/parameter/rekening" element={<ParameterRekening />} />
            <Route path="/parameter/output-kegiatan" element={<ParameterOutputKegiatan />} />
            
            <Route path="/penganggaran/pendapatan" element={<PendapatanDesa />} />
            <Route path="/penganggaran/belanja" element={<BelanjaDesa />} />
            <Route path="/penganggaran/pembiayaan" element={<PembiayaanDesa />} />
            <Route path="/detail-kegiatan" element={<DetailKegiatan />} />
            <Route path="/penatausahaan/penerimaan" element={<PenerimaanDesa />} />
            <Route path="/penatausahaan/spp-panjar" element={<SPPPanjar />} />
            <Route path="/penatausahaan/spp-definitif" element={<SPPDefinitif />} />
            <Route path="/penatausahaan/spp-pembiayaan" element={<SPPPembiayaan />} />
            <Route path="/penatausahaan/pencairan" element={<PencairanSPPPage />} />
            <Route path="/penatausahaan/spj" element={<SPJKegiatan />} />
            <Route path="/penatausahaan/penyetoran-pajak" element={<PenyetoranPajak />} />
            <Route path="/penatausahaan/mutasi-kas" element={<MutasiKas />} />
            <Route path="/pembukuan/saldo-awal" element={<SaldoAwal />} />
            <Route path="/pembukuan/jurnal-umum" element={<JurnalUmum />} />
            {/* Laporan Keuangan */}
            <Route path="/laporan/lra" element={<LaporanLRA />} />
            <Route path="/laporan/lra-desa" element={<LaporanLRAPerKegiatan />} />
            <Route path="/laporan/neraca" element={<LaporanNeraca />} />
            <Route path="/laporan/bku" element={<LaporanBKU />} />
            <Route path="/laporan/bkp-pajak" element={<LaporanBKPPajak />} />
            <Route path="/laporan/penjabaran" element={<LaporanPenjabaran />} />
            <Route path="/tentang" element={<TentangAplikasi />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
