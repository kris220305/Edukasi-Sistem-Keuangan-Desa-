import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { AlertCircle } from "lucide-react";

export default function DirtyStateBadge() {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const handleDirty = (e: any) => setIsDirty(e.detail);
    window.addEventListener("siskeudes:dirty", handleDirty);
    return () => window.removeEventListener("siskeudes:dirty", handleDirty);
  }, []);

  if (!isDirty) return null;

  return (
    <Badge variant="destructive" className="gap-1.5 text-[11px] px-2 py-0.5 animate-pulse">
      <AlertCircle size={12} />
      <span>Belum Tersimpan</span>
    </Badge>
  );
}
