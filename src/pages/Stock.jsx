import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiFileText, FiRefreshCw, FiPlus, FiCheckCircle } from "react-icons/fi";

const TOTAL_DEFAULT = 2000;

const HOURS = [
  { start: "08:00", end: "09:00" },
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "12:00", end: "13:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
  { start: "17:00", end: "18:00" },
  { start: "18:00", end: "19:00" },
  { start: "19:00", end: "20:00" },
];

export default function Stock() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [tickets, setTickets] = useState([]); // {ticket_num:number, creneau_id:string|null}
  const [creneaux, setCreneaux] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Création créneau
  const [jour, setJour] = useState(1);
  const [date, setDate] = useState("");
  const [hourIndex, setHourIndex] = useState(0);

  // sélection tickets
  const [selected, setSelected] = useState(new Set()); // Set<number>
  const selectedCount = selected.size;

  const [assignCreneauId, setAssignCreneauId] = useState("");

  // message UI
  const [info, setInfo] = useState(""); // ex: "Ticket déjà attribué"
  function flashInfo(msg) {
    setInfo(msg);
    window.clearTimeout(flashInfo._t);
    flashInfo._t = window.setTimeout(() => setInfo(""), 2000);
  }

  const selectedNums = useMemo(
    () => Array.from(selected).sort((a, b) => a - b),
    [selected]
  );

  async function loadTickets() {
    setLoading(true);

    // ✅ Source de vérité = v_tickets_stock (ticket_num + creneau_id)
    const { data, error } = await supabase
      .from("v_tickets_stock")
      .select("ticket_num, creneau_id")
      .order("ticket_num", { ascending: true });

    setLoading(false);

    if (error) {
      showNotification("Erreur tickets: " + error.message, "error");
      return;
    }

    // IMPORTANT: cast ticket_num en Number pour éviter bug string/number
    const norm = (data ?? []).map((t) => ({
      ticket_num: Number(t.ticket_num),
      creneau_id: t.creneau_id ?? null,
    }));

    setTickets(norm);
  }

  async function loadCreneaux() {
    const { data, error } = await supabase
      .from("creneaux_horaires")
      .select("id, date, jour, heure_debut, heure_fin")
      .order("date", { ascending: true })
      .order("heure_debut", { ascending: true });

    if (error) {
      showNotification("Erreur créneaux: " + error.message, "error");
      return;
    }

    setCreneaux(data ?? []);
    if (!assignCreneauId && data?.length) setAssignCreneauId(data[0].id);
  }

  useEffect(() => {
    setSelected(new Set());
    loadTickets();
    loadCreneaux();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initStock() {
    setBusy(true);

    const { error } = await supabase.rpc("init_ticket_stock", {
      p_total: TOTAL_DEFAULT,
    });

    setBusy(false);

    if (error) {
      showNotification("Erreur init stock: " + error.message, "error");
      return;
    }

    await loadTickets();
    flashInfo(`Stock initialisé (${TOTAL_DEFAULT} tickets) ✅`);
  }

  async function createCreneau() {
    if (!date) return showNotification("Choisis une date.", "error");
    const h = HOURS[hourIndex];

    setBusy(true);

    const { data, error } = await supabase
      .from("creneaux_horaires")
      .insert({
        date,
        jour,
        heure_debut: h.start,
        heure_fin: h.end,
        // capacité réelle = tickets assignés, on laisse 0 si colonne existe
        capacite_max: 0,
      })
      .select("id")
      .single();

    setBusy(false);

    if (error) {
      showNotification("Erreur création créneau: " + error.message, "error");
      return;
    }

    await loadCreneaux();
    setAssignCreneauId(data.id);
    flashInfo("Créneau créé ✅");
  }

  // ✅ Map ticket_num -> creneau_id (null si libre)
  const ticketMap = useMemo(() => {
    const m = new Map();
    for (const t of tickets) m.set(Number(t.ticket_num), t.creneau_id || null);
    return m;
  }, [tickets]);

  // ✅ Set des tickets déjà attribués (creneau_id non null)
  const assignedSet = useMemo(() => {
    const s = new Set();
    for (const t of tickets) {
      if (t.creneau_id) s.add(Number(t.ticket_num));
    }
    return s;
  }, [tickets]);

  const totalTickets = tickets.length || TOTAL_DEFAULT;

  function toggleTicket(n) {
    const num = Number(n);

    // ✅ bloquer si déjà attribué
    if (assignedSet.has(num)) {
      flashInfo(`Ticket ${num} déjà attribué ❌`);
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  function selectRange(from, to) {
    const a = Math.min(from, to);
    const b = Math.max(from, to);

    let blocked = 0;

    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = a; i <= b; i++) {
        const num = Number(i);
        if (assignedSet.has(num)) blocked++;
        else next.add(num);
      }
      return next;
    });

    if (blocked > 0) {
      flashInfo(`${blocked} ticket(s) déjà attribué(s), ignorés.`);
    }
  }

  async function assignSelected() {
    if (!assignCreneauId) return showNotification("Choisis un créneau.", "error");
    if (selectedCount === 0) return showNotification("Sélectionne des tickets.", "error");

    // sécurité côté front : re-check avant envoi
    const forbidden = selectedNums.filter((n) => assignedSet.has(Number(n)));
    if (forbidden.length > 0) {
      flashInfo(
        `Tickets déjà attribués détectés (${forbidden.slice(0, 10).join(", ")}${
          forbidden.length > 10 ? "…" : ""
        })`
      );
      // on les retire de la sélection
      setSelected((prev) => {
        const next = new Set(prev);
        forbidden.forEach((n) => next.delete(Number(n)));
        return next;
      });
      return;
    }

    setBusy(true);

    const { error } = await supabase.rpc("assign_tickets_to_creneau", {
      p_creneau_id: assignCreneauId,
      p_ticket_nums: selectedNums,
    });

    setBusy(false);

    if (error) {
      showNotification("Erreur attribution tickets: " + error.message, "error");
      return;
    }

    setSelected(new Set());
    await loadTickets();
    flashInfo("Tickets attribués ✅");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <FiFileText className="text-3xl text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Stock Tickets</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Gérer les tickets et les attribuer aux créneaux
          </p>
        </div>
      </div>

      {/* Message */}
      {info && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
          {info}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Actions rapides</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              <b className="text-indigo-600 dark:text-indigo-400">{selectedCount}</b> ticket(s) sélectionné(s)
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
              onClick={initStock}
              disabled={busy}
            >
              <FiPlus className="text-sm" />
              <span>Init {TOTAL_DEFAULT}</span>
            </button>
            <button
              className="bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
              onClick={() => {
                setSelected(new Set());
                loadTickets();
              }}
              disabled={busy}
            >
              <FiRefreshCw className={`text-sm ${busy ? 'animate-spin' : ''}`} />
              <span>Rafraîchir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create creneau + assign */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FiPlus className="text-indigo-600 dark:text-indigo-400" />
          Créer et attribuer un créneau
        </h2>

        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs opacity-70 mb-1 text-slate-600 dark:text-slate-400">Date</div>
            <input
              type="date"
              className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs opacity-70 mb-1 text-slate-600 dark:text-slate-400">Jour</div>
            <select
              className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
              value={jour}
              onChange={(e) => setJour(Number(e.target.value))}
            >
              <option value={1}>Jour 1</option>
              <option value={2}>Jour 2</option>
              <option value={3}>Jour 3</option>
            </select>
          </div>

          <div>
            <div className="text-xs opacity-70 mb-1 text-slate-600 dark:text-slate-400">Horaire</div>
            <select
              className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
              value={hourIndex}
              onChange={(e) => setHourIndex(Number(e.target.value))}
            >
              {HOURS.map((h, idx) => (
                <option key={idx} value={idx}>
                  {h.start} → {h.end}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 w-full flex items-center justify-center gap-2"
              onClick={createCreneau}
              disabled={busy}
            >
              <FiPlus className="text-sm" />
              <span>Créer</span>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-100">Attribuer au créneau</div>
          <div className="grid md:grid-cols-2 gap-3">
            <select
              className="px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
              value={assignCreneauId}
              onChange={(e) => setAssignCreneauId(e.target.value)}
            >
              <option value="">— Choisir un créneau —</option>
              {creneaux.map((c) => (
                <option key={c.id} value={c.id}>
                  Jour {c.jour ?? "?"} — {c.date} — {String(c.heure_debut).slice(0, 5)}→{String(c.heure_fin).slice(0, 5)}
                </option>
              ))}
            </select>

            <button
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={assignSelected}
              disabled={busy || !assignCreneauId || selectedCount === 0}
            >
              <FiCheckCircle className="text-sm" />
              <span>Attribuer {selectedCount} ticket(s)</span>
            </button>
          </div>
        </div>

        {/* Quick range selection */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            onClick={() => selectRange(1, 70)}
          >
            Select 1–70
          </button>
          <button
            className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            onClick={() => selectRange(71, 140)}
          >
            Select 71–140
          </button>
          <button
            className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Tickets grid */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tickets ({totalTickets})</h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Gris = déjà attribué (non sélectionnable)
          </div>
        </div>

        <div className="grid grid-cols-10 md:grid-cols-20 gap-2">
          {Array.from({ length: totalTickets }).map((_, i) => {
            const n = i + 1;
            const assigned = assignedSet.has(n);
            const isSel = selected.has(n);
            const assignedTo = ticketMap.get(n);

            return (
              <button
                key={n}
                onClick={() => toggleTicket(n)}
                disabled={assigned}
                className={[
                  "border-2 rounded-lg py-2 text-xs font-medium transition-all",
                  isSel 
                    ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold" 
                    : assigned
                    ? "bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                    : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
                ].join(" ")}
                title={
                  assigned
                    ? `Ticket déjà attribué (créneau: ${String(assignedTo).slice(0, 8)}…)`
                    : "Libre - Cliquer pour sélectionner"
                }
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
