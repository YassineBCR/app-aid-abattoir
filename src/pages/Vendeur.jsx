import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useNotification } from "../contexts/NotificationContext";

export default function Vendeur() {
  const { showAlert, showConfirm, showPrompt, showNotification } = useNotification();
  const [mode, setMode] = useState("reception");
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  useEffect(() => {
    if (mode === "reception") fetchInbox();
    else checkCaisse();
  }, [mode]);

  // --- MODIFICATION ICI : On récupère aussi les 'paiement_recu' ---
  async function fetchInbox() {
    setLoadingInbox(true);
    const { data, error } = await supabase
      .from("commandes")
      .select(`*, creneaux_horaires ( date, heure_debut )`)
      // 👇 On accepte 'en_attente' ET 'paiement_recu' (pour les voir arriver)
      .in("statut", ["en_attente", "paiement_recu"]) 
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setInbox(data || []);
    setLoadingInbox(false);
  }

  async function validerCommande(id) {
    const confirmed = await showConfirm("Marquer cette commande comme Validée (Prête pour le jour J) ?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("commandes")
      .update({ statut: "validee" }) // Elle sortira de la liste car 'validee' n'est pas dans le filtre
      .eq("id", id);

    if (error) showNotification("Erreur : " + error.message, "error");
    else setInbox((prev) => prev.filter((c) => c.id !== id));
  }

  async function refuserCommande(id) {
    const confirmed = await showConfirm("Refuser et annuler cette commande ?");
    if (!confirmed) return;
    const { error } = await supabase.from("commandes").update({ statut: "refusee" }).eq("id", id);
    if (error) showNotification("Erreur : " + error.message, "error");
    else setInbox((prev) => prev.filter((c) => c.id !== id));
  }

  // --- LE RESTE DU CODE (CAISSE) EST IDENTIQUE ---
  const [caisse, setCaisse] = useState(null);
  const [loadingCaisse, setLoadingCaisse] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [commande, setCommande] = useState(null);
  const [loadingCmd, setLoadingCmd] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [showCloture, setShowCloture] = useState(false);
  const [reelEspeces, setReelEspeces] = useState("");
  const [reelCB, setReelCB] = useState("");

  async function checkCaisse() {
    setLoadingCaisse(true);
    const { data } = await supabase.rpc("get_ma_caisse_ouverte");
    if (data && data.length > 0) setCaisse(data[0]);
    else setCaisse(null);
    setLoadingCaisse(false);
  }

  async function ouvrirCaisse() {
    const fond = await showPrompt("Fond de caisse initial (en €) ?", "0");
    if (fond === null) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("caisses_vendeurs").insert({
      vendeur_id: user.id,
      fond_caisse_initial: parseFloat(fond) * 100,
      statut: 'ouverte'
    });
    checkCaisse();
  }

  async function loadCommande(idOrTicket) {
    setLoadingCmd(true);
    let query = supabase.from("commandes").select("*, creneaux_horaires(*)");
    if (idOrTicket.length > 20) query = query.eq("id", idOrTicket);
    else query = query.eq("ticket_num", idOrTicket);
    const { data, error } = await query.single();
    setLoadingCmd(false);
    if (error || !data) showNotification("Commande introuvable !", "error");
    else {
      setCommande(data);
      setShowScanner(false);
    }
  }

  async function encaisser(mode) {
    if (!caisse) return showNotification("Caisse fermée !", "error");
    const reste = commande.montant_total_cents - commande.acompte_cents;
    if (reste > 0) {
        const confirmed = await showConfirm(`Encaisser ${(reste/100).toFixed(2)}€ en ${mode} ?`);
        if (!confirmed) return;
        await supabase.from("encaissements").insert({
            caisse_id: caisse.id, commande_id: commande.id, montant_cents: reste, mode_paiement: mode
        });
    }
    await supabase.from("commandes").update({ statut: 'livree' }).eq("id", commande.id);
    showNotification("✅ Commande soldée !", "success");
    setCommande(null);
  }

  async function cloturer() {
    const confirmed = await showConfirm("Fermer la caisse ?");
    if (!confirmed) return;
    await supabase.rpc("cloturer_caisse", {
        p_caisse_id: caisse.id,
        p_total_reel_especes: parseFloat(reelEspeces || 0) * 100,
        p_total_reel_cb: parseFloat(reelCB || 0) * 100,
        p_justification: "Clôture normale"
    });
    showNotification("Caisse fermée !", "success");
    checkCaisse();
    setShowCloture(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-20 safe-x">
      {/* ONGLETS */}
      <div className="flex bg-white dark:bg-slate-800 rounded-xl shadow-sm p-1 mb-6 border border-gray-200 dark:border-slate-700">
        <button onClick={() => setMode("reception")} className={`flex-1 py-3 rounded-lg font-bold text-sm ${mode === "reception" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>📥 Réception ({inbox.length})</button>
        <button onClick={() => setMode("caisse")} className={`flex-1 py-3 rounded-lg font-bold text-sm ${mode === "caisse" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>📸 Caisse & Scan</button>
      </div>

      {/* MODE RECEPTION */}
      {mode === "reception" && (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center px-1">
                <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Dernières Commandes</h2>
                <button onClick={fetchInbox} className="text-blue-600 font-semibold text-sm">🔄 Actualiser</button>
            </div>
            {loadingInbox ? <div className="text-center py-10 text-gray-400">Chargement...</div> : inbox.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border p-8 rounded-xl text-center shadow-sm">
                    <h3 className="font-bold">Aucune nouvelle commande</h3>
                    <p className="text-gray-500 text-sm">En attente ou Paiement Reçu</p>
                </div>
            ) : (
                inbox.map((cmd) => (
                    <div key={cmd.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-4 rounded-xl shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">#{cmd.ticket_num}</span>
                                    {/* Badge Statut */}
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cmd.statut === 'paiement_recu' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {cmd.statut === 'paiement_recu' ? 'PAYÉ' : 'EN ATTENTE'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-800 dark:text-slate-100 text-lg mt-1">{cmd.contact_last_name} {cmd.contact_first_name}</h3>
                                <p className="text-sm text-gray-500">{cmd.contact_phone}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-gray-400 uppercase">Acompte</div>
                                <div className="text-green-600 font-mono font-bold text-lg">{(cmd.acompte_cents/100).toFixed(0)} €</div>
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded-lg text-sm border border-gray-100 dark:border-slate-600">
                             <div className="flex justify-between"><span>Créneau:</span><span className="font-semibold">{cmd.creneaux_horaires ? `J${cmd.creneaux_horaires.date}` : "—"}</span></div>
                             <div className="flex justify-between mt-1"><span>Catégorie:</span><span className="font-bold text-indigo-600">{cmd.choix_categorie || "Aucune"}</span></div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => validerCommande(cmd.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-sm">Valider ✅</button>
                            <button onClick={() => refuserCommande(cmd.id)} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-lg font-bold">Refuser ❌</button>
                        </div>
                    </div>
                ))
            )}
        </div>
      )}

      {/* MODE CAISSE */}
      {mode === "caisse" && (
        <div className="animate-fade-in">
             {!caisse ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow text-center border mt-4">
                    <h1 className="text-2xl font-bold mb-2">Caisse Fermée 🔒</h1>
                    <button onClick={ouvrirCaisse} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-4">Ouvrir Caisse</button>
                </div>
            ) : (
                <>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex justify-between items-center mb-6 border">
                        <div><div className="text-xs text-gray-400 font-bold uppercase">Caisse</div><div className="text-green-600 font-bold">● Ouverte</div></div>
                        <button onClick={() => setShowCloture(true)} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-sm font-bold border border-red-100">Fermer</button>
                    </div>
                    {!commande && (
                        <div className="space-y-4">
                            <button onClick={() => setShowScanner(true)} className="w-full bg-indigo-600 text-white p-8 rounded-2xl shadow-lg flex flex-col items-center gap-2">
                                <span className="text-4xl">📸</span><span className="font-bold text-lg">Scanner Client</span>
                            </button>
                            <form onSubmit={(e) => {e.preventDefault(); loadCommande(manualSearch)}} className="flex gap-2">
                                <input className="flex-1 border p-3 rounded-xl dark:bg-slate-700 dark:text-white" placeholder="N° Ticket" value={manualSearch} onChange={e => setManualSearch(e.target.value)} />
                                <button type="submit" className="bg-gray-800 text-white px-4 rounded-xl">🔎</button>
                            </form>
                        </div>
                    )}
                    {showScanner && (
                        <div className="fixed inset-0 bg-black z-50 flex flex-col">
                            <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 text-white text-xl p-4 z-10">❌</button>
                            <div className="flex-1 flex items-center justify-center">
                                <Scanner onScan={(res) => { if(res && res[0]) try { loadCommande(JSON.parse(res[0].rawValue).id) } catch { loadCommande(res[0].rawValue) } }} />
                            </div>
                        </div>
                    )}
                    {commande && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border mt-4 p-6 space-y-4">
                            <div className="flex justify-between font-bold text-xl"><span>Ticket #{commande.ticket_num}</span><button onClick={() => setCommande(null)} className="text-sm underline text-red-500">Annuler</button></div>
                            <div className="text-center"><h2 className="text-2xl font-bold">{commande.contact_last_name}</h2><p>{commande.sacrifice_name}</p></div>
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 dark:bg-slate-700 dark:border-slate-600">
                                <div className="flex justify-between font-bold text-xl text-red-600"><span>Reste</span><span>{((commande.montant_total_cents - commande.acompte_cents)/100).toFixed(2)}€</span></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3"><button onClick={() => encaisser('especes')} className="bg-green-600 text-white py-4 rounded-xl font-bold">Espèces</button><button onClick={() => encaisser('cb')} className="bg-blue-600 text-white py-4 rounded-xl font-bold">CB</button></div>
                        </div>
                    )}
                    {showCloture && (
                         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4">
                                <h2 className="text-xl font-bold">Clôture</h2>
                                <input type="number" className="border w-full p-2 rounded" placeholder="Total Espèces" value={reelEspeces} onChange={e=>setReelEspeces(e.target.value)} />
                                <input type="number" className="border w-full p-2 rounded" placeholder="Total CB" value={reelCB} onChange={e=>setReelCB(e.target.value)} />
                                <button onClick={cloturer} className="w-full bg-red-600 text-white font-bold py-2 rounded">Valider</button>
                                <button onClick={() => setShowCloture(false)} className="w-full bg-gray-200 font-bold py-2 rounded">Annuler</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
      )}
    </div>
  );
}