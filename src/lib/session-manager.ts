
const SESSION_KEY = "siskeudes_session_id";
const DEFAULT_MAX_GROUP_MEMBERS = 10;
const DEFAULT_MIN_GROUP_MEMBERS = 1;
const SITE_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type SessionUpsertInput = {
  user_name?: string;
  village_id?: string;
  village_name?: string;
  form_progress?: Record<string, boolean>;
  form_data?: Record<string, unknown>;
  work_mode?: string;
  group_id?: string | null;
};

type UserSessionRecord = {
  session_id: string;
  form_data?: unknown;
  form_progress?: unknown;
  village_id?: string;
  [key: string]: unknown;
};

async function apiRequest<T>(path: string, init?: RequestInit, retries = 2): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(path, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          errorData = { error: text };
        }
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      
      // If it's a network error or timeout, wait a bit and retry
      if (i < retries) {
        const delay = Math.pow(2, i) * 800;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError;
}

// ============ VILLAGE GROUP LIMITS (admin-controlled, realtime-synced) ============

export interface VillageGroupLimit {
  village_id: string;
  village_name: string;
  min_members: number;
  max_members: number;
}

export async function getVillageGroupLimit(villageId: string): Promise<VillageGroupLimit> {
  try {
    const data = await apiRequest<VillageGroupLimit | null>(`/api/village-group-limits?villageId=${encodeURIComponent(villageId)}`);
    if (data) return data;
  } catch (error) {
    console.error("Failed to fetch village group limit via API:", error);
  }
  
  return {
    village_id: villageId,
    village_name: "",
    min_members: DEFAULT_MIN_GROUP_MEMBERS,
    max_members: DEFAULT_MAX_GROUP_MEMBERS,
  };
}

export async function getAllVillageGroupLimits(): Promise<VillageGroupLimit[]> {
  try {
    return await apiRequest<VillageGroupLimit[]>("/api/village-group-limits") || [];
  } catch (error) {
    console.error("Failed to fetch all village group limits via API:", error);
    return [];
  }
}

