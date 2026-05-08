import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSiteSettings, getActiveSessions, heartbeat, getSessionId } from "@/lib/session-manager";
import { supabase } from "@/integrations/supabase/client";
import { Lock, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_BYPASS_PASSWORD = "12345";

// Wipe all user-side data and force them out of the app.
function wipeLocalUserData() {
  const keysToKeep = ["siskeudes_session_id"]; // keep session id so we don't generate a new one mid-redirect
  const allKeys = Object.keys(localStorage);
  for (const k of allKeys) {
    if (k.startsWith("siskeudes_") && !keysToKeep.includes(k)) {
      localStorage.removeItem(k);
    }
  }
  sessionStorage.clear();
}

export default function SiteLockGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const [maxReached, setMaxReached] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bypassed, setBypassed] = useState(false);
  const [bypassPassword, setBypassPassword] = useState("");
  const [showBypass, setShowBypass] = useState(false);

  // Detect kick/reset from admin (every 4s)
  useEffect(() => {
    // Skip kick-detection while admin is impersonating a user
    if (sessionStorage.getItem("siskeudes_admin") === "true") return;
    if (localStorage.getItem("siskeudes_admin_impersonate")) return;

    const sessionId = getSessionId();
    let cancelled = false;

    const check = async () => {
      // Only react if user actually has data on the server (i.e. they registered via DataUmum)
      const hadVillage = !!localStorage.getItem("siskeudes_selected_village");
      if (!hadVillage) return;

      const { data, error } = await supabase
        .from("user_sessions")
        .select("session_id, form_data, village_id")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (cancelled || error) return;

      // KICKED: server row no longer exists → force user out
      if (!data) {
        toast.error("Anda telah dikeluarkan dari sistem oleh admin.");
        wipeLocalUserData();
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
        return;
      }

      // RESET: server form_data is empty but local has data → admin reset progress
      const localState = localStorage.getItem("siskeudes_app_state");
      const serverEmpty =
        !data.form_data ||
        (typeof data.form_data === "object" && Object.keys(data.form_data as object).length === 0);
      const localHasData = !!localState && localState !== "{}" && localState.length > 4;

      if (serverEmpty && localHasData) {
        toast.info("Progress Anda telah direset oleh admin. Halaman akan dimuat ulang.");
        // Wipe form data but keep village/user identity so they can keep working
        localStorage.removeItem("siskeudes_app_state");
        localStorage.removeItem("siskeudes_state");
        localStorage.removeItem("siskeudes_mutasi_kas");
        setTimeout(() => window.location.reload(), 1200);
      }
    };

    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [navigate]);

  useEffect(() => {
    const check = async () => {
      const settings = await getSiteSettings();
      if (settings?.is_locked) {
        setLocked(true);
        setChecking(false);
        return;
      }

      if (settings?.max_users && settings.max_users > 0) {
        const active = await getActiveSessions(5);
        const sessionId = getSessionId();
        const isExisting = active.some((s) => s.session_id === sessionId);
        if (!isExisting && active.length >= settings.max_users) {
          setMaxReached(true);
          setChecking(false);
          return;
        }
      }

      setLocked(false);
      setMaxReached(false);
      setChecking(false);
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat
  useEffect(() => {
    if ((locked || maxReached) && !bypassed) return;
    heartbeat();
    const interval = setInterval(heartbeat, 30000);
    return () => clearInterval(interval);
  }, [locked, maxReached, bypassed]);

  const handleBypass = () => {
    if (bypassPassword === ADMIN_BYPASS_PASSWORD) {
      setBypassed(true);
      setShowBypass(false);
      toast.success("Verifikasi admin berhasil. Website terbuka.");
    } else {
      toast.error("Password salah!");
    }
    setBypassPassword("");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(152,40%,14%)] to-[hsl(152,35%,22%)]">
        <p className="text-white/60 text-sm animate-pulse">Memuat...</p>
      </div>
    );
  }

  if ((locked || maxReached) && !bypassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(152,40%,14%)] to-[hsl(152,35%,22%)]">
        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {locked ? "Website Terkunci" : "Batas Akses Tercapai"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {locked
              ? "Website sedang dikunci oleh admin. Silakan hubungi admin untuk membuka akses."
              : "Jumlah pengguna aktif telah mencapai batas maksimum. Silakan coba lagi nanti."}
          </p>

          {!showBypass ? (
            <Button variant="outline" size="sm" onClick={() => setShowBypass(true)} className="gap-2">
              <KeyRound size={14} /> Verifikasi Admin
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Masukkan password admin untuk membuka akses:</p>
              <Input
                type="password"
                value={bypassPassword}
                onChange={(e) => setBypassPassword(e.target.value)}
                placeholder="Password admin"
                className="text-center"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleBypass()}
              />
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" size="sm" onClick={() => { setShowBypass(false); setBypassPassword(""); }}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleBypass}>
                  Buka Akses
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
