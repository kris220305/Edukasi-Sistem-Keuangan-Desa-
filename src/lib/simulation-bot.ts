import { upsertSession, getActiveSessions } from "@/lib/session-manager";
import { mergeStates, type AppState } from "@/data/app-state";
import { rekeningData } from "@/data/rekening-data";

/**
 * AccountingSimulationBot simulates multiple users performing accounting tasks.
 * It follows the logical flow: Budget -> SPP -> Tax -> Mutation.
 */
export class AccountingSimulationBot {
  private userCount: number;
  private groupId: string;
  private interval: number;
  private isRunning: boolean = false;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private virtualUsers: Array<{
    sessionId: string;
    userName: string;
    localState: AppState;
  }> = [];

  constructor(userCount: number, groupId: string, intervalMs: number = 3000) {
    this.userCount = userCount;
    this.groupId = groupId;
    this.interval = intervalMs;
  }

  private getDefaultState(): AppState {
    return {
      pendapatan: [], belanja: [], pembiayaan: [], penerimaan: [],
      silpa: [], spp: [], pencairan: [], penyetoranPajak: [],
      saldoAwal: [], spjPanjar: [], jurnalUmum: [], mutasiKas: [],
      kegiatanAnggaran: [], __meta: {}
    };
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initialize virtual users
    for (let i = 0; i < this.userCount; i++) {
      this.virtualUsers.push({
        sessionId: `bot-user-${i}-${crypto.randomUUID().slice(0, 8)}`,
        userName: `Bot Akuntan ${i + 1}`,
        localState: this.getDefaultState()
      });
    }

    // Start each bot's lifecycle
    this.virtualUsers.forEach((user, idx) => {
      // Stagger start times
      const timer = setTimeout(() => this.botCycle(user), idx * (this.interval / this.userCount));
      this.timers.push(timer);
    });

    console.log(`Simulation started with ${this.userCount} users in group ${this.groupId}`);
  }

  stop() {
    this.isRunning = false;
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    console.log("Simulation stopped");
  }

  private async botCycle(user: { sessionId: string; userName: string; localState: AppState }) {
    if (!this.isRunning) return;

    try {
      // 1. Pull latest group state
      const active = await getActiveSessions(5);
      const latest = active.find(s => s.group_id === this.groupId && s.session_id !== user.sessionId);

      if (latest && latest.form_data) {
        user.localState = mergeStates(user.localState, latest.form_data as Partial<AppState>);
      }

      // 2. Decide and perform an action
      this.performRandomAction(user);

      // 3. Push back to API
      await upsertSession({
        user_name: user.userName,
        group_id: this.groupId,
        form_data: user.localState as any,
        village_id: "SIMULATION_VILLAGE",
        village_name: "Desa Simulasi",
        work_mode: "group"
      });

    } catch (err) {
      console.error(`Bot ${user.userName} error:`, err);
    }

    // Schedule next cycle
    if (this.isRunning) {
      const timer = setTimeout(() => this.botCycle(user), this.interval + (Math.random() * 1000));
      this.timers.push(timer);
    }
  }

  private performRandomAction(user: { localState: AppState; userName: string }) {
    const dice = Math.random();
    
    if (dice < 0.3) {
      this.addPendapatan(user);
    } else if (dice < 0.6) {
      this.addBelanja(user);
    } else if (dice < 0.8) {
      this.addSPP(user);
    } else {
      this.addPenyetoranPajak(user);
    }
  }

  private addPendapatan(user: { localState: AppState; userName: string }) {
    const item = {
      id: crypto.randomUUID(),
      kodeRekening: "4.1.1.01",
      namaRekening: "Hasil Usaha Desa",
      uraian: `Pendapatan oleh ${user.userName} - ${new Date().toLocaleTimeString()}`,
      anggaran: 1000000 + Math.floor(Math.random() * 5000000),
      sumberDana: "PAD",
      jumlahSatuan: "1 Ls",
      hargaSatuan: 1
    };
    user.localState.pendapatan.push(item);
  }

  private addBelanja(user: { localState: AppState; userName: string }) {
    const item = {
      id: crypto.randomUUID(),
      kodeBidang: "1",
      kodeKegiatan: "1.1.01",
      namaKegiatan: "Penyelenggaraan Siltap",
      kodeRekening: "5.1.1.01",
      namaRekening: "Penghasilan Tetap Kepala Desa",
      nomorUrut: String(user.localState.belanja.length + 1),
      uraian: `Belanja oleh ${user.userName}`,
      anggaran: 2000000 + Math.floor(Math.random() * 1000000),
      jumlahSatuan: "1 Bln",
      hargaSatuan: 1,
      sumberDana: "ADD"
    };
    user.localState.belanja.push(item);
  }

  private addSPP(user: { localState: AppState; userName: string }) {
    if (user.localState.belanja.length === 0) return;
    const belanja = user.localState.belanja[Math.floor(Math.random() * user.localState.belanja.length)];
    
    const item = {
      id: crypto.randomUUID(),
      jenis: 'definitif' as const,
      tanggalSPP: new Date().toISOString().split("T")[0],
      nomorSPP: `${String(user.localState.spp.length + 1).padStart(4, "0")}/SPP/2026`,
      uraian: `SPP oleh ${user.userName} untuk ${belanja.uraian}`,
      jumlah: 500000 + Math.floor(Math.random() * 500000),
      isFinal: true,
      rincian: [{
        id: crypto.randomUUID(),
        kodeRekening: belanja.kodeRekening,
        namaRekening: belanja.namaRekening,
        nilai: 500000,
        belanjaId: belanja.id,
        kodeKegiatan: belanja.kodeKegiatan,
        namaKegiatan: belanja.namaKegiatan
      }],
      buktiTransaksi: [{
        id: crypto.randomUUID(),
        tanggal: new Date().toISOString().split("T")[0],
        noBukti: `BT-${crypto.randomUUID().slice(0, 5)}`,
        keterangan: "Bukti Transaksi Bot",
        jumlah: 500000,
        penerima: "Toko Bot",
        nama: "Toko Bot",
        alamat: "Jl. Bot No. 1",
        potonganPajak: [{
          kodeRekening: "7.1.1.01",
          namaRekening: "PPN",
          nilai: 50000
        }]
      }]
    };
    user.localState.spp.push(item);
  }

  private addPenyetoranPajak(user: { localState: AppState; userName: string }) {
    if (user.localState.spp.length === 0) return;
    const spp = user.localState.spp[Math.floor(Math.random() * user.localState.spp.length)];
    const bukti = spp.buktiTransaksi[0];
    const pajak = bukti.potonganPajak[0];

    const item = {
      id: crypto.randomUUID(),
      tanggal: new Date().toISOString().split("T")[0],
      noBukti: `SSP-${crypto.randomUUID().slice(0, 5)}`,
      kodeRekening: pajak.kodeRekening,
      kodeMAP: "411211",
      keterangan: `Setor Pajak oleh ${user.userName}`,
      jumlah: pajak.nilai,
      ntpn: `NTPN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      jenis: 'tunai' as const,
      rincianBuktiPotong: [{
        noBukti: bukti.noBukti,
        kodeRekening: pajak.kodeRekening,
        namaRekening: pajak.namaRekening,
        nilai: pajak.nilai
      }]
    };
    user.localState.penyetoranPajak.push(item);
  }
}
