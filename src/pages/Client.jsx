import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACOMPTE_CENTS = 10000; // 100 €
const RESERVE_TIMEOUT_MIN = 15;

export default function Client() {
  const [user, setUser] = useState(null);
  const [creneaux, setCreneaux] = useState([]);
  const [selectedCreneau, setSelectedCreneau] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    sacrifice_name: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      if (data?.user?.email) {
        setForm((f) => ({ ...f, email: data.user.email }));
      }
    });
  }, []);

  async function fetchCreneaux() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_creneaux_dispo");
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setCreneaux(data ?? []);
  }

  useEffect(() => {
    fetchCreneaux();
  }, []);

  const canSubmit = useMemo(() => {
    return (
      user &&
      selectedCreneau &&
      Number(selectedCreneau.places_restantes) > 0 &&
      form.first_name &&
      form.last_name &&
      form.phone &&
      form.email &&
      form.sacrifice_name &&
      !paying
    );
  }, [user, selectedCreneau, form, paying]);

  async function reserverEtPayer() {
    if (!user) return alert("Connecte-toi pour réserver.");

    setPaying(true);
    let commandeId = null;

    try {
      // 1️⃣ Réserver ticket (commande créée + ticket attribué)
      const { data, error } = await supabase.rpc("reserve_ticket", {
        p_creneau_id: selectedCreneau.id,
        p_client_id: user.id,
        p_first_name: form.first_name,
        p_last_name: form.last_name,
        p_phone: form.phone,
        p_email: form.email,
        p_address: form.address,
        p_sacrifice_name: form.sacrifice_name,
        p_acompte_cents: ACOMPTE_CENTS,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      commandeId = row?.commande_id;
      const ticketNum = row?.ticket_num;

      if (!commandeId || !ticketNum) {
        throw new Error("Réservation invalide (ticket manquant).");
      }

      console.log("✅ Ticket réservé :", { commandeId, ticketNum });

      // 2️⃣ Paiement MOCK (SumUp désactivé)
      // On redirige vers une page interne qui simule :
      // - paiement réussi
      // - paiement échoué (annule + libère ticket)
      // - paiement en attente
      window.location.assign(
        `/mock-pay?commande_id=${encodeURIComponent(commandeId)}&ticket_num=${encodeURIComponent(
          ticketNum
        )}`
      );
    } catch (e) {
      console.error(e);

      // 🔄 rollback ticket si la réservation a été faite mais qu'on n'arrive pas à continuer
      if (commandeId) {
        try {
          await supabase.rpc("cancel_commande", {
            p_commande_id: commandeId,
          });
        } catch (rb) {
          console.error("Rollback cancel_commande failed:", rb);
        }
      }

      alert(e.message);
      fetchCreneaux();
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* En-tête avec animation */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Réserver un créneau
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Sélectionnez votre créneau et complétez vos informations
          </p>
        </div>

        {/* Section Créneaux */}
        <div className="bg-white/90 rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 transition-shadow duration-200 hover:shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              📅
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Créneaux disponibles</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-indigo-600 font-semibold">Chargement...</span>
                </div>
              </div>
            </div>
          ) : creneaux.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg">Aucun créneau disponible pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creneaux.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCreneau(c)}
                  className={`relative rounded-xl p-5 text-left border-2 transition-all duration-200 ${
                    selectedCreneau?.id === c.id
                      ? "border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md ring-2 ring-indigo-200"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🗓️</span>
                      <span className="font-bold text-slate-800">Jour {c.jour}</span>
                    </div>
                    {selectedCreneau?.id === c.id && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-lg">🕐</span>
                      <span className="font-semibold">
                        {c.heure_debut} → {c.heure_fin}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        Number(c.places_restantes) > 5
                          ? "bg-green-100 text-green-700"
                          : Number(c.places_restantes) > 0
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {c.places_restantes} {c.places_restantes === 1 ? "place" : "places"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section Formulaire */}
        <div className="bg-white/90 rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 transition-shadow duration-200 hover:shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
              ✏️
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Informations client</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["Prénom", "first_name", "👤"],
              ["Nom", "last_name", "👤"],
              ["Téléphone", "phone", "📱"],
              ["Email", "email", "📧"],
              ["Adresse", "address", "📍"],
              ["Nom du sacrifice", "sacrifice_name", "🐑"],
            ].map(([label, key, icon]) => (
              <div
                key={key}
                className={key === "address" || key === "sacrifice_name" ? "sm:col-span-2" : ""}
              >
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="mr-2">{icon}</span>
                  {label}
                </label>
                <input
                  className="w-full border-2 border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors duration-150 bg-white hover:border-slate-300"
                  placeholder={label}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bouton de réservation */}
        <div className="space-y-4">
          <button
            disabled={!canSubmit}
            onClick={reserverEtPayer}
            className={`w-full group relative overflow-hidden rounded-xl p-4 font-bold text-lg text-white transition-all duration-200 ${
              canSubmit
                ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 hover:shadow-lg active:opacity-90"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            {paying ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Redirection paiement…</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span>💳</span>
                <span>Payer l'acompte & réserver (MOCK)</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </div>
            )}
          </button>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
            <span className="text-xl">⏱️</span>
            <p>
              <strong>Note importante :</strong> Le ticket est "réservé" pendant {RESERVE_TIMEOUT_MIN} minutes. 
              Si le paiement ne démarre pas, la réservation sera automatiquement annulée.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
