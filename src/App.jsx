import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ShieldCheck, Trophy, Users, Settings, ArrowLeftRight, Star, Flame, Anchor,
  AlertTriangle, X, LogOut, Plus, KeyRound, UserPlus,
} from "lucide-react";

// ------------------------------------------------------------------
// CONNESSIONE SUPABASE (chiave "publishable", pensata per stare nel client)
// ------------------------------------------------------------------
const SUPABASE_URL = "https://jpyqgegristxnbkxjlge.supabase.co";
const SUPABASE_KEY = "sb_publishable_6fY5cPyvfQFHeVq0_h-65g_IfWQjjhw";
const LOCAL_KEY = "calcio7_uid";
const LAST_LOGIN_KEY = "calcio7_last_login_select";

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

const RUOLI = ["POR", "DIF", "CEN", "ATT"];

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`,
  background: C.surface2, color: C.chalk, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
};
const labelStyle = { fontSize: 12, color: C.mutedFaint };

// ------------------------------------------------------------------
// Combobox con ricerca — usato ovunque serve scegliere un giocatore da una lista lunga
// ------------------------------------------------------------------
function SearchableSelect({ options, value, onChange, placeholder }) {
  const selected = options.find((o) => String(o.id) === String(value));
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      const lbl = options.find((o) => String(o.id) === String(value))?.label;
      if (lbl !== undefined) setQuery(lbl);
    }
  }, [value, open, options]);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setOpen(false)}
        style={inputStyle}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, maxHeight: 220, overflowY: "auto" }}>
          {filtered.map((o) => (
            <div
              key={o.id}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.id); setQuery(o.label); setOpen(false); }}
              style={{ padding: "9px 12px", cursor: "pointer", fontSize: 14, borderBottom: `1px solid ${C.line}` }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const titolariIds = useMemo(() => new Set(prenotazioni.slice(0, 14).map((p) => p.id)), [prenotazioni]);
  const contaTitolari = (idSquadra) =>
    prenotazioni.filter((p) => p.id_squadra === idSquadra && titolariIds.has(p.id)).length;

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

  const portaOspite = (nomeOspite, idSquadra) =>
    withBusy(async () => {
      await sbWrite("giocatori_partite", "POST", {
        id_giocatore: null,
        nome_ospite: nomeOspite,
        id_partita: partita.id,
        id_squadra: idSquadra,
        data_prenotazione: new Date().toISOString(),
        flag_annullamento: false,
        stato: "riserva",
      });
    });

  const spostaSquadra = (prenotazioneId, nuovaSquadraId) =>
    withBusy(async () => {
      await sbWrite(`giocatori_partite?id=eq.${prenotazioneId}`, "PATCH", { id_squadra: nuovaSquadraId });
    });

  const salvaProfilo = (nome, soprannome) =>
    withBusy(async () => {
      await sbWrite(`giocatori?id=eq.${currentUser.id}`, "PATCH", { nome, soprannome });
    });

  const cambiaPin = (nuovoPin) =>
    withBusy(async () => {
      await sbWrite(`giocatori?id=eq.${currentUser.id}`, "PATCH", { pin: nuovoPin });
    });

  const creaGiocatore = (dati) =>
    withBusy(async () => {
      await sbWrite("giocatori", "POST", { ...dati, is_admin: false });
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
                  portaOspite={portaOspite}
                />
              )}
              {tab === "stats" && <StatsTab />}
              {tab === "admin" && (
                <AdminTab
                  giocatori={giocatori} squadre={squadre} colorePerSquadra={colorePerSquadra}
                  prenotazioni={prenotazioni} titolariIds={titolariIds} partita={partita}
                  currentUser={currentUser} busy={busy} actionError={actionError}
                  aggiungiPresenza={aggiungiPresenza} rimuoviPresenza={rimuoviPresenza} spostaSquadra={spostaSquadra}
                  creaGiocatore={creaGiocatore}
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
          <ProfileModal currentUser={currentUser} busy={busy} actionError={actionError} onSaveProfilo={salvaProfilo} onCambiaPin={cambiaPin} onLogout={handleLogout} onClose={() => setShowProfile(false)} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
function LoginScreen({ giocatori, onLogin }) {
  const opzioni = useMemo(
    () => [...giocatori].sort((a, b) => (a.soprannome || a.nome).localeCompare(b.soprannome || b.nome)).map((g) => ({ id: g.id, label: g.soprannome || g.nome })),
    [giocatori]
  );
  const [selId, setSelId] = useState(() => {
    const saved = localStorage.getItem(LAST_LOGIN_KEY);
    return saved && giocatori.some((g) => String(g.id) === saved) ? saved : opzioni[0]?.id || "";
  });
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(null);

  const selectPlayer = (id) => {
    setSelId(id);
    localStorage.setItem(LAST_LOGIN_KEY, id);
  };

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
        <div style={{ fontSize: 13, color: C.mutedFaint, marginTop: 4 }}>Cerca il tuo nome e inserisci il tuo PIN a 4 cifre.</div>
      </div>
      <SearchableSelect options={opzioni} value={selId} onChange={selectPlayer} placeholder="Cerca il tuo nome..." />
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

function ProfileModal({ currentUser, busy, actionError, onSaveProfilo, onCambiaPin, onLogout, onClose }) {
  const [nome, setNome] = useState(currentUser.nome || "");
  const [soprannome, setSoprannome] = useState(currentUser.soprannome || "");
  const [savedMsg, setSavedMsg] = useState(false);

  const [showPin, setShowPin] = useState(false);
  const [pinAttuale, setPinAttuale] = useState("");
  const [pinNuovo, setPinNuovo] = useState("");
  const [pinErr, setPinErr] = useState(null);
  const [pinOk, setPinOk] = useState(false);

  const salvaProfiloClick = async () => {
    await onSaveProfilo(nome, soprannome);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const cambiaPinClick = async () => {
    setPinErr(null);
    if (String(currentUser.pin) !== pinAttuale.trim()) {
      setPinErr("Il PIN attuale non è corretto.");
      return;
    }
    if (pinNuovo.trim().length !== 4) {
      setPinErr("Il nuovo PIN deve avere 4 cifre.");
      return;
    }
    await onCambiaPin(pinNuovo.trim());
    setPinOk(true);
    setPinAttuale("");
    setPinNuovo("");
    setTimeout(() => { setPinOk(false); setShowPin(false); }, 1500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, maxHeight: "85vh", overflowY: "auto", background: C.surface, borderRadius: "16px 16px 0 0", padding: 20, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontSize: 18 }}>Il tuo profilo</div>
          <button onClick={onClose} aria-label="Chiudi" style={{ background: "none", border: "none", color: C.mutedFaint, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <label style={labelStyle}>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...inputStyle, marginTop: -8 }} />

        <label style={labelStyle}>Soprannome</label>
        <input value={soprannome} onChange={(e) => setSoprannome(e.target.value)} style={{ ...inputStyle, marginTop: -8 }} />

        {actionError && <div style={{ fontSize: 12, color: C.danger }}>Errore nel salvataggio ({actionError}).</div>}
        {savedMsg && <div style={{ fontSize: 12, color: C.flood }}>Salvato ✓</div>}

        <button disabled={busy} onClick={salvaProfiloClick} className="disp" style={{ padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>
          Salva profilo
        </button>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <button onClick={() => setShowPin((v) => !v)} className="disp" style={{ padding: "12px 0", width: "100%", borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <KeyRound size={15} /> Cambia PIN
          </button>

          {showPin && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <label style={labelStyle}>PIN attuale</label>
              <input type="password" inputMode="numeric" maxLength={4} value={pinAttuale} onChange={(e) => setPinAttuale(e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, marginTop: -6 }} />
              <label style={labelStyle}>Nuovo PIN (4 cifre)</label>
              <input type="password" inputMode="numeric" maxLength={4} value={pinNuovo} onChange={(e) => setPinNuovo(e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, marginTop: -6 }} />
              {pinErr && <div style={{ fontSize: 12, color: C.danger }}>{pinErr}</div>}
              {pinOk && <div style={{ fontSize: 12, color: C.flood }}>PIN aggiornato ✓</div>}
              <button disabled={busy} onClick={cambiaPinClick} className="disp" style={{ padding: "11px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.surface2, color: C.chalk, opacity: busy ? 0.6 : 1 }}>
                Conferma nuovo PIN
              </button>
            </div>
          )}
        </div>

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

function HomeTab({ squadre, colorePerSquadra, prenotazioni, titolariIds, contaTitolari, partita, currentUser, busy, actionError, toggleBooking, portaOspite }) {
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

      <PortaOspite busy={busy} currentUser={currentUser} onPorta={portaOspite} />

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Prenotati ({prenotazioni.length})</div>
        {prenotazioni.length === 0 ? (
          <div style={{ fontSize: 13, color: C.mutedFaint, padding: "16px 0" }}>Nessuno si è ancora prenotato per questa partita.</div>
        ) : (
          <ColonnePerSquadra squadre={squadre} colorePerSquadra={colorePerSquadra} prenotazioni={prenotazioni} titolariIds={titolariIds} />
        )}
      </div>
    </div>
  );
}

function PortaOspite({ busy, currentUser, onPorta }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) { setErr("Serve almeno un nome."); return; }
    setErr(null);
    await onPorta(nome.trim(), currentUser.id_squadra);
    setNome("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="disp" style={{ padding: "12px 0", borderRadius: 10, border: `1px dashed ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }}>
        + Porta un ospite
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.mutedFaint }}>Giocherà nella tua squadra, senza bisogno di un account.</div>
      <input autoFocus placeholder="Nome dell'ospite" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
      {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} className="disp" style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>Aggiungi</button>
        <button type="button" onClick={() => setOpen(false)} className="disp" style={{ padding: "11px 16px", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }}>Annulla</button>
      </div>
    </form>
  );
}