export async function upsertVillageGroupLimit(input: VillageGroupLimit) {
  await apiRequest("/api/village-group-limits", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function upsertSession(data: SessionUpsertInput) {
  const sessionId = getSessionId();
  await apiRequest("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ sessionId, payload: data }),
  });
}

export async function heartbeat() {
  const sessionId = getSessionId();
  await apiRequest("/api/sessions", {
    method: "PATCH",
    body: JSON.stringify({ sessionId }),
  });
}

export async function getSiteSettings() {
  return await apiRequest("/api/site-settings");
}

export async function updateSiteSettings(updates: { is_locked?: boolean; max_users?: number }) {
  await apiRequest("/api/site-settings", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function getAllSessions() {
  return await apiRequest<UserSessionRecord[]>("/api/sessions?action=all") || [];
}

export async function deleteSession(sessionId: string) {
  await apiRequest(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function getActiveSessions(minutesThreshold = 5) {
  return await apiRequest<UserSessionRecord[]>(`/api/sessions?action=active&minutes=${minutesThreshold}`) || [];
}

export async function getSessionRecord(sessionId: string): Promise<UserSessionRecord | null> {
  return await apiRequest<UserSessionRecord | null>(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}`) || null;
}

export async function trackFormProgress(formKey: string) {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");

  await upsertSession({ form_progress: { [formKey]: true } });

  if (groupId) {
    await apiRequest("/api/groups?action=sync-progress", {
      method: "POST",
      body: JSON.stringify({ formKey, sessionId, groupId }),
    });
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
  return await apiRequest<GroupRow[]>(`/api/groups?action=by-village&villageId=${encodeURIComponent(villageId)}`) || [];
}

/**
 * Get all groups (across all villages) along with member counts.
 * Used so any user can browse other groups' work even from a different desa.
 */
export async function getAllGroupsWithCounts(): Promise<GroupWithMemberCount[]> {
  const groups = await apiRequest<any[]>(`/api/groups?action=all-with-counts`) || [];
  
  // Pull all per-village limits in one shot
  const limits = await getAllVillageGroupLimits();
  const limitMap = new Map(limits.map((l) => [l.village_id, l.max_members]));

  return groups.map((g) => {
    const max = limitMap.get(g.village_id) ?? DEFAULT_MAX_GROUP_MEMBERS;
    return { ...g, is_full: g.member_count >= max };
  });
}

export async function getGroupMembers(groupId: string) {
  return await apiRequest<any[]>(`/api/groups?action=members&groupId=${encodeURIComponent(groupId)}`) || [];
}

export async function getGroupDetail(groupId: string) {
  return await apiRequest<GroupRow | null>(`/api/groups?action=detail&groupId=${encodeURIComponent(groupId)}`);
}

async function createGroup(name: string, villageId: string, villageName: string) {
  return await apiRequest<GroupRow>("/api/groups?action=create", {
    method: "POST",
    body: JSON.stringify({ name, village_id: villageId, village_name: villageName }),
  });
}

async function addMember(groupId: string, sessionId: string, userName: string) {
  return await apiRequest("/api/groups?action=add-member", {
    method: "POST",
    body: JSON.stringify({ group_id: groupId, session_id: sessionId, user_name: userName }),
  });
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

  const response = await apiRequest<any>("/api/groups?action=join-smart", {
    method: "POST",
    body: JSON.stringify({ villageId, villageName, userName, sessionId, preferredGroupId }),
  });

  const { groupId, formData, formProgress } = response;

  if (formData && typeof formData === "object" && Object.keys(formData).length > 0) {
    // also push into local storage so the running app instantly sees it
    try {
      const fd = formData as Record<string, unknown>;
      const { mutasiKas, ...rest } = fd as { mutasiKas?: unknown };
      localStorage.setItem("siskeudes_app_state", JSON.stringify(rest));
      localStorage.setItem("siskeudes_state", JSON.stringify(rest));
      if (mutasiKas) localStorage.setItem("siskeudes_mutasi_kas", JSON.stringify(mutasiKas));
    } catch { /* ignore */ }
  }

  localStorage.setItem("siskeudes_group_id", groupId);
  return groupId;
}

export async function leaveCurrentGroup() {
  const sessionId = getSessionId();
  await apiRequest("/api/groups?action=leave", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
  localStorage.removeItem("siskeudes_group_id");
}

export async function isCurrentUserLeader(): Promise<boolean> {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return false;

  const response = await apiRequest<any>("/api/groups?action=is-leader", {
    method: "POST",
    body: JSON.stringify({ sessionId, groupId }),
  });

  return response.isLeader || false;
}

export async function saveState(state: any) {
  const sessionId = getSessionId();
  const parsedState = JSON.parse(JSON.stringify(state));
  
  await apiRequest("/api/sessions", {
    method: "PUT",
    body: JSON.stringify({ sessionId, formData: parsedState }),
  });
}

export async function getSubmittedReports() {
  return await apiRequest<any[]>("/api/reports") || [];
}

export async function submitReport(payload: any) {
  return await apiRequest("/api/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAllPdfs() {
  return await apiRequest<any[]>("/api/pdfs") || [];
}

export async function uploadPdf(fileName: string, fileBase64: string) {
  return await apiRequest("/api/pdfs", {
    method: "POST",
    body: JSON.stringify({ fileName, fileBase64, contentType: "application/pdf" }),
  });
}

export async function kickUser(sessionId: string) {
  return await apiRequest("/api/admin?action=kick-user", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function deletePdf(path: string) {
  return await apiRequest("/api/admin?action=delete-pdf", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export async function kickAllUsers() {
  return await apiRequest("/api/admin?action=kick-all", { method: "POST" });
}

export async function deleteAllReports() {
  return await apiRequest("/api/admin?action=delete-all-reports", { method: "POST" });
}

export async function deleteReport(id: string) {
  return await apiRequest("/api/admin?action=delete-report", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export async function resetUserProgress(sessionId: string) {
  return await apiRequest("/api/admin?action=reset-progress", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function resetAllProgress() {
  return await apiRequest("/api/admin?action=reset-all-progress", {
    method: "POST",
  });
}

export async function deleteAllPdfs(paths: string[]) {
  return await apiRequest("/api/admin?action=delete-all-pdfs", {
    method: "POST",
    body: JSON.stringify({ paths }),
  });
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

  await apiRequest("/api/groups?action=sync-group-data", {
    method: "POST",
    body: JSON.stringify({ sessionId, groupId, formData: parsedState }),
  });
}

export async function loadGroupFormData(): Promise<Record<string, unknown> | null> {
  const sessionId = getSessionId();
  const session = await getSessionRecord(sessionId);
  if (!session?.group_id) return null;

  if (session.form_data && typeof session.form_data === "object" && Object.keys(session.form_data as object).length > 0) {
    return session.form_data as Record<string, unknown>;
  }
  return null;
}

export async function previewGroupFormData(groupId: string): Promise<Record<string, unknown> | null> {
  return await apiRequest<Record<string, unknown> | null>(`/api/groups?action=preview-data&groupId=${encodeURIComponent(groupId)}`);
}
