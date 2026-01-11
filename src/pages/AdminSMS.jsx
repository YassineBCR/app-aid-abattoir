import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendSms } from "../lib/smsService";

export default function AdminSMS() {
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
    if (!message) return alert("Le message est vide !");
    if (!confirm(`Envoyer ce SMS à ${clients.length} clients (Simulation) ?`)) return;

    setSending(true);
    let count = 0;

    // Envoi en série (pour ne pas bloquer le navigateur)
    for (const client of clients) {
        await sendSms(client.contact_phone, message, "campagne");
        count++;
    }

    setSending(false);
    alert(`✅ Campagne terminée : ${count} SMS envoyés !`);
    fetchData(); // Rafraîchir les logs
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Communication SMS 💬</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. LANCER UNE CAMPAGNE */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-green-700 dark:text-green-400 border-b dark:border-slate-700 pb-2">Nouvelle Campagne</h2>
            
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
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {sending ? "Envoi en cours..." : "🚀 Envoyer la Campagne"}
            </button>
        </div>

        {/* 2. HISTORIQUE DES ENVOIS */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 border-b dark:border-slate-700 pb-2">
                <h2 className="font-bold text-lg text-gray-700 dark:text-slate-200">Historique Récent</h2>
                <button onClick={fetchData} className="text-sm text-green-600 dark:text-green-400 hover:underline">Actualiser</button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-2">
                {loading ? <p className="text-slate-600 dark:text-slate-400">Chargement...</p> : logs.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 italic text-center py-10">Aucun SMS envoyé.</p>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-700 text-sm">
                            <div className="flex justify-between font-bold text-gray-700 dark:text-slate-200 mb-1">
                                <span>📱 {log.destinataire}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    log.statut === 'envoye' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                    {log.statut.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 mb-1 italic">"{log.message}"</p>
                            <div className="text-xs text-gray-400 dark:text-gray-500 flex justify-between">
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