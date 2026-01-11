import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminSite() {
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

    if (error) return alert("Erreur chargement créneaux: " + error.message);
    setCreneaux(data ?? []);
  }

  useEffect(() => {
    fetchCreneaux();
  }, []);

  async function addCreneau(e) {
    e.preventDefault();
    if (!date) return alert("Date obligatoire");
    if (!heureDebut) return alert("Heure début obligatoire");
    if (!heureFin) return alert("Heure fin obligatoire");

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

    if (error) return alert("Erreur création créneau: " + error.message);

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

    if (!editDate) return alert("Date obligatoire");
    if (!editHeureDebut) return alert("Heure début obligatoire");
    if (!editHeureFin) return alert("Heure fin obligatoire");

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

    if (error) return alert("Erreur mise à jour: " + error.message);

    cancelEdit();
    await fetchCreneaux();
  }

  async function deleteCreneau(id) {
    if (!confirm("Supprimer ce créneau ?")) return;
    const { error } = await supabase.from("creneaux_horaires").delete().eq("id", id);
    if (error) return alert("Erreur suppression: " + error.message);
    await fetchCreneaux();
  }

  return (
    <div className="min-h-screen p-6 flex justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Admin — Créneaux</h1>
          <p className="text-sm opacity-70 text-slate-600 dark:text-slate-400">
            Créer, modifier et supprimer des créneaux (date + jour + horaires).
          </p>
        </div>

        {/* Création */}
        <form onSubmit={addCreneau} className="border dark:border-slate-700 rounded-2xl p-4 shadow space-y-4 bg-white dark:bg-slate-800">
          <div className="font-semibold text-slate-800 dark:text-slate-200">Créer un créneau</div>

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

          <button disabled={saving} className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-600" type="submit">
            {saving ? "Création…" : "Ajouter le créneau"}
          </button>
        </form>

        {/* Édition */}
        {editing ? (
          <div className="border dark:border-slate-700 rounded-2xl p-4 shadow space-y-3 bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-800 dark:text-slate-200">Modifier le créneau</div>
              <button onClick={cancelEdit} className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-600">
                Fermer
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

              <div className="flex gap-2">
                <button disabled={updating} className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-600" type="submit">
                  {updating ? "Sauvegarde…" : "Enregistrer"}
                </button>
                <button type="button" onClick={cancelEdit} className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-600">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Liste */}
        <div className="border dark:border-slate-700 rounded-2xl p-4 shadow space-y-3 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-slate-800 dark:text-slate-200">Créneaux</div>
            <button onClick={fetchCreneaux} className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-600">
              Rafraîchir
            </button>
          </div>

          {loading ? (
            <p className="text-sm opacity-70 text-slate-600 dark:text-slate-400">Chargement créneaux…</p>
          ) : creneaux.length === 0 ? (
            <p className="text-sm opacity-70 text-slate-600 dark:text-slate-400">Aucun créneau pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {creneaux.map((c) => (
                <div key={c.id} className="border dark:border-slate-700 rounded-xl p-3 flex items-start justify-between gap-3 bg-gray-50 dark:bg-slate-700">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Jour {c.jour ?? "?"} — {c.date} — {String(c.heure_debut).slice(0, 5)} →{" "}
                      {String(c.heure_fin).slice(0, 5)}
                    </div>
                    <div className="text-xs opacity-60 text-slate-600 dark:text-slate-400">ID: {String(c.id).slice(0, 8)}…</div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => startEdit(c)} className="border dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-500">
                      Modifier
                    </button>
                    <button onClick={() => deleteCreneau(c.id)} className="border dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-500">
                      Supprimer
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
