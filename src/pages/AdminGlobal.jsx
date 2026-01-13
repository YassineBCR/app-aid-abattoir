import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";

export default function AdminGlobal() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  // ---------- SITES ----------
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
    await fetchSites();
  }

  async function deleteSite(id) {
    const confirmed = await showConfirm("Supprimer ce site ?");
    if (!confirmed) return;
    const { error } = await supabase.from("sites_abattoir").delete().eq("id", id);
    if (error) return showNotification("Erreur suppression site: " + error.message, "error");
    await fetchSites();
  }

  return (
    <div className="min-h-screen p-6 flex justify-center safe-y safe-x">
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Admin Global</h1>
          <p className="text-sm opacity-70">Gestion des sites</p>
        </div>

        {/* ----------- SITES ----------- */}
        <section className="border rounded-2xl p-4 shadow space-y-3">
          <h2 className="font-semibold">Sites d’abattoir</h2>

          <form onSubmit={addSite} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="border rounded-xl p-3"
              placeholder="Nom (ex: Montpellier)"
              value={nomSite}
              onChange={(e) => setNomSite(e.target.value)}
            />
            <input
              className="border rounded-xl p-3"
              placeholder="Adresse (optionnel)"
              value={adresseSite}
              onChange={(e) => setAdresseSite(e.target.value)}
            />
            <button className="border rounded-xl p-3" disabled={loadingSite}>
              {loadingSite ? "Ajout..." : "Ajouter"}
            </button>
          </form>

          <div className="space-y-2">
            {sites.length === 0 ? (
              <p className="text-sm opacity-70">Aucun site.</p>
            ) : (
              sites.map((s) => (
                <div key={s.id} className="border rounded-xl p-3 flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.nom}</div>
                    <div className="text-sm opacity-80">{s.adresse || "—"}</div>
                  </div>
                  <button
                    onClick={() => deleteSite(s.id)}
                    className="border rounded-xl px-3 py-2 text-sm"
                  >
                    Supprimer
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
