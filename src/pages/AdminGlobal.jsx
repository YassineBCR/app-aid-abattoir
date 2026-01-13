import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiGlobe, FiMapPin, FiPlus, FiTrash2, FiRefreshCw } from "react-icons/fi";

export default function AdminGlobal() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [sites, setSites] = useState([]);
  const [nomSite, setNomSite] = useState("");
  const [adresseSite, setAdresseSite] = useState("");
  const [loadingSite, setLoadingSite] = useState(false);

  async function fetchSites() {
    const { data, error } = await supabase
      .from("sites_abattoir")
      .select("id, nom, adresse, created_at")
      .order("created_at", { ascending: false });

    if (error) return showNotification("Erreur sites: " + error.message, "error");
    setSites(data ?? []);
  }

  useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSite(e) {
    e.preventDefault();
    if (!nomSite.trim()) return showNotification("Nom du site obligatoire", "error");

    setLoadingSite(true);
    const { error } = await supabase.from("sites_abattoir").insert({
      nom: nomSite.trim(),
      adresse: adresseSite.trim() || null,
    });
    setLoadingSite(false);

    if (error) return showNotification("Erreur ajout site: " + error.message, "error");

    setNomSite("");
    setAdresseSite("");
    showNotification("Site ajouté avec succès", "success");
    await fetchSites();
  }

  async function deleteSite(id) {
    const confirmed = await showConfirm("Supprimer ce site ?");
    if (!confirmed) return;
    const { error } = await supabase.from("sites_abattoir").delete().eq("id", id);
    if (error) return showNotification("Erreur suppression site: " + error.message, "error");
    showNotification("Site supprimé", "success");
    await fetchSites();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 safe-y safe-x animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center gap-3">
          <FiGlobe className="text-3xl text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Admin Global</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Gestion des sites d'abattoir</p>
          </div>
        </div>

        {/* Section Sites */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FiMapPin className="text-indigo-600 dark:text-indigo-400" />
              Sites d'abattoir
            </h2>
            <button 
              onClick={fetchSites}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            >
              <FiRefreshCw className="text-lg" />
            </button>
          </div>

          {/* Formulaire d'ajout */}
          <form onSubmit={addSite} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
            <input
              className="px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
              placeholder="Nom (ex: Montpellier)"
              value={nomSite}
              onChange={(e) => setNomSite(e.target.value)}
            />
            <input
              className="px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
              placeholder="Adresse (optionnel)"
              value={adresseSite}
              onChange={(e) => setAdresseSite(e.target.value)}
            />
            <button 
              type="submit"
              disabled={loadingSite}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FiPlus className="text-lg" />
              <span>{loadingSite ? "Ajout..." : "Ajouter"}</span>
            </button>
          </form>

          {/* Liste des sites */}
          <div className="space-y-3">
            {sites.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <FiMapPin className="text-4xl mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun site enregistré.</p>
              </div>
            ) : (
              sites.map((s) => (
                <div 
                  key={s.id} 
                  className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex justify-between items-center hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <FiMapPin className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">{s.nom}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{s.adresse || "—"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSite(s.id)}
                    className="bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 px-4 py-2 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 flex items-center gap-2"
                  >
                    <FiTrash2 className="text-sm" />
                    <span className="hidden sm:inline">Supprimer</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
