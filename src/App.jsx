import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ShieldCheck, Trophy, Users, Settings, ArrowLeftRight, Star, Flame, Anchor,
  AlertTriangle, X, LogOut, Plus, KeyRound, UserPlus, ChevronDown,
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

// Sezione richiudibile — usata in Admin per Titolari / Riserve / Anagrafica
function Collassabile({ titolo, defaultAperto = true, children }) {
  const [aperto, setAperto] = useState(defaultAperto);
  return (
    <div>
      <button onClick={() => setAperto((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: aperto ? 8 : 0 }}>
        <span className="disp" style={{ fontSize: 13, color: C.mutedFaint }}>{titolo}</span>
        <ChevronDown size={16} color={C.mutedFaint} style={{ transform: aperto ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {aperto && children}
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
  const [storico, setStorico] = useState([]);
  const [richiestePin, setRichiestePin] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(LOCAL_KEY) || null);
  const [showProfile, setShowProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [sq, gio, part, storicoData, richieste] = await Promise.all([
        sb("squadre?select=*"),
        sb("giocatori?select=*"),
        sb("partite?select=*&stato=eq.aperta&order=data_partita.asc&limit=1"),
        sb("partite?select=*&stato=in.(giocata,conclusa)&order=data_partita.desc&limit=50"),
        sb("richieste_pin?select=*,giocatori(*)&order=creato_il.desc&limit=50"),
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
      setStorico(storicoData);
      setRichiestePin(richieste);
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
      const risultato = await fn();
      await fetchAll();
      return risultato;
    } catch (e) {
      setActionError(e.message);
      return null;
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
      const riga = prenotazioni.find((p) => p.id === prenotazioneId);
      if (riga && !riga.id_giocatore) {
        // ospite: nessun account dietro, si può cancellare la riga per intero
        await sbWrite(`giocatori_partite?id=eq.${prenotazioneId}`, "DELETE");
      } else {
        // giocatore vero: si annulla mantenendo lo storico
        await sbWrite(`giocatori_partite?id=eq.${prenotazioneId}`, "PATCH", { flag_annullamento: true });
      }
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

  // Cambio squadra permanente in anagrafica (diverso dal prestito per una singola partita).
  // Se il numero di maglia entra in conflitto nella nuova squadra, lo azzera: andrà reimpostato.
  const spostaSquadraGiocatore = (idGiocatore, nuovaSquadraId) =>
    withBusy(async () => {
      const g = giocatori.find((x) => x.id === idGiocatore);
      const conflitto = g?.numero_maglia != null && giocatori.some(
        (x) => x.id !== idGiocatore && x.id_squadra === nuovaSquadraId && x.numero_maglia === g.numero_maglia
      );
      const patch = { id_squadra: nuovaSquadraId };
      if (conflitto) patch.numero_maglia = null;
      await sbWrite(`giocatori?id=eq.${idGiocatore}`, "PATCH", patch);
    });

  const chiudiPartita = (golPerSquadra, nuovaData) =>
    withBusy(async () => {
      await sbWrite(`partite?id=eq.${partita.id}`, "PATCH", {
        stato: "giocata",
        id_squadra_1: squadre[0].id,
        gol_squadra_1: golPerSquadra[squadre[0].id],
        id_squadra_2: squadre[1].id,
        gol_squadra_2: golPerSquadra[squadre[1].id],
      });
      await sbWrite("partite", "POST", {
        data_partita: nuovaData,
        stato: "aperta",
      });
    });

  // Titolari di una partita passata + eventuale voto MVP già espresso da chi è loggato
  const caricaDettaglioPartita = useCallback(async (idPartita) => {
    const righe = await sb(`giocatori_partite?select=*,giocatori(*)&id_partita=eq.${idPartita}&flag_annullamento=eq.false&order=data_prenotazione.asc`);
    const titolari = righe.slice(0, 14).filter((r) => r.id_giocatore); // solo giocatori veri, non ospiti
    const mioVoto = await sb(`voti_mvp?select=*&id_partita=eq.${idPartita}&id_votante=eq.${currentUser.id}`);
    return { titolari, mioVoto: mioVoto[0] || null };
  }, [currentUser]);

  const votaMvp = (idPartita, idGiocatore, idVotoEsistente) =>
    withBusy(async () => {
      if (idVotoEsistente) {
        await sbWrite(`voti_mvp?id=eq.${idVotoEsistente}`, "PATCH", { id_giocatore: idGiocatore });
      } else {
        await sbWrite("voti_mvp", "POST", { id_votante: currentUser.id, id_giocatore: idGiocatore, id_partita: idPartita });
      }
    });

  const salvaProfilo = (nome, soprannome, numeroMaglia) =>
    withBusy(async () => {
      await sbWrite(`giocatori?id=eq.${currentUser.id}`, "PATCH", { nome, soprannome, numero_maglia: numeroMaglia });
    });

  const cambiaPin = (nuovoPin) =>
    withBusy(async () => {
      await sbWrite(`giocatori?id=eq.${currentUser.id}`, "PATCH", { pin: nuovoPin });
    });

  const notificaTelegram = (testo) => {
    fetch("/api/notify-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: testo }),
    }).catch(() => {}); // best-effort: se fallisce (es. in locale, o non ancora configurato) non deve bloccare nulla
  };

  const richiediResetPin = (idGiocatore) =>
    withBusy(async () => {
      await sbWrite("richieste_pin", "POST", { id_giocatore: idGiocatore, stato: "aperta" });
      const g = giocatori.find((x) => x.id === idGiocatore);
      notificaTelegram(`⚽ ${g?.soprannome || g?.nome || "Qualcuno"} ha richiesto il reset del PIN`);
    });

  const generaNuovoPin = (idGiocatore, idRichiesta) =>
    withBusy(async () => {
      const nuovoPin = String(Math.floor(1000 + Math.random() * 9000));
      await sbWrite(`giocatori?id=eq.${idGiocatore}`, "PATCH", { pin: nuovoPin });
      await sbWrite(`richieste_pin?id=eq.${idRichiesta}`, "PATCH", { stato: "gestita" });
      const g = giocatori.find((x) => x.id === idGiocatore);
      notificaTelegram(`🔑 Nuovo PIN per ${g?.soprannome || g?.nome || "il giocatore"}: ${nuovoPin}`);
      return nuovoPin;
    });

  const creaGiocatore = (dati) =>
    withBusy(async () => {
      const usati = new Set(giocatori.filter((g) => g.id_squadra === dati.id_squadra).map((g) => g.numero_maglia).filter(Boolean));
      let numero;
      do { numero = Math.floor(Math.random() * 99) + 1; } while (usati.has(numero));
      await sbWrite("giocatori", "POST", { ...dati, is_admin: false, numero_maglia: numero });
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
            {tab === "home" ? (
              <>
                <div className="disp" style={{ fontSize: 26, marginTop: 2 }}>
                  {partita ? "Prossima partita" : loading ? "Carico..." : "Nessuna partita aperta"}
                </div>
                <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>
                  {partita ? new Date(partita.data_partita).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "\u00A0"}
                </div>
              </>
            ) : (
              <div className="disp" style={{ fontSize: 26, marginTop: 2 }}>
                {tab === "stats" ? "Statistiche" : "Admin"}
              </div>
            )}
          </div>
          {currentUser && (
            <button onClick={() => setShowProfile(true)} aria-label="Profilo" style={{
              width: 38, height: 38, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.line}`,
              color: C.flood, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, position: "relative",
            }} className="disp">
              {(currentUser.soprannome || currentUser.nome || "?").slice(0, 2).toUpperCase()}
              {currentUser.is_admin && richiestePin.some((r) => r.stato === "aperta") && (
                <span style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: C.danger, border: `2px solid ${C.bg}` }} />
              )}
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

          {showLoginGate && <LoginScreen giocatori={giocatori} onLogin={handleLogin} richiestePin={richiestePin} onRichiediReset={richiediResetPin} />}

          {!loading && !error && currentUser && (
            <>
              {tab === "home" && (
                <HomeTab
                  squadre={squadre} colorePerSquadra={colorePerSquadra} prenotazioni={prenotazioni}
                  titolariIds={titolariIds} contaTitolari={contaTitolari} partita={partita}
                  currentUser={currentUser} busy={busy} actionError={actionError} toggleBooking={toggleBooking}
                  portaOspite={portaOspite} giocatori={giocatori} aggiungiPresenza={aggiungiPresenza}
                  chiudiPartita={chiudiPartita}
                />
              )}
              {tab === "stats" && (
                <StatsTab
                  squadre={squadre} colorePerSquadra={colorePerSquadra} storico={storico}
                  currentUser={currentUser} busy={busy}
                  caricaDettaglioPartita={caricaDettaglioPartita} votaMvp={votaMvp}
                />
              )}
              {tab === "admin" && (
                <AdminTab
                  giocatori={giocatori} squadre={squadre} colorePerSquadra={colorePerSquadra}
                  prenotazioni={prenotazioni} titolariIds={titolariIds} partita={partita}
                  currentUser={currentUser} busy={busy} actionError={actionError}
                  rimuoviPresenza={rimuoviPresenza} spostaSquadra={spostaSquadra}
                  creaGiocatore={creaGiocatore} spostaSquadraGiocatore={spostaSquadraGiocatore}
                />
              )}
            </>
          )}
        </div>

        {currentUser && (
          <div style={{ position: "sticky", bottom: 0, display: "flex", background: C.surface, borderTop: `1px solid ${C.line}` }}>
            {TABS.filter((t) => t.id !== "admin" || currentUser.is_admin).map((t) => {
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
          <ProfileModal currentUser={currentUser} busy={busy} actionError={actionError} onSaveProfilo={salvaProfilo} onCambiaPin={cambiaPin} onLogout={handleLogout} onClose={() => setShowProfile(false)} richiestePin={richiestePin} onGeneraPin={generaNuovoPin} giocatori={giocatori} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
function LoginScreen({ giocatori, onLogin, richiestePin, onRichiediReset }) {
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
  const [richiestaInviata, setRichiestaInviata] = useState(false);

  const selectPlayer = (id) => {
    setSelId(id);
    localStorage.setItem(LAST_LOGIN_KEY, id);
    setRichiestaInviata(false);
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

  const richiestaGiaAperta = richiestePin.some((r) => r.stato === "aperta" && String(r.id_giocatore) === String(selId));

  const chiediReset = async () => {
    await onRichiediReset(Number(selId));
    setRichiestaInviata(true);
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

      {richiestaGiaAperta || richiestaInviata ? (
        <div style={{ fontSize: 12, color: C.mutedFaint, textAlign: "center" }}>Richiesta inviata — aspetta che un admin ti mandi il nuovo PIN.</div>
      ) : (
        <button type="button" onClick={chiediReset} className="disp" style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedFaint, fontSize: 12, textDecoration: "underline" }}>
          Hai dimenticato il PIN?
        </button>
      )}
    </form>
  );
}

function ProfileModal({ currentUser, busy, actionError, onSaveProfilo, onCambiaPin, onLogout, onClose, richiestePin, onGeneraPin, giocatori }) {
  const [nome, setNome] = useState(currentUser.nome || "");
  const [soprannome, setSoprannome] = useState(currentUser.soprannome || "");
  const [numeroMaglia, setNumeroMaglia] = useState(currentUser.numero_maglia != null ? String(currentUser.numero_maglia) : "");
  const [savedMsg, setSavedMsg] = useState(false);

  const conflittoMaglia = numeroMaglia !== "" && giocatori.find(
    (g) => g.id_squadra === currentUser.id_squadra && g.id !== currentUser.id && String(g.numero_maglia) === String(Number(numeroMaglia))
  );

  const [showPin, setShowPin] = useState(false);
  const [pinAttuale, setPinAttuale] = useState("");
  const [pinNuovo, setPinNuovo] = useState("");
  const [pinErr, setPinErr] = useState(null);
  const [pinOk, setPinOk] = useState(false);

  const [pinGenerati, setPinGenerati] = useState({}); // idRichiesta -> pin, resta visibile finché non chiudi il modale
  const [copiato, setCopiato] = useState(null);

  const richiesteAperte = richiestePin.filter((r) => r.stato === "aperta");
  const daMostrare = richiestePin.filter((r) => r.stato === "aperta" || pinGenerati[r.id]);

  const genera = async (r) => {
    const nuovoPin = await onGeneraPin(r.id_giocatore, r.id);
    if (nuovoPin) setPinGenerati((prev) => ({ ...prev, [r.id]: nuovoPin }));
  };

  const copia = (idRichiesta, pin) => {
    navigator.clipboard?.writeText(pin);
    setCopiato(idRichiesta);
    setTimeout(() => setCopiato(null), 1500);
  };

  const salvaProfiloClick = async () => {
    if (conflittoMaglia) return;
    await onSaveProfilo(nome, soprannome, numeroMaglia === "" ? null : Number(numeroMaglia));
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

        {currentUser.is_admin && daMostrare.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, background: C.surface2, borderRadius: 10, padding: 12 }}>
            <div className="disp" style={{ fontSize: 12, color: C.mutedFaint }}>Richieste reset PIN</div>
            {daMostrare.map((r) => {
              const nome = r.giocatori?.soprannome || r.giocatori?.nome || "Qualcuno";
              const pinGenerato = pinGenerati[r.id];
              return (
                <div key={r.id} style={{ fontSize: 13 }}>
                  {!pinGenerato ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span>{nome} ha richiesto il reset del PIN</span>
                      <button disabled={busy} onClick={() => genera(r)} className="disp" style={{ padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", fontSize: 10, flexShrink: 0, opacity: busy ? 0.6 : 1 }}>
                        Genera PIN
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span>Nuovo PIN per {nome}: <span className="num" style={{ color: C.flood }}>{pinGenerato}</span></span>
                      <button onClick={() => copia(r.id, pinGenerato)} className="disp" style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, fontSize: 10, flexShrink: 0 }}>
                        {copiato === r.id ? "Copiato ✓" : "Copia"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(pinGenerati).length > 0 && (
              <div style={{ fontSize: 10, color: C.mutedFaint }}>Invia il PIN a mano (es. WhatsApp) — non parte nessun messaggio automatico.</div>
            )}
          </div>
        )}

        <label style={labelStyle}>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...inputStyle, marginTop: -8 }} />

        <label style={labelStyle}>Soprannome</label>
        <input value={soprannome} onChange={(e) => setSoprannome(e.target.value)} style={{ ...inputStyle, marginTop: -8 }} />

        <label style={labelStyle}>Numero di maglia</label>
        <input type="number" min={1} max={99} inputMode="numeric" value={numeroMaglia} onChange={(e) => setNumeroMaglia(e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, marginTop: -8 }} />
        {conflittoMaglia && (
          <div style={{ fontSize: 12, color: C.danger, marginTop: -8 }}>
            Numero già in uso da {conflittoMaglia.soprannome || conflittoMaglia.nome}
          </div>
        )}

        {actionError && <div style={{ fontSize: 12, color: C.danger }}>Errore nel salvataggio ({actionError}).</div>}
        {savedMsg && <div style={{ fontSize: 12, color: C.flood }}>Salvato ✓</div>}

        <button disabled={busy || !!conflittoMaglia} onClick={salvaProfiloClick} className="disp" style={{ padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: (busy || conflittoMaglia) ? 0.6 : 1 }}>
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

function HomeTab({ squadre, colorePerSquadra, prenotazioni, titolariIds, contaTitolari, partita, currentUser, busy, actionError, toggleBooking, portaOspite, giocatori, aggiungiPresenza, chiudiPartita }) {
  const [panel, setPanel] = useState(null); // null | 'ospite' | 'compagno'

  if (!partita) {
    return <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 20px" }}>Nessuna partita con prenotazioni aperte al momento. Creane una dalla sezione Admin quando vuoi aprire il lunedì successivo.</div>;
  }
  const mia = prenotazioni.find((p) => p.id_giocatore === currentUser.id);
  const nonPrenotati = giocatori.filter((g) => !prenotazioni.some((p) => p.id_giocatore === g.id));

  const smallBtn = (active) => ({
    flex: 1, padding: "13px 4px", borderRadius: 10, cursor: "pointer", fontSize: 11,
    border: `1px ${active ? "solid" : "dashed"} ${C.line}`, background: active ? C.surface2 : "transparent", color: C.muted,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Scoreboard squadre={squadre} colorePerSquadra={colorePerSquadra} contaTitolari={contaTitolari} />

      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={busy} onClick={toggleBooking} style={{ flex: 1.3, padding: "13px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, background: mia ? "transparent" : C.flood, color: mia ? C.flood : "#12200F", border: `2px solid ${C.flood}`, opacity: busy ? 0.6 : 1 }} className="disp">
          {mia ? "✓ Presente" : "Ci sono!"}
        </button>
        <button onClick={() => setPanel(panel === "ospite" ? null : "ospite")} className="disp" style={smallBtn(panel === "ospite")}>+ Ospite</button>
        <button onClick={() => setPanel(panel === "compagno" ? null : "compagno")} className="disp" style={smallBtn(panel === "compagno")}>+ Compagno</button>
      </div>
      {mia && <div style={{ fontSize: 11, color: C.mutedFaint, textAlign: "center", marginTop: -12 }}>Tocca "Presente" per annullare</div>}
      {actionError && <div style={{ fontSize: 12, color: C.danger, textAlign: "center" }}>Errore ({actionError}) — probabile policy INSERT/UPDATE mancante su giocatori_partite.</div>}

      {panel === "ospite" && (
        <PortaOspiteForm busy={busy} currentUser={currentUser} onPorta={portaOspite} onClose={() => setPanel(null)} />
      )}
      {panel === "compagno" && (
        <PrenotaCompagnoForm busy={busy} nonPrenotati={nonPrenotati} onAggiungi={aggiungiPresenza} onClose={() => setPanel(null)} />
      )}

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Prenotati ({prenotazioni.length})</div>
        {prenotazioni.length === 0 ? (
          <div style={{ fontSize: 13, color: C.mutedFaint, padding: "16px 0" }}>Nessuno si è ancora prenotato per questa partita.</div>
        ) : (
          <ColonnePerSquadra squadre={squadre} colorePerSquadra={colorePerSquadra} prenotazioni={prenotazioni} titolariIds={titolariIds} />
        )}
      </div>

      {currentUser.is_admin && (
        <ChiudiPartita busy={busy} squadre={squadre} colorePerSquadra={colorePerSquadra} partita={partita} onChiudi={chiudiPartita} />
      )}
    </div>
  );
}

function PrenotaCompagnoForm({ busy, nonPrenotati, onAggiungi, onClose }) {
  const opzioni = useMemo(
    () => [...nonPrenotati].sort((a, b) => (a.soprannome || a.nome).localeCompare(b.soprannome || b.nome)).map((g) => ({ id: g.id, label: g.soprannome || g.nome })),
    [nonPrenotati]
  );
  const [sel, setSel] = useState(opzioni[0]?.id || "");

  useEffect(() => {
    if (!opzioni.some((o) => o.id === sel)) setSel(opzioni[0]?.id || "");
  }, [opzioni]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.mutedFaint }}>Per un giocatore già censito che non si è ancora prenotato da solo.</div>
      {opzioni.length === 0 ? (
        <div style={{ fontSize: 12, color: C.mutedFaint }}>Sono già tutti prenotati.</div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SearchableSelect options={opzioni} value={sel} onChange={setSel} placeholder="Cerca giocatore..." />
          </div>
          <button disabled={busy} onClick={async () => { await onAggiungi(Number(sel)); onClose(); }} className="disp" style={{ padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>
            Aggiungi
          </button>
        </div>
      )}
      <button onClick={onClose} className="disp" style={{ padding: "9px 0", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, fontSize: 11 }}>Annulla</button>
    </div>
  );
}

// Le prossime N date di lunedì successive a partire dalla data della partita corrente
function prossimiLunedi(dataPartitaStr, count = 8) {
  const base = new Date(`${dataPartitaStr}T00:00:00`);
  const out = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + 7 * i);
    out.push(d);
  }
  return out;
}
const toISODate = (d) => d.toISOString().slice(0, 10);

function ChiudiPartita({ busy, squadre, colorePerSquadra, partita, onChiudi }) {
  const [open, setOpen] = useState(false);
  const [gol1, setGol1] = useState("");
  const [gol2, setGol2] = useState("");
  const opzioniData = useMemo(() => prossimiLunedi(partita.data_partita), [partita.data_partita]);
  const [prossimaData, setProssimaData] = useState(() => toISODate(opzioniData[0]));
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (gol1 === "" || gol2 === "") { setErr("Inserisci il punteggio di entrambe le squadre."); return; }
    setErr(null);
    await onChiudi({ [squadre[0].id]: Number(gol1), [squadre[1].id]: Number(gol2) }, prossimaData);
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="disp" style={{ padding: "13px 0", borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }}>
        Chiudi partita e inserisci risultato
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div className="disp" style={{ fontSize: 13, color: C.mutedFaint }}>Risultato finale</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="disp" style={{ fontSize: 11, color: colorePerSquadra[squadre[0].id], marginBottom: 4 }}>{squadre[0].nome}</div>
          <input type="number" min={0} inputMode="numeric" value={gol1} onChange={(e) => setGol1(e.target.value)} style={inputStyle} />
        </div>
        <span className="disp" style={{ color: C.mutedFaint, marginTop: 16 }}>—</span>
        <div style={{ flex: 1 }}>
          <div className="disp" style={{ fontSize: 11, color: colorePerSquadra[squadre[1].id], marginBottom: 4 }}>{squadre[1].nome}</div>
          <input type="number" min={0} inputMode="numeric" value={gol2} onChange={(e) => setGol2(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <label style={labelStyle}>Prossima partita</label>
      <select value={prossimaData} onChange={(e) => setProssimaData(e.target.value)} style={{ ...inputStyle, marginTop: -6 }}>
        {opzioniData.map((d) => (
          <option key={toISODate(d)} value={toISODate(d)}>
            {d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </option>
        ))}
      </select>

      {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} className="disp" style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>Conferma</button>
        <button type="button" onClick={() => setOpen(false)} className="disp" style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }}>Annulla</button>
      </div>
    </form>
  );
}

function PortaOspiteForm({ busy, currentUser, onPorta, onClose }) {
  const [nome, setNome] = useState("");
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) { setErr("Serve almeno un nome."); return; }
    setErr(null);
    await onPorta(nome.trim(), currentUser.id_squadra);
    setNome("");
    onClose();
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.mutedFaint }}>Giocherà nella tua squadra, senza bisogno di un account.</div>
      <input autoFocus placeholder="Nome dell'ospite" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
      {err && <div style={{ fontSize: 12, color: C.danger }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} className="disp" style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", cursor: "pointer", background: C.flood, color: "#12200F", opacity: busy ? 0.6 : 1 }}>Aggiungi</button>
        <button type="button" onClick={onClose} className="disp" style={{ padding: "11px 16px", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }}>Annulla</button>
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
                  <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {!ospite && g?.numero_maglia != null && <span className="num" style={{ color: C.mutedFaint }}>#{g.numero_maglia} </span>}
                    {ospite ? p.nome_ospite : (g?.soprannome || g?.nome)}
                  </div>
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

const LOGO_SQUADRA = {
  "Real Madunin": "/logos/real-madunin.jpg",
  "Barcellotto": "/logos/barcellotto.jpg",
};

function StatsTab({ squadre, colorePerSquadra, storico, currentUser, busy, caricaDettaglioPartita, votaMvp }) {
  const [mostraTutti, setMostraTutti] = useState(false);
  const [partitaAperta, setPartitaAperta] = useState(null); // riga di `storico` selezionata

  const vittorie = useMemo(() => {
    const conteggio = {};
    squadre.forEach((s) => (conteggio[s.id] = 0));
    storico.forEach((p) => {
      if (p.gol_squadra_1 == null || p.gol_squadra_2 == null) return;
      if (p.gol_squadra_1 > p.gol_squadra_2) conteggio[p.id_squadra_1] = (conteggio[p.id_squadra_1] || 0) + 1;
      else if (p.gol_squadra_2 > p.gol_squadra_1) conteggio[p.id_squadra_2] = (conteggio[p.id_squadra_2] || 0) + 1;
    });
    return conteggio;
  }, [storico, squadre]);

  const daMostrare = mostraTutti ? storico : storico.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: C.surface, borderRadius: 14, padding: "20px 16px", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {squadre.map((sq) => (
          <div key={sq.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {LOGO_SQUADRA[sq.nome] ? (
              <img src={LOGO_SQUADRA[sq.nome]} alt={sq.nome} style={{ width: 56, height: 56, objectFit: "contain" }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: colorePerSquadra[sq.id] }} />
            )}
            <div className="num" style={{ fontSize: 32, lineHeight: 1 }}>{vittorie[sq.id] || 0}</div>
            <div className="disp" style={{ fontSize: 11, color: colorePerSquadra[sq.id] }}>{sq.nome}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="disp" style={{ fontSize: 13, color: C.mutedFaint, marginBottom: 8 }}>Ultimi risultati</div>
        {storico.length === 0 ? (
          <div style={{ fontSize: 13, color: C.mutedFaint }}>Nessuna partita giocata ancora.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {daMostrare.map((p) => {
                const sq1 = squadre.find((s) => s.id === p.id_squadra_1);
                const sq2 = squadre.find((s) => s.id === p.id_squadra_2);
                return (
                  <button key={p.id} onClick={() => setPartitaAperta(p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 12, color: C.mutedFaint }}>{new Date(p.data_partita).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
                    <span className="num" style={{ fontSize: 15 }}>
                      <span style={{ color: sq1 ? colorePerSquadra[sq1.id] : C.chalk }}>{p.gol_squadra_1}</span>
                      {" — "}
                      <span style={{ color: sq2 ? colorePerSquadra[sq2.id] : C.chalk }}>{p.gol_squadra_2}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {storico.length > 3 && (
              <button onClick={() => setMostraTutti((v) => !v)} className="disp" style={{ marginTop: 8, padding: "9px 0", width: "100%", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, fontSize: 11 }}>
                {mostraTutti ? "Mostra meno" : "Vedi tutti"}
              </button>
            )}
          </>
        )}
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
        <div style={{ fontSize: 11, color: C.mutedFaint, fontStyle: "italic", marginTop: 8 }}>Ancora di esempio — li calcoleremo dai dati reali più avanti.</div>
      </div>

      {partitaAperta && (
        <DettaglioPartitaModal
          partita={partitaAperta} squadre={squadre} colorePerSquadra={colorePerSquadra}
          currentUser={currentUser} busy={busy}
          caricaDettaglioPartita={caricaDettaglioPartita} votaMvp={votaMvp}
          onClose={() => setPartitaAperta(null)}
        />
      )}
    </div>
  );
}

function DettaglioPartitaModal({ partita, squadre, colorePerSquadra, currentUser, busy, caricaDettaglioPartita, votaMvp, onClose }) {
  const [titolari, setTitolari] = useState(null);
  const [mioVoto, setMioVoto] = useState(null);
  const [votando, setVotando] = useState(false);

  const ricarica = useCallback(async () => {
    const { titolari: t, mioVoto: v } = await caricaDettaglioPartita(partita.id);
    setTitolari(t);
    setMioVoto(v);
  }, [caricaDettaglioPartita, partita.id]);

  useEffect(() => { ricarica(); }, [ricarica]);

  const sq1 = squadre.find((s) => s.id === partita.id_squadra_1);
  const sq2 = squadre.find((s) => s.id === partita.id_squadra_2);

  const scegli = async (idGiocatore) => {
    await votaMvp(partita.id, idGiocatore, mioVoto?.id);
    await ricarica();
    setVotando(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, maxHeight: "85vh", overflowY: "auto", background: C.surface, borderRadius: "16px 16px 0 0", padding: 20, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="disp" style={{ fontSize: 16 }}>{new Date(partita.data_partita).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</div>
          <button onClick={onClose} aria-label="Chiudi" style={{ background: "none", border: "none", color: C.mutedFaint, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
          <span className="disp" style={{ color: sq1 ? colorePerSquadra[sq1.id] : C.chalk, fontSize: 13 }}>{sq1?.nome}</span>
          <span className="num" style={{ fontSize: 26 }}>{partita.gol_squadra_1} — {partita.gol_squadra_2}</span>
          <span className="disp" style={{ color: sq2 ? colorePerSquadra[sq2.id] : C.chalk, fontSize: 13 }}>{sq2?.nome}</span>
        </div>

        {titolari === null ? (
          <div style={{ fontSize: 13, color: C.mutedFaint, textAlign: "center" }}>Carico i giocatori…</div>
        ) : (
          <>
            {mioVoto && !votando && (
              <div style={{ fontSize: 12, color: C.flood, textAlign: "center" }}>
                Hai votato: {titolari.find((t) => t.id_giocatore === mioVoto.id_giocatore)?.giocatori?.soprannome || "—"}
              </div>
            )}

            {!votando ? (
              <button onClick={() => setVotando(true)} className="disp" style={{ padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer", background: C.flood, color: "#12200F" }}>
                {mioVoto ? "Cambia voto MVP" : "Vota MVP"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...titolari].sort((a, b) => (a.giocatori.soprannome || a.giocatori.nome).localeCompare(b.giocatori.soprannome || b.giocatori.nome)).map((t) => {
                  const selezionato = mioVoto?.id_giocatore === t.id_giocatore;
                  return (
                    <button key={t.id} disabled={busy} onClick={() => scegli(t.id_giocatore)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: selezionato ? C.surface2 : "transparent", border: `1px solid ${selezionato ? C.flood : C.line}`, color: C.chalk,
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: colorePerSquadra[t.id_squadra] }} />
                        {t.giocatori.soprannome || t.giocatori.nome}
                      </span>
                      {selezionato && <span style={{ color: C.flood }}>✓</span>}
                    </button>
                  );
                })}
                <button onClick={() => setVotando(false)} className="disp" style={{ marginTop: 4, padding: "9px 0", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted, fontSize: 11 }}>Annulla</button>
              </div>
            )}
          </>
        )}
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
  const pin = "1234";
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

// ------------------------------------------------------------------
// Suggerisci formazione: assegna ruoli in campo con le regole di fallback
// (manca un attaccante -> prendi un centrocampista; manca un centrocampista
// -> prendi un difensore; manca il portiere -> prendi un difensore)
// ------------------------------------------------------------------
function assegnaFormazione(giocatoriSquadra) {
  const pool = [...giocatoriSquadra];
  const prendi = (ruolo) => {
    const idx = pool.findIndex((g) => g.ruolo === ruolo);
    if (idx === -1) return null;
    return pool.splice(idx, 1)[0];
  };

  const ass = { POR: [], DIF: [], CEN: [], ATT: [] };
  const target = { POR: 1, DIF: 3, CEN: 2, ATT: 1 };

  Object.entries(target).forEach(([ruolo, n]) => {
    for (let i = 0; i < n; i++) {
      const g = prendi(ruolo);
      if (g) ass[ruolo].push(g);
    }
  });

  while (ass.ATT.length < target.ATT) { const g = prendi("CEN"); if (!g) break; ass.ATT.push(g); }
  while (ass.CEN.length < target.CEN) { const g = prendi("DIF"); if (!g) break; ass.CEN.push(g); }
  while (ass.POR.length < target.POR) { const g = prendi("DIF"); if (!g) break; ass.POR.push(g); }
  while (ass.DIF.length < target.DIF && pool.length > 0) { ass.DIF.push(pool.shift()); }
  ["POR", "CEN", "ATT"].forEach((ruolo) => {
    while (ass[ruolo].length < target[ruolo] && pool.length > 0) ass[ruolo].push(pool.shift());
  });

  return ass;
}

function distribuisciX(n, centro = 190, ampiezza = 110) {
  if (n <= 0) return [];
  if (n === 1) return [centro];
  const step = (ampiezza * 2) / (n - 1);
  return Array.from({ length: n }, (_, i) => centro - ampiezza + i * step);
}

function CampoFormazione({ basso, alto, colorePerSquadra }) {
  const W = 380, H = 560;
  const yBasso = { POR: 522, DIF: 424, CEN: 322, ATT: 226 };
  const yAlto = { POR: 38, DIF: 136, CEN: 238, ATT: 334 };
  const etichetta = { POR: "P", DIF: "D", CEN: "CEN", ATT: "ATT" };

  const renderRuolo = (arr, y, colore, idSquadra) => {
    const xs = distribuisciX(arr.length);
    return arr.map((g, i) => (
      <g key={`${idSquadra}-${g.id}`} transform={`translate(${xs[i]},${y})`}>
        <circle r="17" fill={colore} stroke="#0E1F17" strokeWidth="2" />
        <text textAnchor="middle" dy="5" fontSize="13" fontWeight="700" fill="#0E1F17" fontFamily="'Oswald', sans-serif">{g.numero_maglia ?? "-"}</text>
        <text textAnchor="middle" y="31" fontSize="10.5" fill="#F3F1E7" fontFamily="'Work Sans', sans-serif">{g.soprannome || g.nome}</text>
      </g>
    ));
  };

  const renderEtichette = (y, allineaDx) => (
    <>
      {Object.entries(y).map(([ruolo, yy]) => (
        <text key={ruolo} x={allineaDx ? W - 10 : 10} y={yy + 5} textAnchor={allineaDx ? "end" : "start"} fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="'Oswald', sans-serif">
          {etichetta[ruolo]}
        </text>
      ))}
    </>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", borderRadius: 12, display: "block" }}>
      <rect width={W} height={H} fill="#1a5c33" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x="0" y={i * (H / 7)} width={W} height={H / 7} fill={i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"} />
      ))}
      <rect x="6" y="6" width={W - 12} height={H - 12} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <line x1="6" y1={H / 2} x2={W - 6} y2={H / 2} stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <circle cx={W / 2} cy={H / 2} r="48" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <circle cx={W / 2} cy={H / 2} r="3" fill="rgba(255,255,255,0.55)" />
      <rect x={W / 2 - 66} y={H - 66} width="132" height="60" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <rect x={W / 2 - 28} y={H - 24} width="56" height="18" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <rect x={W / 2 - 66} y="6" width="132" height="60" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <rect x={W / 2 - 28} y="6" width="56" height="18" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />

      {renderEtichette(yBasso, false)}
      {renderEtichette(yAlto, true)}

      {renderRuolo(basso.ass.POR, yBasso.POR, colorePerSquadra[basso.id], basso.id)}
      {renderRuolo(basso.ass.DIF, yBasso.DIF, colorePerSquadra[basso.id], basso.id)}
      {renderRuolo(basso.ass.CEN, yBasso.CEN, colorePerSquadra[basso.id], basso.id)}
      {renderRuolo(basso.ass.ATT, yBasso.ATT, colorePerSquadra[basso.id], basso.id)}

      {renderRuolo(alto.ass.POR, yAlto.POR, colorePerSquadra[alto.id], alto.id)}
      {renderRuolo(alto.ass.DIF, yAlto.DIF, colorePerSquadra[alto.id], alto.id)}
      {renderRuolo(alto.ass.CEN, yAlto.CEN, colorePerSquadra[alto.id], alto.id)}
      {renderRuolo(alto.ass.ATT, yAlto.ATT, colorePerSquadra[alto.id], alto.id)}
    </svg>
  );
}

function SuggerisciFormazione({ prenotazioni, titolariIds, squadre, colorePerSquadra }) {
  const [aperto, setAperto] = useState(false);

  const mappaGiocatore = (p) => p.giocatori
    ? { id: p.giocatori.id, nome: p.giocatori.nome, soprannome: p.giocatori.soprannome, ruolo: p.giocatori.ruolo, numero_maglia: p.giocatori.numero_maglia }
    : { id: `ospite-${p.id}`, nome: p.nome_ospite, soprannome: p.nome_ospite, ruolo: null, numero_maglia: null };

  const datiSquadra = (sq) => {
    const titolari = prenotazioni.filter((p) => p.id_squadra === sq.id && titolariIds.has(p.id)).map(mappaGiocatore);
    return { id: sq.id, nome: sq.nome, ass: assegnaFormazione(titolari) };
  };

  return (
    <div>
      <button onClick={() => setAperto((v) => !v)} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer", background: C.surface2, color: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} className="disp">
        <ShieldCheck size={18} /> {aperto ? "Nascondi formazione" : "Suggerisci formazione"}
      </button>

      {aperto && squadre.length === 2 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 6px" }}>
            <span className="disp" style={{ fontSize: 12, color: colorePerSquadra[squadre[1].id] }}>{squadre[1].nome}</span>
            <span className="disp" style={{ fontSize: 12, color: colorePerSquadra[squadre[0].id] }}>{squadre[0].nome}</span>
          </div>
          <CampoFormazione basso={datiSquadra(squadre[0])} alto={datiSquadra(squadre[1])} colorePerSquadra={colorePerSquadra} />
          <div style={{ fontSize: 11, color: C.mutedFaint, marginTop: 8 }}>
            Proposta automatica in base ai ruoli dichiarati — se manca un ruolo, viene ripiegato sul più vicino (attaccante → centrocampista → difensore; portiere → difensore). Gli ospiti (senza ruolo dichiarato) riempiono gli ultimi posti liberi.
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTab({ giocatori, squadre, colorePerSquadra, prenotazioni, titolariIds, partita, currentUser, busy, actionError, rimuoviPresenza, spostaSquadra, creaGiocatore, spostaSquadraGiocatore }) {
  const titolari = prenotazioni.filter((p) => titolariIds.has(p.id));
  const riserve = prenotazioni.filter((p) => !titolariIds.has(p.id));

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
      {actionError && <div style={{ fontSize: 12, color: C.danger }}>Errore ({actionError}) — controlla le policy INSERT/UPDATE su giocatori_partite.</div>}

      <Collassabile titolo="Gestisci Prossima Partita">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SuggerisciFormazione prenotazioni={prenotazioni} titolariIds={titolariIds} squadre={squadre} colorePerSquadra={colorePerSquadra} />

          <Collassabile titolo={`Titolari (${titolari.length}/14)`}>
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
          </Collassabile>

          <Collassabile titolo={`Riserve (${riserve.length})`}>
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
          </Collassabile>
        </div>
      </Collassabile>

      <AnagraficaLista giocatori={giocatori} colorePerSquadra={colorePerSquadra} squadre={squadre} busy={busy} onSpostaSquadra={spostaSquadraGiocatore} actionError={actionError} />

      <NuovoGiocatoreForm squadre={squadre} busy={busy} onCrea={creaGiocatore} />

      <button style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: C.muted }} className="disp">
        + Nuova partita
      </button>
    </div>
  );
}

function AnagraficaLista({ giocatori, colorePerSquadra, squadre, busy, onSpostaSquadra, actionError }) {
  const ordinati = useMemo(() => [...giocatori].sort((a, b) => (a.soprannome || a.nome).localeCompare(b.soprannome || b.nome)), [giocatori]);
  return (
    <Collassabile titolo={`Anagrafica Giocatori (${ordinati.length})`} defaultAperto={false}>
      {onSpostaSquadra && actionError && (
        <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>Errore ({actionError}) — probabile policy mancante su "giocatori" (UPDATE).</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ordinati.map((g) => {
          const altraSquadra = squadre?.find((s) => s.id !== g.id_squadra);
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.surface, borderRadius: 10, border: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: colorePerSquadra[g.id_squadra] }} />
                <span style={{ fontSize: 14 }}>
                  {g.numero_maglia != null && <span className="num" style={{ color: C.mutedFaint }}>#{g.numero_maglia} </span>}
                  {g.soprannome || g.nome} <span style={{ color: C.mutedFaint, fontSize: 11 }}>({g.ruolo} · {g.forza})</span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {g.is_admin && <span className="disp" style={{ fontSize: 9, color: C.flood }}>ADMIN</span>}
                {onSpostaSquadra && altraSquadra && (
                  <button
                    disabled={busy}
                    onClick={() => onSpostaSquadra(g.id, altraSquadra.id)}
                    aria-label={`Sposta in ${altraSquadra.nome}`}
                    title={`Sposta in ${altraSquadra.nome}`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedFaint, padding: 4 }}
                  >
                    <ArrowLeftRight size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Collassabile>
  );
}
