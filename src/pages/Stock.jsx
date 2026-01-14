import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiBox, FiCalendar, FiClock, FiPlus, FiTag, FiXCircle, FiCheck, FiLayers, FiX, FiEye, FiUser, FiPhone, FiInfo 
} from "react-icons/fi";

export default function Stock() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  
  // Données principales
  const [creneaux, setCreneaux] = useState([]);
  const [ticketsDispo, setTicketsDispo] = useState({}); // Pour le compteur visuel (disponible uniquement)
  const [joursConfig, setJoursConfig] = useState([]);
  
  // Input simple (ajout unitaire)
  const [inputs, setInputs] = useState({}); 

  // --- ETATS MODAL AJOUT MULTIPLE ---
  const [showModal, setShowModal] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [previewList, setPreviewList] = useState([]);

  // --- ETATS MODAL DÉTAILS (VISUALISATION) ---
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTickets, setDetailTickets] = useState([]); // Liste de TOUS les tickets du créneau
  const [selectedTicketInfo, setSelectedTicketInfo] = useState(null); // Le ticket cliqué pour voir le client
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadData();
    const sub = supabase.channel('stock_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => {
        loadData();
        // Si la modal détail est ouverte, on rafraichit aussi la liste dedans
        if (showDetailModal && selectedSlotId) {
            fetchSlotDetails(selectedSlotId);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [showDetailModal, selectedSlotId]); // On ajoute les dépendances pour le refresh auto

  async function loadData() {
    try {
      const { data: jours } = await supabase.from("jours_fete").select("*");
      setJoursConfig(jours || []);

      const { data: slots } = await supabase
        .from("creneaux_horaires")
        .select("*")
        .order("date", { ascending: true })
        .order("heure_debut", { ascending: true });
      setCreneaux(slots || []);

      // Pour l'affichage "Stock", on ne veut que les disponibles
      const { data: tickets } = await supabase
        .from("commandes")
        .select("ticket_num, creneau_id")
        .eq("statut", "disponible");

      const mapping = {};
      tickets?.forEach(t => {
        if (!mapping[t.creneau_id]) mapping[t.creneau_id] = [];
        mapping[t.creneau_id].push(t.ticket_num);
      });
      setTicketsDispo(mapping);

    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  // --- LOGIQUE VISUALISATION DÉTAILS ---
  async function openDetailModal(slotId) {
    setSelectedSlotId(slotId);
    setShowDetailModal(true);
    setSelectedTicketInfo(null);
    fetchSlotDetails(slotId);
  }

  async function fetchSlotDetails(slotId) {
    setLoadingDetails(true);
    try {
        // On récupère TOUS les tickets (Vendus, Dispo, etc.)
        const { data, error } = await supabase
            .from("commandes")
            .select("*")
            .eq("creneau_id", slotId)
            .order("ticket_num", { ascending: true });
        
        if (error) throw error;
        setDetailTickets(data || []);
    } catch (err) {
        showNotification("Erreur chargement détails", "error");
    } finally {
        setLoadingDetails(false);
    }
  }

  // --- LOGIQUE AJOUT MULTIPLE ---
  useEffect(() => {
    if (!rangeStart || !rangeEnd) { setPreviewList([]); return; }
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (start > end) { setPreviewList([]); return; }
    const list = [];
    const limit = Math.min(end, start + 199); 
    for (let i = start; i <= limit; i++) list.push(i);
    setPreviewList(list);
  }, [rangeStart, rangeEnd]);

  async function handleBulkAdd() {
    if (previewList.length === 0) return;
    try {
        const { error } = await supabase.rpc("assigner_liste_tickets", {
            p_ticket_nums: previewList,
            p_creneau_id: selectedSlotId
        });
        if (error) throw error;
        showNotification(`${previewList.length} tickets ajoutés !`, "success");
        setShowModal(false);
        loadData();
    } catch (err) { showNotification("Erreur: " + err.message, "error"); }
  }

  // --- LOGIQUE UNITAIRE ---
  async function handleAddTicket(creneauId) {
    const numTicket = inputs[creneauId];
    if (!numTicket) return;
    try {
      const { error } = await supabase.rpc("assigner_ticket_stock", {
        p_ticket_num: parseInt(numTicket),
        p_creneau_id: creneauId
      });
      if (error) throw error;
      showNotification(`Ticket #${numTicket} ajouté !`, "success");
      setInputs(prev => ({ ...prev, [creneauId]: "" }));
      loadData();
    } catch (err) { showNotification(err.message, "error"); }
  }

  async function removeTicket(ticketNum) {
    if (!window.confirm(`Retirer le ticket #${ticketNum} du stock ?`)) return;
    try {
      const { error } = await supabase.rpc("retirer_ticket_stock", { p_ticket_num: ticketNum });
      if (error) throw error;
      showNotification("Ticket retiré.", "info");
      loadData();
      if(showDetailModal) fetchSlotDetails(selectedSlotId); // Refresh modal si ouverte
    } catch (err) { showNotification(err.message, "error"); }
  }

  const getJourLabel = (dateStr) => {
    const j = joursConfig.find(jd => jd.date_fete === dateStr);
    return j ? `JOUR ${j.numero}` : dateStr;
  };

  const groupedCreneaux = creneaux.reduce((acc, curr) => {
    const label = getJourLabel(curr.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(curr);
    return acc;
  }, {});

  // Helper couleur statut
  const getStatusColor = (statut) => {
      if (statut === 'disponible') return "bg-green-100 text-green-700 border-green-200";
      if (['acompte_paye', 'validee', 'paye', 'terminee'].includes(statut)) return "bg-orange-100 text-orange-700 border-orange-200";
      return "bg-slate-100 text-slate-500 border-slate-200";
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FiBox className="text-emerald-600" />
            Stock & Attribution
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gérez l'attribution des tickets et visualisez les propriétaires.
          </p>
        </div>
      </div>

      {loading ? <div className="text-center py-12">Chargement...</div> : (
        <div className="space-y-8">
          {Object.entries(groupedCreneaux).map(([jourLabel, slots]) => (
            <div key={jourLabel} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <div className="bg-emerald-100 text-emerald-800 p-2 rounded-lg"><FiCalendar className="text-xl" /></div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wide">{jourLabel}</h2>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {slots.map((slot) => {
                  const ticketsDuSlot = ticketsDispo[slot.id] || [];
                  const count = ticketsDuSlot.length;

                  return (
                    <div key={slot.id} className="p-6 flex flex-col gap-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl text-center min-w-[80px]">
                            <div className="text-lg font-bold text-slate-800 dark:text-white">{slot.heure_debut.slice(0, 5)}</div>
                            <div className="text-xs text-slate-500">{slot.heure_fin.slice(0, 5)}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-500">Tickets en ligne</div>
                            <div className="text-2xl font-bold text-emerald-600">
                              {count} <span className="text-sm text-slate-400 font-normal">/ {slot.places_disponibles + (slot.capacite_max - slot.places_disponibles)} total</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Input Ajout */}
                          <div className="relative">
                            <FiTag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="number"
                              placeholder="1050"
                              className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 w-24 md:w-32 dark:text-white font-mono font-bold"
                              value={inputs[slot.id] || ""}
                              onChange={(e) => setInputs({...inputs, [slot.id]: e.target.value})}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddTicket(slot.id)}
                            />
                            <button onClick={() => handleAddTicket(slot.id)} className="absolute right-1 top-1 bottom-1 px-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><FiPlus /></button>
                          </div>

                          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                          {/* Bouton Ajout Multiple */}
                          <button onClick={() => { setSelectedSlotId(slot.id); setShowModal(true); }} className="p-2.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl transition-all" title="Ajout par série"><FiLayers className="text-lg" /></button>
                          
                          {/* BOUTON VOIR LISTE / DÉTAILS */}
                          <button 
                            onClick={() => openDetailModal(slot.id)} 
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm"
                          >
                            <FiEye className="text-lg" />
                            Voir liste
                          </button>
                        </div>
                      </div>

                      {/* Aperçu rapide des tickets DISPO uniquement */}
                      {count > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {ticketsDuSlot.slice(0, 10).map(num => (
                              <span key={num} className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">#{num}</span>
                            ))}
                            {ticketsDuSlot.length > 10 && <span className="text-xs text-slate-400 px-2 py-1">... +{ticketsDuSlot.length - 10}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL AJOUT SÉRIE --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
                    <h3 className="text-xl font-bold flex items-center gap-2"><FiLayers /> Ajout par Série</h3>
                    <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><FiX className="text-xl"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <input type="number" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-mono text-lg font-bold" placeholder="Du N°" autoFocus />
                        <span className="text-slate-400">à</span>
                        <input type="number" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-full p-3 bg-slate-50 border-2 rounded-xl font-mono text-lg font-bold" placeholder="Au N°" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border max-h-[150px] overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                             {previewList.length > 0 ? previewList.map(n => <span key={n} className="px-2 py-1 bg-white border rounded text-xs font-mono font-bold">#{n}</span>) : <span className="text-slate-400 italic">Aperçu...</span>}
                        </div>
                    </div>
                    <button onClick={handleBulkAdd} disabled={previewList.length === 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg">Confirmer l'ajout</button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL DÉTAILS LISTE --- */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-700">
                
                {/* COLONNE GAUCHE : LISTE */}
                <div className="w-full md:w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-900/50">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white">Tickets du créneau</h3>
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-full">{detailTickets.length} total</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {loadingDetails ? <div className="text-center py-4"><FiLayers className="animate-spin mx-auto"/></div> : 
                         detailTickets.length === 0 ? <p className="text-center text-slate-400 italic mt-4">Aucun ticket.</p> :
                         detailTickets.map(t => (
                            <button 
                                key={t.ticket_num}
                                onClick={() => setSelectedTicketInfo(t)}
                                className={`w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center ${
                                    selectedTicketInfo?.ticket_num === t.ticket_num 
                                    ? "bg-white dark:bg-slate-700 border-indigo-500 shadow-md ring-1 ring-indigo-500" 
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                                }`}
                            >
                                <span className="font-mono font-bold text-lg text-slate-700 dark:text-slate-200">#{t.ticket_num}</span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getStatusColor(t.statut)}`}>
                                    {t.statut === 'disponible' ? 'En Stock' : 'Réservé'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* COLONNE DROITE : INFO CLIENT */}
                <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-800">
                    <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><FiX className="text-xl"/></button>
                    
                    <div className="p-8 flex-1 flex flex-col justify-center items-center">
                        {selectedTicketInfo ? (
                            selectedTicketInfo.statut === 'disponible' ? (
                                <div className="text-center space-y-4">
                                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-4">
                                        <FiCheck />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Ticket #{selectedTicketInfo.ticket_num}</h2>
                                    <p className="text-slate-500">Ce ticket est actuellement en stock et disponible à la vente.</p>
                                    <button 
                                        onClick={() => removeTicket(selectedTicketInfo.ticket_num)}
                                        className="mt-6 px-6 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center gap-2 mx-auto"
                                    >
                                        <FiXCircle /> Retirer du stock
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full max-w-md space-y-6 animate-fade-in">
                                    <div className="text-center border-b border-slate-100 dark:border-slate-700 pb-6">
                                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">Réservé / Vendu</span>
                                        <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-1">#{selectedTicketInfo.ticket_num}</h2>
                                        <p className="text-slate-400 text-sm">Sacrifice : <strong className="text-slate-700 dark:text-slate-300">{selectedTicketInfo.sacrifice_name || "Non précisé"}</strong></p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-full text-indigo-600 shadow-sm"><FiUser className="text-xl"/></div>
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold">Client</p>
                                                <p className="font-bold text-lg text-slate-800 dark:text-white">{selectedTicketInfo.contact_last_name} {selectedTicketInfo.contact_first_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-full text-green-600 shadow-sm"><FiPhone className="text-xl"/></div>
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold">Téléphone</p>
                                                <p className="font-bold text-lg text-slate-800 dark:text-white">{selectedTicketInfo.contact_phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                            <div className="bg-white dark:bg-slate-800 p-3 rounded-full text-blue-600 shadow-sm"><FiInfo className="text-xl"/></div>
                                            <div>
                                                <p className="text-xs text-slate-400 uppercase font-bold">Email</p>
                                                <p className="font-medium text-slate-800 dark:text-white truncate max-w-[200px]">{selectedTicketInfo.contact_email}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="text-center text-slate-400">
                                <FiInfo className="text-6xl mx-auto mb-4 opacity-20" />
                                <p>Sélectionnez un ticket dans la liste<br/>pour voir les détails.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
      )}

    </div>
  );
}