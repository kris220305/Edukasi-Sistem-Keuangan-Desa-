import { useEffect, useState } from "react";
import { RefreshCw, Cloud, AlertTriangle } from "lucide-react";
import { Badge } from "./ui/badge";

type SyncStatusType = "idle" | "syncing" | "saved" | "error";

export default function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusType>("idle");

  useEffect(() => {
    const handleSync = (e: any) => {
      setStatus(e.detail as SyncStatusType);
    };
    window.addEventListener("siskeudes:sync-status", handleSync);
    return () => window.removeEventListener("siskeudes:sync-status", handleSync);
  }, []);

  if (status === "idle") return null;

  return (
    <div className="fixed bottom-12 right-6 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-300">
      {status === "syncing" && (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1.5 px-3 py-1.5 backdrop-blur-md">
          <RefreshCw size={14} className="animate-spin" />
          <span className="text-[11px] font-medium">Menyinkronkan...</span>
        </Badge>
      )}
      {status === "saved" && (
        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 gap-1.5 px-3 py-1.5 backdrop-blur-md">
          <Cloud size={14} />
          <span className="text-[11px] font-medium">Tersimpan</span>
        </Badge>
      )}
      {status === "error" && (
        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5 px-3 py-1.5 backdrop-blur-md">
          <AlertTriangle size={14} />
          <span className="text-[11px] font-medium">Gagal Sinkron</span>
        </Badge>
      )}
    </div>
  );
}
