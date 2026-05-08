import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "siskeudes_session_id";
const DEFAULT_MAX_GROUP_MEMBERS = 10;
const DEFAULT_MIN_GROUP_MEMBERS = 1;

// ============ VILLAGE GROUP LIMITS (admin-controlled, realtime-synced) ============

export interface VillageGroupLimit {
  village_id: string;
  village_name: string;
  min_members: number;
  max_members: number;
}

export async function getVillageGroupLimit(villageId: string): Promise<VillageGroupLimit> {
  const { data } = await supabase
    .from("village_group_limits")
    .select("village_id, village_name, min_members, max_members")
    .eq("village_id", villageId)
    .maybeSingle();
  if (data) return data as VillageGroupLimit;
  return {
    village_id: villageId,
    village_name: "",
    min_members: DEFAULT_MIN_GROUP_MEMBERS,
    max_members: DEFAULT_MAX_GROUP_MEMBERS,
  };
}

export async function getAllVillageGroupLimits(): Promise<VillageGroupLimit[]> {
  const { data } = await supabase
    .from("village_group_limits")
    .select("village_id, village_name, min_members, max_members");
  return (data as VillageGroupLimit[]) || [];
}

export async function upsertVillageGroupLimit(input: VillageGroupLimit) {
  const { error } = await supabase
    .from("village_group_limits")
    .upsert(
      {
        village_id: input.village_id,
        village_name: input.village_name,
        min_members: Math.max(1, Math.floor(input.min_members)),
        max_members: Math.max(1, Math.floor(input.max_members)),
      } as never,
      { onConflict: "village_id" },
    );
  if (error) throw new Error(error.message);
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function upsertSession(data: {
  user_name?: string;
  village_id?: string;
  village_name?: string;
  form_progress?: Record<string, boolean>;
  form_data?: Record<string, unknown>;
  work_mode?: string;
  group_id?: string | null;
}) {
  const sessionId = getSessionId();

  const { data: existing } = await supabase
    .from("user_sessions")
    .select("id, form_progress")
    .eq("session_id", sessionId)
    .maybeSingle();

  const updateObj: Record<string, unknown> = {
    last_active: new Date().toISOString(),
  };
  if (data.user_name !== undefined) updateObj.user_name = data.user_name;
  if (data.village_id !== undefined) updateObj.village_id = data.village_id;
  if (data.village_name !== undefined) updateObj.village_name = data.village_name;
  if (data.form_data !== undefined) updateObj.form_data = JSON.parse(JSON.stringify(data.form_data));
  if (data.work_mode !== undefined) updateObj.work_mode = data.work_mode;
  if (data.group_id !== undefined) updateObj.group_id = data.group_id;

  if (existing) {
    const mergedProgress = {
      ...(typeof existing.form_progress === 'object' && existing.form_progress !== null ? existing.form_progress : {}),
      ...(data.form_progress || {}),
    };
    updateObj.form_progress = mergedProgress as unknown;
    await supabase
      .from("user_sessions")
      .update(updateObj as never)
      .eq("session_id", sessionId);
  } else {
    await supabase.from("user_sessions").insert([{
      session_id: sessionId,
      user_name: data.user_name || "",
      village_id: data.village_id || "",
      village_name: data.village_name || "",
      form_progress: (data.form_progress || {}) as unknown as Record<string, never>,
      form_data: (data.form_data ? JSON.parse(JSON.stringify(data.form_data)) : {}) as unknown as Record<string, never>,
      work_mode: data.work_mode || "individual",
      group_id: data.group_id || null,
    }]);
  }

  // If in group mode, push form_data to all group members so they share state
  if (data.form_data !== undefined) {
    const groupId = data.group_id ?? localStorage.getItem("siskeudes_group_id");
    if (groupId) {
      await supabase
        .from("user_sessions")
        .update({ form_data: JSON.parse(JSON.stringify(data.form_data)), last_active: new Date().toISOString() } as never)
        .eq("group_id", groupId)
        .neq("session_id", sessionId);
    }
  }
}

export async function heartbeat() {
  const sessionId = getSessionId();
  await supabase
    .from("user_sessions")
    .update({ last_active: new Date().toISOString() })
    .eq("session_id", sessionId);
}

export async function getSiteSettings() {
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .single();
  return data;
}

export async function updateSiteSettings(updates: { is_locked?: boolean; max_users?: number }) {
  await supabase
    .from("site_settings")
    .update(updates)
    .eq("id", "00000000-0000-0000-0000-000000000001");
}

export async function getAllSessions() {
  const { data } = await supabase
    .from("user_sessions")
    .select("*")
    .order("last_active", { ascending: false });
  return data || [];
}

export async function deleteSession(sessionId: string) {
  await supabase.from("user_sessions").delete().eq("session_id", sessionId);
}

export async function getActiveSessions(minutesThreshold = 5) {
  const threshold = new Date(Date.now() - minutesThreshold * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("user_sessions")
    .select("*")
    .gte("last_active", threshold)
    .order("last_active", { ascending: false });
  return data || [];
}

export async function trackFormProgress(formKey: string) {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");

  await upsertSession({ form_progress: { [formKey]: true } });

  if (groupId) {
    const { data: members } = await supabase
      .from("group_members")
      .select("session_id")
      .eq("group_id", groupId);

    if (members) {
      for (const member of members) {
        if (member.session_id !== sessionId) {
          const { data: memberSession } = await supabase
            .from("user_sessions")
            .select("form_progress")
            .eq("session_id", member.session_id)
            .maybeSingle();

          const merged = {
            ...(typeof memberSession?.form_progress === 'object' && memberSession?.form_progress !== null ? memberSession.form_progress : {}),
            [formKey]: true,
          };
          await supabase
            .from("user_sessions")
            .update({ form_progress: merged as never, last_active: new Date().toISOString() })
            .eq("session_id", member.session_id);
        }
      }
    }
  }
}

// ============ GROUP FUNCTIONS ============

export interface GroupRow {
  id: string;
  name: string;
  village_id: string;
  village_name: string;
  created_at: string;
}

export interface GroupWithMemberCount extends GroupRow {
  member_count: number;
  is_full: boolean;
}

export async function getGroupForVillage(villageId: string) {
  const { data } = await supabase
    .from("groups")
    .select("*")
    .eq("village_id", villageId)
    .order("created_at", { ascending: true });
  return (data as GroupRow[]) || [];
}

/**
 * Get all groups (across all villages) along with member counts.
 * Used so any user can browse other groups' work even from a different desa.
 */
export async function getAllGroupsWithCounts(): Promise<GroupWithMemberCount[]> {
  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .order("village_name", { ascending: true })
    .order("name", { ascending: true });
  if (!groups) return [];

  const ids = groups.map((g) => g.id);
  const { data: members } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", ids);

  const counts = new Map<string, number>();
  (members || []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1));

  // Pull all per-village limits in one shot
  const limits = await getAllVillageGroupLimits();
  const limitMap = new Map(limits.map((l) => [l.village_id, l.max_members]));

  return (groups as GroupRow[]).map((g) => {
    const c = counts.get(g.id) || 0;
    const max = limitMap.get(g.village_id) ?? DEFAULT_MAX_GROUP_MEMBERS;
    return { ...g, member_count: c, is_full: c >= max };
  });
}

export async function getGroupMembers(groupId: string) {
  const { data } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  return data || [];
}

function letterFor(index: number): string {
  // 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Auto join: pick first non-full group for the village, or create a new one named "Kelompok A/B/C..."
 */
export async function createOrJoinGroup(villageId: string, villageName: string, userName: string): Promise<string> {
  return joinGroupSmart(villageId, villageName, userName, undefined);
}

/**
 * Join a specific group by id, or auto-pick if not provided.
 * Always leaves any previous group first to keep membership unique per session.
 */
export async function joinGroupSmart(
  villageId: string,
  villageName: string,
  userName: string,
  preferredGroupId?: string,
): Promise<string> {
  const sessionId = getSessionId();

  // Leave any existing group first (clean switch)
  await leaveCurrentGroup();

  // Resolve max for this village (admin-controlled)
  const limit = await getVillageGroupLimit(villageId);
  const maxMembers = limit.max_members || DEFAULT_MAX_GROUP_MEMBERS;

  let groupId: string | null = null;

  if (preferredGroupId) {
    const members = await getGroupMembers(preferredGroupId);
    if (members.length >= maxMembers) {
      throw new Error(`Kelompok ini sudah penuh (${maxMembers} anggota).`);
    }
    groupId = preferredGroupId;
  } else {
    const groups = await getGroupForVillage(villageId);
    for (const g of groups) {
      const members = await getGroupMembers(g.id);
      if (members.length < maxMembers) {
        groupId = g.id;
        break;
      }
    }

    if (!groupId) {
      const groupName = `Kelompok ${letterFor(groups.length)}`;
      const { data: newGroup, error } = await supabase
        .from("groups")
        .insert({ village_id: villageId, village_name: villageName, name: groupName } as never)
        .select()
        .single();
      if (error || !newGroup) throw new Error(error?.message || "Gagal membuat kelompok");
      groupId = (newGroup as GroupRow).id;
    }
  }

  // Add member (first member becomes leader)
  const existingMembers = await getGroupMembers(groupId);
  const isFirst = existingMembers.length === 0;
  await supabase.from("group_members").insert({
    group_id: groupId,
    session_id: sessionId,
    user_name: userName,
    is_leader: isFirst,
  });

  if (!isFirst) {
    await randomizeLeader(groupId);
  }

  // Update session: link to group + adopt the group's existing form_data so progress is identical
  const { data: anyMember } = await supabase
    .from("user_sessions")
    .select("form_data, form_progress, village_id, village_name")
    .eq("group_id", groupId)
    .neq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  const updatePayload: Record<string, unknown> = {
    group_id: groupId,
    work_mode: "group",
    village_id: villageId,
    village_name: villageName,
    last_active: new Date().toISOString(),
  };
  if (anyMember?.form_data && typeof anyMember.form_data === "object" && Object.keys(anyMember.form_data).length > 0) {
    updatePayload.form_data = anyMember.form_data;
    // also push into local storage so the running app instantly sees it
    try {
      const fd = anyMember.form_data as Record<string, unknown>;
      const { mutasiKas, ...rest } = fd as { mutasiKas?: unknown };
      localStorage.setItem("siskeudes_app_state", JSON.stringify(rest));
      localStorage.setItem("siskeudes_state", JSON.stringify(rest));
      if (mutasiKas) localStorage.setItem("siskeudes_mutasi_kas", JSON.stringify(mutasiKas));
    } catch { /* ignore */ }
  }
  if (anyMember?.form_progress && typeof anyMember.form_progress === "object") {
    updatePayload.form_progress = anyMember.form_progress;
  }

  await supabase.from("user_sessions").update(updatePayload as never).eq("session_id", sessionId);

  localStorage.setItem("siskeudes_group_id", groupId);
  return groupId;
}

/**
 * Remove the current session from its group. If the group becomes empty, delete it.
 */
export async function leaveCurrentGroup() {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return;

  await supabase.from("group_members").delete().eq("group_id", groupId).eq("session_id", sessionId);

  // Update own session to detach
  await supabase
    .from("user_sessions")
    .update({ group_id: null, work_mode: "individual" } as never)
    .eq("session_id", sessionId);

  // Check remaining members
  const remaining = await getGroupMembers(groupId);
  if (remaining.length === 0) {
    await supabase.from("groups").delete().eq("id", groupId);
  } else {
    // Re-randomize leader if leaver was leader
    const stillHasLeader = remaining.some((m: { is_leader?: boolean }) => m.is_leader);
    if (!stillHasLeader) await randomizeLeader(groupId);
  }

  localStorage.removeItem("siskeudes_group_id");
}

async function randomizeLeader(groupId: string) {
  const { data: members } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId);
  if (!members || members.length === 0) return;

  await supabase.from("group_members").update({ is_leader: false }).eq("group_id", groupId);
  const randomIndex = Math.floor(Math.random() * members.length);
  await supabase.from("group_members").update({ is_leader: true }).eq("id", members[randomIndex].id);
}

export async function isCurrentUserLeader(): Promise<boolean> {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return false;

  const { data } = await supabase
    .from("group_members")
    .select("is_leader")
    .eq("group_id", groupId)
    .eq("session_id", sessionId)
    .maybeSingle();

  return data?.is_leader || false;
}

export async function submitReport(reportData: Record<string, unknown>) {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  const villageName = localStorage.getItem("siskeudes_desa_profile")
    ? JSON.parse(localStorage.getItem("siskeudes_desa_profile")!).namaDesa || ""
    : "";
  const villageId = localStorage.getItem("siskeudes_selected_village") || "";
  const userName = localStorage.getItem("siskeudes_user_name") || "";

  await supabase.from("report_submissions").insert({
    group_id: groupId,
    session_id: sessionId,
    submitted_by: userName,
    village_id: villageId,
    village_name: villageName,
    report_data: reportData as never,
  });
}

export async function getSubmittedReports() {
  const { data } = await supabase
    .from("report_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

/**
 * Snapshot the current app state into the user_sessions row (and to all group members if in group mode).
 */
export async function syncFormDataToGroup() {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  const appState = localStorage.getItem("siskeudes_app_state");
  if (!appState) return;
  const parsedState = JSON.parse(appState);

  await supabase.from("user_sessions").update({ form_data: parsedState as never }).eq("session_id", sessionId);

  if (groupId) {
    await supabase
      .from("user_sessions")
      .update({ form_data: parsedState as never })
      .eq("group_id", groupId)
      .neq("session_id", sessionId);
  }
}

export async function loadGroupFormData(): Promise<Record<string, unknown> | null> {
  const sessionId = getSessionId();
  const { data: session } = await supabase
    .from("user_sessions")
    .select("group_id, form_data")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session?.group_id) return null;

  if (session.form_data && typeof session.form_data === "object" && Object.keys(session.form_data as object).length > 0) {
    return session.form_data as Record<string, unknown>;
  }
  return null;
}

/**
 * Get a group's combined form_data (read-only preview) by inspecting any member.
 * Used to "lihat pekerjaan kelompok lain" without joining.
 */
export async function previewGroupFormData(groupId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("user_sessions")
    .select("form_data, last_active")
    .eq("group_id", groupId)
    .order("last_active", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.form_data || typeof data.form_data !== "object") return null;
  return data.form_data as Record<string, unknown>;
}
