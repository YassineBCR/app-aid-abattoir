import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendSms } from "../lib/smsService";
import { useNotification } from "../contexts/NotificationContext";
import { FiMail, FiSend, FiRefreshCw, FiMessageSquare } from "react-icons/fi";

export default function AdminSMS() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Formulaire Campagne
  const [message, setMessage] = useState("Bonjour, les réservations pour l'Aïd sont ouvertes ! Connectez-vous sur : https://bergerielanguedocienne.fr");
  const [target, setTarget] = useState("all"); // 'all' ou 'specific'

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    // 1. Récupérer les clients uniques (depuis les commandes)
    // Astuce : on prend les numéros distincts dans la table commandes
    const { data: dataClients } = await supabase
      .from("commandes")
      .select("contact_phone, contact_first_name, contact_last_name")
      .not("contact_phone", "is", null);

    // Dédoublonnage par téléphone
    const uniqueClients = [];
    const seenPhones = new Set();
    
    (dataClients || []).forEach(c => {
        if (!seenPhones.has(c.contact_phone)) {
            seenPhones.add(c.contact_phone);
            uniqueClients.push(c);
        }
    });
    setClients(uniqueClients);

    // 2. Récupérer l'historique des SMS
    const { data: dataLogs } = await supabase
      .from("sms_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
      
    setLogs(dataLogs || []);
    setLoading(false);
  }

  async function handleSendCampaign() {
    if (!message) return showNotification("Le message est vide !", "error");
    const confirmed = await showConfirm(`Envoyer ce SMS à ${clients.length} clients (Simulation) ?`);
    if (!confirmed) return;

    setSending(true);
    let count = 0;

    // Envoi en série (pour ne pas bloquer le navigateur)
    for (const client of clients) {
        await sendSms(client.contact_phone, message, "campagne");
        count++;
    }

    setSending(false);
    showNotification(`✅ Campagne terminée : ${count} SMS envoyés !`, "success");
    fetchData(); // Rafraîchir les logs
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <FiMail className="text-3xl text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Communication SMS</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Gérer les campagnes SMS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. LANCER UNE CAMPAGNE */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-5">
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
            <FiSend className="text-indigo-600 dark:text-indigo-400" />
            Nouvelle Campagne
          </h2>
            
            <div>
                <label className="text-sm font-bold text-gray-500 dark:text-gray-400">Destinataires</label>
                <select 
                    className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-2 rounded mt-1 bg-gray-50"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                >
                    <option value="all">Tous les clients passés ({clients.length})</option>
                    {/* On pourrait ajouter des filtres ici */}
                </select>
            </div>

            <div>
                <label className="text-sm font-bold text-gray-500 dark:text-gray-400">Message (Max 160 car.)</label>
                <textarea 
                    className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-3 rounded-lg mt-1 h-32 text-sm"
                    maxLength={160}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                />
                <div className="text-right text-xs text-gray-400 dark:text-gray-500">
                    {message.length} / 160 caractères
                </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-xs text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                ℹ️ <b>Mode Simulation :</b> Les SMS seront enregistrés dans la base de données mais pas envoyés réellement sur les téléphones.
            </div>

          <button 
            onClick={handleSendCampaign}
            disabled={sending || clients.length === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            <FiSend className="text-lg" />
            <span>{sending ? "Envoi en cours..." : "Envoyer la Campagne"}</span>
          </button>
        </div>

        {/* 2. HISTORIQUE DES ENVOIS */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FiMessageSquare className="text-indigo-600 dark:text-indigo-400" />
              Historique Récent
            </h2>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 disabled:opacity-50"
            >
              <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-2">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">Chargement...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                <FiMessageSquare className="text-3xl mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun SMS envoyé.</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="p-4 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200 mb-2">
                    <span className="flex items-center gap-2">
                      <FiMail className="text-xs" />
                      {log.destinataire}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                      log.statut === 'envoye' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {log.statut.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-2 italic">"{log.message}"</p>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Type: {log.type}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}