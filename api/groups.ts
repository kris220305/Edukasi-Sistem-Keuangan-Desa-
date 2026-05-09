import { getQueryValue, getSupabaseAdmin, parseBody, sendJson } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();
    const action = getQueryValue(req.query?.action);

    if (req.method === "GET") {
      if (action === "all-with-counts") {
        const { data: groups } = await supabase
          .from("groups")
          .select("*")
          .order("village_name", { ascending: true })
          .order("name", { ascending: true });
        
        if (!groups) return sendJson(res, 200, []);

        const ids = groups.map((g) => g.id);
        const { data: members } = await supabase
          .from("group_members")
          .select("group_id")
          .in("group_id", ids);

        const counts = new Map<string, number>();
        (members || []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1));

        return sendJson(res, 200, groups.map(g => ({
          ...g,
          member_count: counts.get(g.id) || 0
        })));
      }

      if (action === "members") {
        const groupId = getQueryValue(req.query?.groupId);
        if (!groupId) return sendJson(res, 400, { error: "groupId is required" });

        const { data, error } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true });

        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data || []);
      }

      if (action === "detail") {
        const groupId = getQueryValue(req.query?.groupId);
        if (!groupId) return sendJson(res, 400, { error: "groupId is required" });

        const { data, error } = await supabase
          .from("groups")
          .select("*")
          .eq("id", groupId)
          .maybeSingle();

        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data || null);
      }

      if (action === "by-village") {
        const villageId = getQueryValue(req.query?.villageId);
        if (!villageId) return sendJson(res, 400, { error: "villageId is required" });

        const { data, error } = await supabase
          .from("groups")
          .select("*")
          .eq("village_id", villageId)
          .order("created_at", { ascending: true });

        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data || []);
      }
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      
      if (action === "join-smart") {
        const { villageId, villageName, userName, sessionId, preferredGroupId } = body;
        
        // 1. Leave current group
        await supabase.from("group_members").delete().eq("session_id", sessionId);

        // 2. Resolve max
        const { data: limit } = await supabase
          .from("village_group_limits")
          .select("max_members")
          .eq("village_id", villageId)
          .maybeSingle();
        const maxMembers = limit?.max_members || 10;

        let groupId = preferredGroupId;
        if (!groupId) {
          const { data: groups } = await supabase
            .from("groups")
            .select("id")
            .eq("village_id", villageId)
            .order("created_at", { ascending: true });
          
          for (const g of (groups || [])) {
            const { count } = await supabase
              .from("group_members")
              .select("id", { count: 'exact', head: true })
              .eq("group_id", g.id);
            
            if ((count || 0) < maxMembers) {
              groupId = g.id;
              break;
            }
          }

          if (!groupId) {
            const groupName = `Kelompok ${String.fromCharCode(65 + (groups?.length || 0))}`;
            const { data: newGroup } = await supabase
              .from("groups")
              .insert({ village_id: villageId, village_name: villageName, name: groupName })
              .select()
              .single();
            groupId = newGroup.id;
          }
        }

        // 3. Add member
        const { count: memberCount } = await supabase
          .from("group_members")
          .select("id", { count: 'exact', head: true })
          .eq("group_id", groupId);
        
        const isFirst = (memberCount || 0) === 0;
        await supabase.from("group_members").insert({
          group_id: groupId,
          session_id: sessionId,
          user_name: userName,
          is_leader: isFirst
        });

        // 4. Randomize leader if not first
        if (!isFirst) {
          const { data: members } = await supabase.from("group_members").select("id").eq("group_id", groupId);
          if (members) {
            await supabase.from("group_members").update({ is_leader: false }).eq("group_id", groupId);
            const randomIdx = Math.floor(Math.random() * members.length);
            await supabase.from("group_members").update({ is_leader: true }).eq("id", members[randomIdx].id);
          }
        }

        // 5. Get any member's data to sync
        const { data: anyMember } = await supabase
          .from("user_sessions")
          .select("form_data, form_progress")
          .eq("group_id", groupId)
          .neq("session_id", sessionId)
          .limit(1)
          .maybeSingle();

        const updatePayload: Record<string, any> = {
          group_id: groupId,
          work_mode: "group",
          village_id: villageId,
          village_name: villageName,
          last_active: new Date().toISOString()
        };
        if (anyMember?.form_data) updatePayload.form_data = anyMember.form_data;
        if (anyMember?.form_progress) updatePayload.form_progress = anyMember.form_progress;

        await supabase.from("user_sessions").update(updatePayload).eq("session_id", sessionId);

        return sendJson(res, 200, { groupId, formData: anyMember?.form_data, formProgress: anyMember?.form_progress });
      }

      if (action === "is-leader") {
        const { sessionId, groupId } = body;
        const { data } = await supabase
          .from("group_members")
          .select("is_leader")
          .eq("group_id", groupId)
          .eq("session_id", sessionId)
          .maybeSingle();
        return sendJson(res, 200, { isLeader: data?.is_leader || false });
      }

      if (action === "sync-group-data") {
        const { sessionId, groupId, formData } = body;
        
        // Update my session
        await supabase
          .from("user_sessions")
          .update({ form_data: formData, last_active: new Date().toISOString() })
          .eq("session_id", sessionId);

        if (groupId) {
          // Update others in group
          await supabase
            .from("user_sessions")
            .update({ form_data: formData, last_active: new Date().toISOString() })
            .eq("group_id", groupId)
            .neq("session_id", sessionId);
        }
        return sendJson(res, 200, { success: true });
      }

      if (action === "preview-data") {
        const groupId = getQueryValue(req.query?.groupId);
        const { data } = await supabase
          .from("user_sessions")
          .select("form_data, last_active")
          .eq("group_id", groupId)
          .order("last_active", { ascending: false })
          .limit(1)
          .maybeSingle();
        return sendJson(res, 200, data?.form_data || null);
      }

      if (action === "create") {
        const { name, village_id, village_name } = body;
        const { data, error } = await supabase
          .from("groups")
          .insert({ name, village_id, village_name })
          .select()
          .single();
          
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data);
      }

      if (action === "add-member") {
        const { group_id, session_id, user_name } = body;
        const { data, error } = await supabase
          .from("group_members")
          .insert({ group_id, session_id, user_name })
          .select()
          .single();
          
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, data);
      }

      if (action === "leave") {
        const { session_id } = body;
        const { error } = await supabase
          .from("group_members")
          .delete()
          .eq("session_id", session_id);
          
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { success: true });
      }

      if (action === "sync-progress") {
        const { formKey, sessionId, groupId } = body;
        
        // Update my session
        await supabase
          .from("user_sessions")
          .update({ last_active: new Date().toISOString() })
          .eq("session_id", sessionId);

        // Update others in group
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
        return sendJson(res, 200, { success: true });
      }
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson(res, 500, { error: message });
  }
}
