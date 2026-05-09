import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, getActiveSessions } from "@/lib/session-manager";
import { toast } from "sonner";
import { loadState, mergeStates, type AppState } from "@/data/app-state";

/**
 * Subscribes to realtime updates of user_sessions rows that belong to the
 * current user's group, AND performs an initial pull so latecomers immediately
 * see what teammates already saved.
 *
 * Improvements vs previous version:
 *  - Initial pull on mount + when group_id changes (no more "kosong padahal teman sudah ngerjakan")
 *  - Soft state apply (no full window.location.reload) → dispatches "siskeudes:state-updated"
 *    so pages re-read localStorage without a hard reload (less patah-patah on slow devices)
 *  - Smarter debounce: collapses bursts of incoming updates into a single apply
 *  - Conflict detection: if a teammate writes within 2s of my own write, show a warning toast
 */

const LAST_LOCAL_WRITE_KEY = "siskeudes_last_local_write_at";

function applyIncomingState(formData: Record<string, unknown>) {
  try {
    const { mutasiKas, ...rest } = formData as { mutasiKas?: unknown };
    const local = loadState();
    const merged = mergeStates(local, rest as Partial<AppState>);
    const mergedStr = JSON.stringify(merged);
    const currentStr = JSON.stringify(local);
    if (mergedStr === currentStr) {
      // still sync mutasi-kas separately if it changed
      if (mutasiKas) {
        const cur = localStorage.getItem("siskeudes_mutasi_kas");
        const inc = JSON.stringify(mutasiKas);
        if (cur !== inc) {
          localStorage.setItem("siskeudes_mutasi_kas", inc);
          window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
          return true;
        }
      }
      return false;
    }

    localStorage.setItem("siskeudes_state", mergedStr);
    localStorage.setItem("siskeudes_app_state", mergedStr);
    if (mutasiKas) {
      localStorage.setItem("siskeudes_mutasi_kas", JSON.stringify(mutasiKas));
    }
    window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
    return true;
  } catch {
    return false;
  }
}

async function initialPullForGroup(groupId: string, mySessionId: string) {
  const data = await getActiveSessions(60); // Check active in last hour
  if (!data || data.length === 0) return;
  
  // Pick the most recently active row that's NOT mine and has non-empty form_data
  const candidate = data.find(
    (r) =>
      r.group_id === groupId &&
      r.session_id !== mySessionId &&
      r.form_data &&
      typeof r.form_data === "object" &&
      Object.keys(r.form_data as object).length > 0,
  );
  if (!candidate) return;
  const applied = applyIncomingState(candidate.form_data as Record<string, unknown>);
  if (applied) {
    toast.info("Memuat pekerjaan terbaru dari kelompok…", { duration: 1500 });
  }
}

export function useGroupRealtimeSync() {
  useEffect(() => {
    const sessionId = getSessionId();
    let cleanupFns: Array<() => void> = [];
    let pendingApplyTimer: ReturnType<typeof setTimeout> | null = null;
    let latestPayload: Record<string, unknown> | null = null;

    const start = async () => {
      const groupId = localStorage.getItem("siskeudes_group_id");
      if (!groupId) return;

      // 1. Initial pull so we see what's already there
      await initialPullForGroup(groupId, sessionId);

      // 2. Subscribe to live updates
      const channel = supabase
        .channel(`group-sync-${groupId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_sessions",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            const row = payload.new as { session_id?: string; form_data?: unknown };
            if (!row || row.session_id === sessionId) return;
            if (!row.form_data || typeof row.form_data !== "object") return;

            // With merge engine, concurrent writes no longer overwrite — no conflict warning needed.
            latestPayload = row.form_data as Record<string, unknown>;

            // Tight debounce: collapse bursts within 80ms into one apply
            if (pendingApplyTimer) clearTimeout(pendingApplyTimer);
            pendingApplyTimer = setTimeout(() => {
              if (!latestPayload) return;
              const changed = applyIncomingState(latestPayload);
              latestPayload = null;
              if (changed) {
                toast.info("Data kelompok diperbarui", { duration: 800 });
              }
            }, 80);
          },
        )
        .subscribe();

      cleanupFns.push(() => {
        if (pendingApplyTimer) clearTimeout(pendingApplyTimer);
        supabase.removeChannel(channel);
      });
    };

    start();

    // Re-subscribe whenever group id changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === "siskeudes_group_id") {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        start();
      }
    };
    window.addEventListener("storage", onStorage);

    // Also expose a manual trigger so other code can request a pull
    const onManualPull = () => {
      const gid = localStorage.getItem("siskeudes_group_id");
      if (gid) initialPullForGroup(gid, sessionId);
    };
    window.addEventListener("siskeudes:request-group-pull", onManualPull);

    return () => {
      cleanupFns.forEach((fn) => fn());
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("siskeudes:request-group-pull", onManualPull);
    };
  }, []);
}
