import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiPackage, FiRefreshCw, FiCheckCircle, FiXCircle, FiClock, FiUser, FiTag, FiDollarSign } from "react-icons/fi";

export default function Vendeur() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  // ============================================================
  // GESTION RÉCEPTION / INBOX (Nouvelles Commandes)
  // ============================================================
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  useEffect(() => {
    fetchInbox();
  }, []);

  // Récupérer les commandes à traiter (En attente ou Payées mais pas encore validées)
  async function fetchInbox() {
    setLoadingInbox(true);
    const { data, error } = await supabase
      .from("commandes")
      .select(`*, creneaux_horaires ( date, heure_debut )`)
      .in("statut", ["en_attente", "paiement_recu"]) 
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setInbox(data || []);
    setLoadingInbox(false);
  }

  // Action : Valider la commande
  async function validerCommande(id) {
    const confirmed = await showConfirm("Accepter cette réservation ?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("commandes")
      .update({ statut: "validee" }) // Passe en validée (disparaît de la liste)
      .eq("id", id);

    if (error) {
      showNotification("Erreur : " + error.message, "error");
    } else {
      showNotification("Commande validée avec succès", "success");
      // Mise à jour locale (retirer de la liste)
      setInbox((prev) => prev.filter((c) => c.id !== id));
    }
  }

  // Action : Refuser la commande
  async function refuserCommande(id) {
    const confirmed = await showConfirm("Refuser et annuler cette commande ?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("commandes")
      .update({ statut: "refusee" })
      .eq("id", id);

    if (error) {
      showNotification("Erreur : " + error.message, "error");
    } else {
      showNotification("Commande refusée", "warning");
      setInbox((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-20 safe-x animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <FiPackage className="text-indigo-600 dark:text-indigo-400" />
              Réception Commandes
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Gérer les nouvelles commandes en attente
            </p>
          </div>
          <button 
            onClick={fetchInbox} 
            disabled={loadingInbox}
            className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <FiRefreshCw className={`text-lg ${loadingInbox ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>

        {/* Liste des commandes */}
        {loadingInbox ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement des commandes...</p>
          </div>
        ) : inbox.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border-2 border-indigo-200 dark:border-indigo-800 p-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <FiCheckCircle className="text-4xl text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-400 mb-2">Tout est à jour</h3>
            <p className="text-slate-600 dark:text-slate-400">Aucune commande en attente de traitement.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inbox.map((cmd) => (
              <div 
                key={cmd.id} 
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all duration-200"
              >
                {/* Header avec ticket et statut */}
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-700 dark:to-slate-800 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-lg font-bold text-sm flex items-center gap-2">
                        <FiTag className="text-xs" />
                        #{cmd.ticket_num}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        cmd.statut === 'paiement_recu' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        {cmd.statut === 'paiement_recu' ? (
                          <>
                            <FiCheckCircle className="text-xs" />
                            PAYÉ
                          </>
                        ) : (
                          <>
                            <FiClock className="text-xs" />
                            EN ATTENTE
                          </>
                        )}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Acompte</div>
                      <div className="text-green-600 dark:text-green-400 font-bold text-xl flex items-center gap-1">
                        <FiDollarSign className="text-sm" />
                        {(cmd.acompte_cents/100).toFixed(0)} €
                      </div>
                    </div>
                  </div>
                </div>

                {/* Corps de la carte */}
                <div className="p-5 space-y-4">
                  {/* Informations client */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      <FiUser className="text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 truncate">
                        {cmd.contact_last_name} {cmd.contact_first_name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{cmd.contact_phone}</p>
                    </div>
                  </div>

                  {/* Détails commande */}
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 border border-slate-200 dark:border-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <FiClock className="text-xs" />
                        Créneau
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {cmd.creneaux_horaires 
                          ? `J${cmd.creneaux_horaires.date} - ${String(cmd.creneaux_horaires.heure_debut).slice(0,5)}` 
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Catégorie</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {cmd.choix_categorie || "Non spécifiée"}
                      </span>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => validerCommande(cmd.id)}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <FiCheckCircle className="text-lg" />
                      <span>Accepter</span>
                    </button>
                    <button 
                      onClick={() => refuserCommande(cmd.id)}
                      className="flex-1 bg-white dark:bg-slate-700 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-3.5 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <FiXCircle className="text-lg" />
                      <span>Refuser</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}