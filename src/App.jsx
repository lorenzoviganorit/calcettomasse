import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck, Trophy, Users, Settings, ArrowLeftRight, Star, Flame, Anchor,
  AlertTriangle, User, X, LogOut, Plus,
} from "lucide-react";

// ------------------------------------------------------------------
// CONNESSIONE SUPABASE (chiave "publishable", pensata per stare nel client)
// ------------------------------------------------------------------
const SUPABASE_URL = "https://jpyqgegristxnbkxjlge.supabase.co";
const SUPABASE_KEY = "sb_publishable_6fY5cPyvfQFHeVq0_h-65g_IfWQjjhw";
const LOCAL_KEY = "calcio7_uid";

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function sbWrite(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// TOKEN DI DESIGN
// ------------------------------------------------------------------
const C = {
  bg: "#0E1F17",
  surface: "#16281F",
  surface2: "#1E3428",
  chalk: "#F3F1E7",
  muted: "#9FB3A6",
  mutedFaint: "#6E8377",
  flood: "#D7EA63",
  danger: "#E8862B",
  line: "rgba(243,241,231,0.10)",
  palette: ["#93A6BA", "#EA8B31", "#7FB88A", "#C77DBF"],
};

const STORICO_ESEMPIO = [
  { data: "18 ago", golA: 6, golB: 4 },
  { data: "11 ago", golA: 3, golB: 3 },
  { data: "4 ago", golA: 2, golB: 5 },
];

const BADGE_ESEMPIO = [
  { icon: Flame, nome: "Bomber del mese", desc: "Più MVP negli ultimi 30 giorni" },
  { icon: Anchor, nome: "Zoccolo duro", desc: "Mai passato in prestito" },
  { icon: ArrowLeftRight, nome: "Il Mercenario", desc: "Più prestiti stagionali" },
  { icon: Star, nome: "Presenza di ferro", desc: "Zero assenze quest'anno" },
];

const TABS = [
  { id: "home", label: "Partita", icon: Trophy },
  { id: "stats", label: "Statistiche", icon: Users },
  { id: "admin", label: "Admin", icon: Settings },
];

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`,
  background: C.surface2, color: C.chalk, fontSize: 14, fontFamily: "inherit",
};

// ------------------------------------------------------------------
export default function App() {
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [squadre, setSquadre] = useState([]);
  const [giocatori, setGiocatori] = useState([]);
  const [partita, setPartita] = useState(null);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(LOCAL_KEY) || null);
  const [showProfile, setShowProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [sq, gio, part] = await Promise.all([
        sb("squadre?select=*"),
        sb("giocatori?select=*"),
        sb("partite?select=*&stato=eq.aperta&order=data_partita.asc&limit=1"),
      ]);
      let pren = [];
      if (part[0]) {
        pren = await sb(
          `giocatori_partite?select=*,giocatori(*)&id_partita=eq.${part[0].id}&flag_annullamento=eq.false&order=data_prenotazione.asc`
        );
      }
      setSquadre(sq);
      setGiocatori(gio);
      setPartita(part[0] || null);
      setPrenotazioni(pren);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const colorePerSquadra = useMemo(() => {
    const map = {};
    squadre.forEach((s, i) => (map[s.id] = C.palette[i % C.palette.length]));
    return map;
  }, [squadre]);

  const titolariIds = useMemo(() => new Set(prenotazioni.slice(0, 14).map((p) => p.id_giocatore)), [prenotazioni]);
  const contaTitolari = (idSquadra) =>
    prenotazioni.filter((p) => p.id_squadra === idSquadra && titolariIds.has(p.id_giocatore)).length;

  const currentUser = giocatori.find((g) => String(g.id) === String(currentUserId)) || null;

  const handleLogin = (id) => {
    setCurrentUserId(id);
    localStorage.setItem(LOCAL_KEY, id);
  };
  const handleLogout = () => {
    setCurrentUserId(null);
    localStorage.removeItem(LOCAL_KEY);
    setShowProfile(false);
  };

  const withBusy = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await fetchAll();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBooking = () =>
    withBusy(async () => {
      const mine = prenotazioni.find((p) => p.id_giocatore === currentUser.id);
      if (mine) {
        await sbWrite(`giocatori_partite?id=eq.${mine.id}`, "PATCH", { flag_annullamento: true });
      } else {
        await sbWrite("giocatori_partite", "POST", {
          id_giocatore: currentUser.id,
          id_partita: partita.id,
          id_squadra: currentUser.id_squadra,
          data_prenotazione: new Date().toISOString(),
          flag_annullamento: false,
          stato: "riserva",
        });
      }
    });

  const aggiungiPresenza = (giocatoreId) =>
    withBusy(async () => {
      const g = giocatori.find((x) => x.id === giocatoreId);
      await sbWrite("giocatori_partite", "POST", {
        id_giocatore: giocatoreId,
        id_partita: partita.id,
        id_squadra: g.id_squadra,
        data_prenotazione: new Date().toISOString(),
        flag_annullamento: false,
        stato: "riserva",
      });
    });

  const rimuoviPresenza = (prenotazioneId) =>
    withBusy(async () => {
      await sbWrite(`giocatori_partite?id=eq.${prenotazioneId}`, "PATCH", { flag_annullamento: true });
    });

  const spostaSquadra = (prenotazioneId, nuovaSquadraId) =>
    withBusy(async () => {
      await sbWrite(`giocatori_partite?id=eq.${prenotazioneId}`, "PATCH", { id_squadra: nuovaSquadraId });
    });

  const salvaProfilo = (nome, soprannome) =>
    withBusy(async () => {
      await sbWrite(`giocatori?id=eq.${currentUser.id}`, "PATCH", { nome, soprannome });
      setShowProfile(false);
    });

  const showLoginGate = !loading && !error && giocatori.length > 0 && !currentUser;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.chalk, fontFamily: "'Work Sans', system-ui, sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Work+Sans:wght@400;500;600&display=swap');
        .disp { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.03em; }
        .num { font-family: 'Oswald', sans-serif; font-variant-numeric: tabular-nums; }
        button:focus-visible, [tabindex]:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${C.flood}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        .scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ padding: "28px 20px 16px", background: `radial-gradient(120% 100% at 50% 0%, ${C.surface2} 0%, ${C.bg} 70%)`, borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="disp" style={{ fontSize: 12, color: C.mutedFaint, letterSpacing: "0.12em" }}>DATI REALI · SUPABASE</div>
            <div className="disp" style={{ fontSize: 26, marginTop: 2 }}>
              {partita ? "Prossima partita" : loading ? "Carico..." : "Nessuna partita aperta"}
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>
              {partita ? new Date(partita.data_partita).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "\u00A0"}
            </div>
          </div>
          {currentUser && (
            <button onClick={() => setShowProfile(true)} aria-label="Profilo" style={{
              width: 38, height: 38, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.line}`,
              color: C.flood, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
            }} className="disp">
              {(currentUser.soprannome || currentUser.nome || "?").slice(0, 2).toUpperCase()}
            </button>
          )}
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>
          {loading && <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Carico i dati dal database…</div>}

          {!loading && error && (
            <div style={{ background: "rgba(234,139,49,0.08)", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "flex", gap: 10 }}>
              <AlertTriangle size={18} color={C.palette[1]} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                Non riesco a leggere i dati dal database (errore {error}). Probabilmente manca una policy di Row Level Security che permetta la lettura pubblica sulle tabelle.
              </div>
            </div>
          )}

          {showLoginGate && <LoginScreen giocatori={giocatori} onLogin={handleLogin} />}

          {!loading && !error && currentUser && (
            <>
              {tab === "home" && (
                <HomeTab
                  squadre={squadre} colorePerSquadra={colorePerSquadra} prenotazioni={prenotazioni}
                  titolariIds={titolariIds} contaTitolari={contaTitolari} partita={partita}
                  currentUser={currentUser} busy={busy} actionError={actionError} toggleBooking={toggleBooking}
                />
              )}
              {tab === "stats" && <StatsTab />}
              {tab === "admin" && (
                <AdminTab
                  giocatori={giocatori} squadre={squadre} colorePerSquadra={colorePerSquadra}
                  prenotazioni={prenotazioni} titolariIds={titolariIds} partita={partita}
                  currentUser={currentUser} busy={busy} actionError={actionError}
                  aggiungiPresenza={aggiungiPresenza} rimuoviPresenza={rimuoviPresenza} spostaSquadra={spostaSquadra}
                />
              )}
            </>
          )}
        </div>

        {currentUser && (
          <div style={{ position: "sticky", bottom: 0, display: "flex", background: C.surface, borderTop: `1px solid ${C.line}` }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", padding: "12px 0 10px", cursor: "pointer", color: active ? C.flood : C.mutedFaint, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  <span className="disp" style={{ fontSize: 11 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {showProfile && currentUser && (
          <ProfileModal currentUser={currentUser} busy={busy} actionError={actionError} onSave={salvaProfilo} onLogout={handleLogout} onClose={() => setShowProfile(false)} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
function LoginScreen({ giocatori, onLogin }) {
  const ordinati = [...giocatori].sort((a, b) => a.nome.localeCompare(b.nome));
  const [selId, setSelId] = useState(ordinati[0]?.id || "");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const g = giocatori.find((x) => String(x.id) === String(selId));
    if (g && String(g.pin) === pin.trim()) {
      onLogin(g.id);
    } else {
      setErr("PIN errato — riprova.");
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 20 }}>
      <div>
        <div className="disp" style={{ fontSize: 22 }}>Chi sei?</div>
        <div style={{ fontSize: 13, color: C.mutedFaint, marginTop: 4 }}>Seleziona il tuo nome e inserisci il tuo PIN a 4 cifre.</div>
      </div>
      <select value={selId} onChange={(e) => setSelId(e.target.value)} style={inputStyle}>
        {ordinati.map((g) => (
          <option key={g.id} value={g.id}>{g.soprannome || g.nome}</option>
        ))}
      </select>
      <input
        type="password" inputMode="numeric" maxLength={4} placeholder="PIN" value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} style={inputStyle}
      />
      {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
      <button type="submit" className="disp" style={{ padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.flood, color: "#12200F" }}>
        Entra
      </button>
    </form>
  );
}

function ProfileModal({ currentUser, busy, actionError, onSave, onLogout, onClose }) {
  const [nome, setNome] = useState(currentUser.nome || "");
  const [soprannome, setSoprannome] = useState(currentUser.soprannome || "");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.surface, borderRadius: "16px 16px 0 0", padding: 20, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontSize: 18 }}>Il tuo profilo</div>
          <button onClick={onClose} aria-label="Chiudi" style={{ background: "none", border: "none", color: C.mutedFaint, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <label style={{ fontSize: 12, color: C.mutedFaint }}>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...inputStyle, marginTop: -8 }} />

        <label style={{ fontSize: 12, color: C.mutedFaint }}>Soprannome</label>
        <input value={soprannome} onChange={(e) => setSoprannome(e.target.value)} style={{ ...inputStyle, marginTop: -8 }} />

        {actionError && <div style={{ fontSize: 12, color: C.danger }}>Errore nel salvataggio ({actionError}).</div>}

        <button disabled={busy} onClick={() => onSave(nome, soprannome)} className="disp" style={{ padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>
          Salva
        </button>
        <button onClick={onLogout} className="disp" style={{ padding: "12px 0", borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <LogOut size={15} /> Esci
        </button>
      </div>
    </div>
  );
}

function Scoreboard({ squadre, colorePerSquadra, contaTitolari }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: 18, border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        {squadre.map((sq) => (
          <div key={sq.id}>
            <div className="disp" style={{ fontSize: 14, color: colorePerSquadra[sq.id] }}>{sq.nome}</div>
            <div className="num" style={{ fontSize: 30, lineHeight: 1 }}>
              {contaTitolari(sq.id)}<span style={{ fontSize: 16, color: C.mutedFaint }}>/7</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {squadre.map((sq) => (
          <div key={sq.id} style={{ flex: 1, display: "flex", gap: 3 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: i < contaTitolari(sq.id) ? colorePerSquadra[sq.id] : "transparent", border: `1px solid ${i < contaTitolari(sq.id) ? colorePerSquadra[sq.id] : C.line}` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeTab({ squadre, colorePerSquadra, prenotazioni, titolariIds, contaTitolari, partita, currentUser, busy, actionError, toggleBooking }) {
  if (!partita) {
    return <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 20px" }}>Nessuna partita con prenotazioni aperte al momento. Creane una dalla sezione Admin quando vuoi aprire il lunedì successivo.</div>;
  }
  const mia = prenotazioni.find((p) => p.id_giocatore === currentUser.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Scoreboard squadre={squadre} colorePerSquadra={colorePerSquadra} contaTitolari={contaTitolari} />

      <button disabled={busy} onClick={toggleBooking} style={{ padding: "16px 0", borderRadius: 12, cursor: "pointer", background: mia ? "transparent" : C.flood, color: mia ? C.flood : "#12200F", border: `2px solid ${C.flood}`, opacity: busy ? 0.6 : 1 }} className="disp">
        {mia ? "✓ Ci sarai — tocca per annullare" : "Ci sono! ✅"}
      </button>
      {actionError && <div style={{ fontSize: 12, color: C.danger, textAlign: "center", marginTop: -10 }}>Errore ({actionError}) — probabile policy INSERT/UPDATE mancante su giocatori_partite.</div>}

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Prenotati ({prenotazioni.length})</div>
        {prenotazioni.length === 0 ? (
          <div style={{ fontSize: 13, color: C.mutedFaint, padding: "16px 0" }}>Nessuno si è ancora prenotato per questa partita.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {prenotazioni.map((p) => {
              const titolare = titolariIds.has(p.id_giocatore);
              const g = p.giocatori;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.line}`, opacity: titolare ? 1 : 0.55 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: colorePerSquadra[p.id_squadra] }} />
                    <div>
                      <div style={{ fontSize: 14 }}>{g?.soprannome || g?.nome}</div>
                      <div style={{ fontSize: 11, color: C.mutedFaint }}>{g?.ruolo}</div>
                    </div>
                  </div>
                  <div className="disp" style={{ fontSize: 10, color: titolare ? C.flood : C.mutedFaint }}>{titolare ? "TITOLARE" : "RISERVA"}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ fontSize: 12, color: C.mutedFaint, fontStyle: "italic" }}>
        Dati di esempio — qui compariranno lo storico e i badge reali non appena ci saranno partite giocate.
      </div>
      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Ultimi risultati</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {STORICO_ESEMPIO.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 12, color: C.mutedFaint }}>{s.data}</span>
              <span className="num" style={{ fontSize: 16 }}>{s.golA} — {s.golB}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Badge</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {BADGE_ESEMPIO.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} style={{ background: C.surface, borderRadius: 12, padding: 14, border: `1px solid ${C.line}` }}>
                <Icon size={18} color={C.flood} />
                <div className="disp" style={{ fontSize: 12, marginTop: 8 }}>{b.nome}</div>
                <div style={{ fontSize: 11, color: C.mutedFaint, marginTop: 2 }}>{b.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminTab({ giocatori, squadre, colorePerSquadra, prenotazioni, titolariIds, partita, currentUser, busy, actionError, aggiungiPresenza, rimuoviPresenza, spostaSquadra }) {
  const titolari = prenotazioni.filter((p) => titolariIds.has(p.id_giocatore));
  const riserve = prenotazioni.filter((p) => !titolariIds.has(p.id_giocatore));
  const nonPrenotati = giocatori.filter((g) => !prenotazioni.some((p) => p.id_giocatore === g.id));
  const [daAggiungere, setDaAggiungere] = useState(nonPrenotati[0]?.id || "");

  if (!currentUser.is_admin) {
    return (
      <div>
        <div style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 14 }}>Sezione di sola consultazione — le modifiche sono riservate agli admin.</div>
        <AnagraficaLista giocatori={giocatori} colorePerSquadra={colorePerSquadra} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <button style={{ padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.surface2, color: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} className="disp">
        <ShieldCheck size={18} /> Suggerisci formazione
      </button>

      {actionError && <div style={{ fontSize: 12, color: C.danger }}>Errore ({actionError}) — controlla le policy INSERT/UPDATE su giocatori_partite.</div>}

      {partita && nonPrenotati.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <select value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            {nonPrenotati.map((g) => (
              <option key={g.id} value={g.id}>{g.soprannome || g.nome}</option>
            ))}
          </select>
          <button disabled={busy} onClick={() => aggiungiPresenza(Number(daAggiungere))} className="disp" style={{ padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", display: "flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
            <Plus size={16} /> Aggiungi
          </button>
        </div>
      )}

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Titolari ({titolari.length}/14)</div>
        {titolari.length === 0 && <div style={{ fontSize: 12, color: C.mutedFaint }}>Nessuno ancora.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {titolari.map((p) => {
            const g = p.giocatori;
            const altraSquadra = squadre.find((s) => s.id !== p.id_squadra);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: colorePerSquadra[p.id_squadra] }} />
                  <span style={{ fontSize: 14 }}>{g?.soprannome || g?.nome} <span style={{ color: C.mutedFaint, fontSize: 11 }}>({g?.ruolo} · {g?.forza})</span></span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {altraSquadra && (
                    <button disabled={busy} onClick={() => spostaSquadra(p.id, altraSquadra.id)} aria-label="Sposta squadra" style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedFaint, padding: 4 }}>
                      <ArrowLeftRight size={16} />
                    </button>
                  )}
                  <button disabled={busy} onClick={() => rimuoviPresenza(p.id)} aria-label="Rimuovi presenza" style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedFaint, padding: 4 }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Riserve ({riserve.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {riserve.map((p, idx) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "transparent", borderRadius: 10, border: `1px dashed ${C.line}` }}>
              <span style={{ fontSize: 13, color: C.muted }}>{p.giocatori?.soprannome || p.giocatori?.nome}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="disp" style={{ fontSize: 10, color: C.mutedFaint }}>{idx + 1}ª riserva</span>
                <button disabled={busy} onClick={() => rimuoviPresenza(p.id)} aria-label="Rimuovi presenza" style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedFaint, padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnagraficaLista giocatori={giocatori} colorePerSquadra={colorePerSquadra} />

      <button style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }} className="disp">
        + Nuova partita
      </button>
    </div>
  );
}

function AnagraficaLista({ giocatori, colorePerSquadra }) {
  return (
    <div>
      <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Anagrafica giocatori ({giocatori.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {giocatori.map((g) => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: colorePerSquadra[g.id_squadra] }} />
              <span style={{ fontSize: 14 }}>{g.soprannome || g.nome} <span style={{ color: C.mutedFaint, fontSize: 11 }}>({g.ruolo} · {g.forza})</span></span>
            </div>
            {g.is_admin && <span className="disp" style={{ fontSize: 9, color: C.flood }}>ADMIN</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