// Lista dei prenotati divisa in due colonne affiancate, una per squadra
function ColonnePerSquadra({ squadre, colorePerSquadra, prenotazioni, titolariIds }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {squadre.map((sq) => {
        const dellaSquadra = prenotazioni.filter((p) => p.id_squadra === sq.id);
        return (
          <div key={sq.id} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="disp" style={{ fontSize: 11, color: colorePerSquadra[sq.id], marginBottom: 2 }}>{sq.nome} ({dellaSquadra.length})</div>
            {dellaSquadra.length === 0 && <div style={{ fontSize: 12, color: C.mutedFaint }}>—</div>}
            {dellaSquadra.map((p) => {
              const titolare = titolariIds.has(p.id);
              const g = p.giocatori;
              const ospite = !g;
              return (
                <div key={p.id} style={{ padding: "8px 10px", background: C.surface, borderRadius: 10, border: ospite ? `1px dashed ${C.line}` : `1px solid ${C.line}`, opacity: titolare ? 1 : 0.55, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ospite ? p.nome_ospite : (g?.soprannome || g?.nome)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: C.mutedFaint }}>{ospite ? "OSPITE" : g?.ruolo}</span>
                    <span className="disp" style={{ fontSize: 9, color: titolare ? C.flood : C.mutedFaint }}>{titolare ? "TIT" : "RIS"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
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

function NuovoGiocatoreForm({ squadre, busy, onCrea }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [soprannome, setSoprannome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ruolo, setRuolo] = useState("CEN");
  const [forza, setForza] = useState(6);
  const [idSquadra, setIdSquadra] = useState(squadre[0]?.id || "");
  const [pin, setPin] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!nome.trim() || !telefono.trim()) {
      setErr("Nome e telefono sono obbligatori.");
      return;
    }
    try {
      await onCrea({
        nome: nome.trim(), soprannome: soprannome.trim() || null, telefono: telefono.trim(),
        ruolo, forza: Number(forza), id_squadra: Number(idSquadra), pin,
      });
      setOk(true);
      setNome(""); setSoprannome(""); setTelefono("");
      setPin(String(Math.floor(1000 + Math.random() * 9000)));
      setTimeout(() => setOk(false), 2000);
    } catch (e2) {
      setErr(e2.message);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="disp" style={{ padding: "13px 0", borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <UserPlus size={15} /> Aggiungi compagno
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div className="disp" style={{ fontSize: 13, color: C.mutedFaint }}>Nuovo compagno</div>
      <input placeholder="Nome e cognome" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
      <input placeholder="Soprannome (opzionale)" value={soprannome} onChange={(e) => setSoprannome(e.target.value)} style={inputStyle} />
      <input placeholder="Telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          {RUOLI.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="number" min={1} max={10} value={forza} onChange={(e) => setForza(e.target.value)} style={{ ...inputStyle, width: 70 }} />
        <select value={idSquadra} onChange={(e) => setIdSquadra(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          {squadre.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 11, color: C.mutedFaint }}>PIN iniziale: <span className="num" style={{ color: C.flood }}>{pin}</span> — comunicalo al giocatore, potrà cambiarlo dal suo profilo.</div>
      {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
      {ok && <div style={{ fontSize: 12, color: C.flood }}>Giocatore aggiunto ✓</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} className="disp" style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>Salva</button>
        <button type="button" onClick={() => setOpen(false)} className="disp" style={{ padding: "11px 16px", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }}>Annulla</button>
      </div>
    </form>
  );
}

function AdminTab({ giocatori, squadre, colorePerSquadra, prenotazioni, titolariIds, partita, currentUser, busy, actionError, aggiungiPresenza, rimuoviPresenza, spostaSquadra, creaGiocatore }) {
  const titolari = prenotazioni.filter((p) => titolariIds.has(p.id));
  const riserve = prenotazioni.filter((p) => !titolariIds.has(p.id));
  const nonPrenotati = useMemo(
    () => [...giocatori].filter((g) => !prenotazioni.some((p) => p.id_giocatore === g.id)).sort((a, b) => (a.soprannome || a.nome).localeCompare(b.soprannome || b.nome)),
    [giocatori, prenotazioni]
  );
  const [daAggiungere, setDaAggiungere] = useState(nonPrenotati[0]?.id || "");
  useEffect(() => {
    if (!nonPrenotati.some((g) => g.id === daAggiungere)) setDaAggiungere(nonPrenotati[0]?.id || "");
  }, [nonPrenotati]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {partita && (
        <div>
          <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Aggiungi presenza per un giocatore già censito</div>
          {nonPrenotati.length === 0 ? (
            <div style={{ fontSize: 12, color: C.mutedFaint }}>Sono già tutti prenotati.</div>
          ) : (
            <div style={{ display: "flex", gap: 8, position: "relative" }}>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={nonPrenotati.map((g) => ({ id: g.id, label: g.soprannome || g.nome }))}
                  value={daAggiungere}
                  onChange={setDaAggiungere}
                  placeholder="Cerca giocatore..."
                />
              </div>
              <button disabled={busy} onClick={() => aggiungiPresenza(Number(daAggiungere))} className="disp" style={{ padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", display: "flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
                <Plus size={16} /> Aggiungi
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Titolari ({titolari.length}/14)</div>
        {titolari.length === 0 && <div style={{ fontSize: 12, color: C.mutedFaint }}>Nessuno ancora.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {titolari.map((p) => {
            const g = p.giocatori;
            const ospite = !g;
            const altraSquadra = squadre.find((s) => s.id !== p.id_squadra);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.surface, borderRadius: 10, border: ospite ? `1px dashed ${C.line}` : `1px solid ${C.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: colorePerSquadra[p.id_squadra] }} />
                  <span style={{ fontSize: 14 }}>
                    {ospite ? p.nome_ospite : (g?.soprannome || g?.nome)}{" "}
                    <span style={{ color: C.mutedFaint, fontSize: 11 }}>{ospite ? "(ospite)" : `(${g?.ruolo} · ${g?.forza})`}</span>
                  </span>
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
              <span style={{ fontSize: 13, color: C.muted }}>{p.giocatori ? (p.giocatori.soprannome || p.giocatori.nome) : `${p.nome_ospite} (ospite)`}</span>
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

      <NuovoGiocatoreForm squadre={squadre} busy={busy} onCrea={creaGiocatore} />

      <button style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }} className="disp">
        + Nuova partita
      </button>
    </div>
  );
}

function AnagraficaLista({ giocatori, colorePerSquadra }) {
  const ordinati = useMemo(() => [...giocatori].sort((a, b) => (a.soprannome || a.nome).localeCompare(b.soprannome || b.nome)), [giocatori]);
  return (
    <div>
      <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Anagrafica giocatori ({ordinati.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ordinati.map((g) => (
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
