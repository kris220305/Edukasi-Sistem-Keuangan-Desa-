import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getGroupMembers, getSessionId } from "@/lib/session-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, User, Users, ArrowLeft, Clock } from "lucide-react";
import FormPageHeader from "@/components/FormPageHeader";

interface GroupMember {
  id: string;
  session_id: string;
  user_name: string;
  is_leader: boolean;
  joined_at: string;
}

export default function GroupRoom() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const groupId = localStorage.getItem("siskeudes_group_id");
  const currentSessionId = getSessionId();
  const villageName = (() => {
    try {
      return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}").namaDesa || "—";
    } catch { return "—"; }
  })();

  useEffect(() => {
    if (!groupId) {
      navigate("/data-umum");
      return;
    }
    loadMembers();
    const interval = setInterval(loadMembers, 5000);
    return () => clearInterval(interval);
  }, [groupId]);

  const loadMembers = async () => {
    if (!groupId) return;
    const data = await getGroupMembers(groupId);
    setMembers(data as GroupMember[]);
    setLoading(false);
  };

  const leader = members.find(m => m.is_leader);

  return (
    <div>
      <FormPageHeader title={`Room Kelompok — Desa ${villageName}`} subtitle={`${members.length}/10 anggota`}>
        <Button variant="outline" size="sm" onClick={() => navigate("/data-umum")} className="gap-2">
          <ArrowLeft size={14} /> Kembali
        </Button>
      </FormPageHeader>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted-foreground">Anggota</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="mx-auto mb-2 text-yellow-500" size={24} />
              <p className="text-sm font-bold truncate">{leader?.user_name || "—"}</p>
              <p className="text-xs text-muted-foreground">Ketua Kelompok</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="mx-auto mb-2 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{10 - members.length}</span>
              </div>
              <p className="text-sm font-bold">{10 - members.length} slot</p>
              <p className="text-xs text-muted-foreground">Tersisa</p>
            </CardContent>
          </Card>
        </div>

        {/* Member List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={18} /> Daftar Anggota Kelompok
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
            ) : (
              <div className="space-y-2">
                {members.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      m.session_id === currentSessionId
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      m.is_leader ? "bg-yellow-100 text-yellow-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {m.is_leader ? <Crown size={16} /> : <User size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{m.user_name || "—"}</span>
                        {m.is_leader && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-yellow-100 text-yellow-700 border-yellow-200">
                            Ketua
                          </Badge>
                        )}
                        {!m.is_leader && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            Anggota
                          </Badge>
                        )}
                        {m.session_id === currentSessionId && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary">
                            Anda
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                        <Clock size={10} />
                        <span>Bergabung {new Date(m.joined_at).toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>💡 Ketua kelompok dipilih secara acak dan dapat mengirim laporan keuangan ke admin.</p>
          <p>📋 Progress pengerjaan form akan otomatis tersinkronisasi antar anggota kelompok.</p>
        </div>
      </div>
    </div>
  );
}
