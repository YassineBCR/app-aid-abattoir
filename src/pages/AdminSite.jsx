import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiClock, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiX } from "react-icons/fi";

export default function AdminSite() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(false);

  // création
  const [date, setDate] = useState("");
  const [jour, setJour] = useState(1);
  const [heureDebut, setHeureDebut] = useState("08:00");
  const [heureFin, setHeureFin] = useState("09:00");
  const [saving, setSaving] = useState(false);

  // édition
  const [editing, setEditing] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editJour, setEditJour] = useState(1);
  const [editHeureDebut, setEditHeureDebut] = useState("");
  const [editHeureFin, setEditHeureFin] = useState("");
  const [updating, setUpdating] = useState(false);

  async function fetchCreneaux() {
    setLoading(true);

    const { data, error } = await supabase
      .from("creneaux_horaires")
      .select("id, date, jour, heure_debut, heure_fin, created_at")
      .order("date", { ascending: true })
      .order("heure_debut", { ascending: true });

    setLoading(false);

    if (error) return showNotification("Erreur chargement créneaux: " + error.message, "error");
    setCreneaux(data ?? []);
  }

  useEffect(() => {
    fetchCreneaux();
  }, []);

  async function addCreneau(e) {
    e.preventDefault();
    if (!date) return showNotification("Date obligatoire", "error");
    if (!heureDebut) return showNotification("Heure début obligatoire", "error");
    if (!heureFin) return showNotification("Heure fin obligatoire", "error");

    setSaving(true);

    const { error } = await supabase.from("creneaux_horaires").insert({
      date,
      jour,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      // si ta colonne capacite_max existe, on la laisse à 0 (source de vérité = tickets assignés)
      capacite_max: 0,
    });

    setSaving(false);

    if (error) return showNotification("Erreur création créneau: " + error.message, "error");

    setHeureDebut("08:00");
    setHeureFin("09:00");
    await fetchCreneaux();
  }

  function startEdit(c) {
    setEditing(c);
    setEditDate(c.date);
    setEditJour(c.jour ?? 1);
    setEditHeureDebut(String(c.heure_debut).slice(0, 5));
    setEditHeureFin(String(c.heure_fin).slice(0, 5));
  }

  function cancelEdit() {
    setEditing(null);
    setEditDate("");
    setEditJour(1);
    setEditHeureDebut("");
    setEditHeureFin("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing?.id) return;

    if (!editDate) return showNotification("Date obligatoire", "error");
    if (!editHeureDebut) return showNotification("Heure début obligatoire", "error");
    if (!editHeureFin) return showNotification("Heure fin obligatoire", "error");

    setUpdating(true);

    const { error } = await supabase
      .from("creneaux_horaires")
      .update({
        date: editDate,
        jour: editJour,
        heure_debut: editHeureDebut,
        heure_fin: editHeureFin,
      })
      .eq("id", editing.id);

    setUpdating(false);

    if (error) return showNotification("Erreur mise à jour: " + error.message, "error");

    cancelEdit();
    await fetchCreneaux();
  }

  async function deleteCreneau(id) {
    const confirmed = await showConfirm("Supprimer ce créneau ?");
    if (!confirmed) return;
    const { error } = await supabase.from("creneaux_horaires").delete().eq("id", id);
    if (error) return showNotification("Erreur suppression: " + error.message, "error");
    await fetchCreneaux();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 safe-y safe-x animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center gap-3">
          <FiClock className="text-3xl text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Admin — Créneaux</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Créer, modifier et supprimer des créneaux
            </p>
          </div>
        </div>

        {/* Création */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FiPlus className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Créer un créneau</h2>
          </div>
          <form onSubmit={addCreneau} className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Date</div>
              <input
                type="date"
                className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Jour</div>
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

            <div className="space-y-1">
              <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Heure début</div>
              <input
                type="time"
                className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Heure fin</div>
              <input
                type="time"
                className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
              />
            </div>
          </div>

            <button 
              disabled={saving} 
              type="submit"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiPlus className="text-lg" />
              <span>{saving ? "Création…" : "Ajouter le créneau"}</span>
            </button>
          </form>
        </div>

        {/* Édition */}
        {editing && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiEdit2 className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Modifier le créneau</h2>
              </div>
              <button 
                onClick={cancelEdit} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Date</div>
                  <input
                    type="date"
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Jour</div>
                  <select
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                    value={editJour}
                    onChange={(e) => setEditJour(Number(e.target.value))}
                  >
                    <option value={1}>Jour 1</option>
                    <option value={2}>Jour 2</option>
                    <option value={3}>Jour 3</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Heure début</div>
                  <input
                    type="time"
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                    value={editHeureDebut}
                    onChange={(e) => setEditHeureDebut(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs opacity-70 text-slate-600 dark:text-slate-400">Heure fin</div>
                  <input
                    type="time"
                    className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl p-3 w-full"
                    value={editHeureFin}
                    onChange={(e) => setEditHeureFin(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  disabled={updating} 
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FiEdit2 className="text-lg" />
                  <span>{updating ? "Sauvegarde…" : "Enregistrer"}</span>
                </button>
                <button 
                  type="button" 
                  onClick={cancelEdit} 
                  className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 px-5 py-3 rounded-xl font-semibold transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Liste des créneaux</h2>
            <button 
              onClick={fetchCreneaux} 
              disabled={loading}
              className="bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <FiRefreshCw className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              <span>Rafraîchir</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement créneaux…</p>
            </div>
          ) : creneaux.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FiClock className="text-4xl mx-auto mb-3 opacity-50" />
              <p className="text-sm">Aucun créneau pour l'instant.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {creneaux.map((c) => (
                <div 
                  key={c.id} 
                  className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex items-start justify-between gap-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <FiClock className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        Jour {c.jour ?? "?"} — {c.date} — {String(c.heure_debut).slice(0, 5)} → {String(c.heure_fin).slice(0, 5)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ID: {String(c.id).slice(0, 8)}…</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEdit(c)} 
                      className="bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 flex items-center gap-2"
                    >
                      <FiEdit2 className="text-sm" />
                      <span>Modifier</span>
                    </button>
                    <button 
                      onClick={() => deleteCreneau(c.id)} 
                      className="bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 px-4 py-2 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 flex items-center gap-2"
                    >
                      <FiTrash2 className="text-sm" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs opacity-60 text-slate-600 dark:text-slate-400">
          La capacité réelle d'un créneau = nombre de tickets assignés dans l'onglet Stock.
        </div>
      </div>
    </div>
  );
}
