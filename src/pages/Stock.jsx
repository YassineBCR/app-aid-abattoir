import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiBox, FiCalendar, FiClock, FiPlus, FiTag, FiXCircle, FiCheck, FiLayers, FiX, FiEye, FiUser, FiPhone, FiInfo, FiGrid, FiFilter 
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

  // --- ETATS MODAL VISUELLE (GRID) ---
  const [showModal, setShowModal] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  
  // Gestion de la grille
  const [gridRange, setGridRange] = useState({ start: 1, end: 500 }); // Plage de visualisation
  const [allTicketsStatus, setAllTicketsStatus] = useState({}); // Map: ticket_num -> { statut, creneau_id }
  const [selectedForAdd, setSelectedForAdd] = useState([]); // Tickets sélectionnés pour ajout
  const [loadingGrid, setLoadingGrid] = useState(false);

  // --- ETATS MODAL DÉTAILS (VISUALISATION LISTE) ---
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTickets, setDetailTickets] = useState([]); 
  const [selectedTicketInfo, setSelectedTicketInfo] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadData();
    const sub = supabase.channel('stock_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => {
        loadData();
        if (showDetailModal && selectedSlotId) fetchSlotDetails(selectedSlotId);
        if (showModal) fetchAllTicketsStatus(); // Rafraichir la grille si ouverte
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [showDetailModal, showModal, selectedSlotId]);

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

      // Pour l'affichage "Stock" (compteurs), on ne veut que les disponibles
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

  // --- LOGIQUE MODALE VISUELLE (GRILLE) ---

  async function openGridModal(slotId) {
    setSelectedSlotId(slotId);
    setShowModal(true);
    setSelectedForAdd([]); // Reset sélection
    fetchAllTicketsStatus();
  }

  async function fetchAllTicketsStatus() {
    setLoadingGrid(true);
    try {
        // On récupère TOUS les tickets existants pour savoir s'ils sont vendus/stock
        const { data, error } = await supabase
            .from("commandes")
            .select("ticket_num, statut, creneau_id");
        
        if (error) throw error;

        const statusMap = {};
        data?.forEach(t => {
            statusMap[t.ticket_num] = { statut: t.statut, creneau_id: t.creneau_id };
        });
        setAllTicketsStatus(statusMap);
    } catch (err) {
        console.error(err);
        showNotification("Erreur chargement grille", "error");
    } finally {
        setLoadingGrid(false);
    }
  }

  // Helper pour déterminer l'état d'un ticket dans la grille
  const getTicketState = (num) => {
      if (selectedForAdd.includes(num)) return 'selected'; // Vert (sélectionné par l'user)
      
      const info = allTicketsStatus[num];
      if (!info) return 'free'; // Blanc (n'existe pas en base)

      // Si existe : vérifier statut
      if (['acompte_paye', 'validee', 'paye', 'terminee'].includes(info.statut)) {
          return 'sold'; // Rouge (Vendu)
      }
      return 'stock'; // Orange (Disponible ou Attente ou Autre)
  };

  const handleTicketClick = (num) => {
      const state = getTicketState(num);
      
      // On ne peut sélectionner que les "free" (libres)
      // Ou désélectionner ceux qu'on vient de sélectionner ('selected')
      if (state === 'sold' || state === 'stock') return; // Bloqué

      if (state === 'selected') {
          setSelectedForAdd(prev => prev.filter(n => n !== num));
      } else {
          setSelectedForAdd(prev => [...prev, num]);
      }
  };

  async function confirmGridAdd() {
    if (selectedForAdd.length === 0) return;
    try {
        const { error } = await supabase.rpc("assigner_liste_tickets", {
            p_ticket_nums: selectedForAdd,
            p_creneau_id: selectedSlotId
        });
        if (error) throw error;
        
        showNotification(`${selectedForAdd.length} tickets ajoutés au stock !`, "success");
        setShowModal(false);
        loadData();
    } catch (err) { showNotification("Erreur: " + err.message, "error"); }
  }

  // --- LOGIQUE VISUALISATION DÉTAILS LISTE ---
  async function openDetailModal(slotId) {
    setSelectedSlotId(slotId);
    setShowDetailModal(true);
    setSelectedTicketInfo(null);
    fetchSlotDetails(slotId);
  }

  async function fetchSlotDetails(slotId) {
    setLoadingDetails(true);
    try {
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

  // --- LOGIQUE UNITAIRE RAPIDE ---
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
      if(showDetailModal) fetchSlotDetails(selectedSlotId);
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

  const getStatusColor = (statut) => {
      if (statut === 'disponible') return "bg-green-100 text-green-700 border-green-200";
      if (['acompte_paye', 'validee', 'paye', 'terminee'].includes(statut)) return "bg-orange-100 text-orange-700 border-orange-200";
      return "bg-slate-100 text-slate-500 border-slate-200";
  };

  // Helper pour générer la grille (optimisation simple)
  const gridNumbers = [];
  if (showModal) {
      for (let i = gridRange.start; i <= gridRange.end; i++) {
          gridNumbers.push(i);
      }
  }

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
                          {/* Input Rapide */}
                          <div className="relative">
                            <FiTag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="number" placeholder="N°"
                              className="pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 w-24 md:w-32 dark:text-white font-mono font-bold"
                              value={inputs[slot.id] || ""}
                              onChange={(e) => setInputs({...inputs, [slot.id]: e.target.value})}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddTicket(slot.id)}
                            />
                            <button onClick={() => handleAddTicket(slot.id)} className="absolute right-1 top-1 bottom-1 px-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 flex items-center justify-center"><FiPlus /></button>
                          </div>

                          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                          {/* BOUTON GRILLE VISUELLE (Modifié) */}
                          <button 
                            onClick={() => openGridModal(slot.id)} 
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all text-sm"
                            title="Ouvrir la grille de sélection"
                          >
                            <FiGrid className="text-lg" />
                            Sélection Grille
                          </button>
                          
                          {/* BOUTON VOIR LISTE */}
                          <button 
                            onClick={() => openDetailModal(slot.id)} 
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm"
                          >
                            <FiEye className="text-lg" />
                            Détails
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL GRILLE VISUELLE --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                
                {/* HEADER MODAL */}
                <div className="bg-indigo-600 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2"><FiGrid /> Gestion Visuelle du Stock</h3>
                        <p className="text-indigo-200 text-sm">Cliquez sur les cases blanches pour ajouter les tickets au créneau.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-indigo-700/50 p-2 rounded-lg">
                        <span className="text-sm font-medium">Afficher de :</span>
                        <input type="number" value={gridRange.start} onChange={(e) => setGridRange(p => ({...p, start: parseInt(e.target.value) || 1}))} className="w-20 px-2 py-1 rounded text-slate-900 font-bold outline-none" />
                        <span className="text-sm font-medium">à</span>
                        <input type="number" value={gridRange.end} onChange={(e) => setGridRange(p => ({...p, end: parseInt(e.target.value) || 500}))} className="w-20 px-2 py-1 rounded text-slate-900 font-bold outline-none" />
                    </div>
                    <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><FiX className="text-2xl"/></button>
                </div>

                {/* LÉGENDE */}
                <div className="bg-slate-50 dark:bg-slate-900 p-3 flex flex-wrap gap-4 justify-center border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500"></div><span className="text-sm text-slate-600 dark:text-slate-300">Vendu (Bloqué)</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-orange-400"></div><span className="text-sm text-slate-600 dark:text-slate-300">En Stock (Déjà attribué)</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border border-slate-300 bg-white"></div><span className="text-sm text-slate-600 dark:text-slate-300">Libre (Sélectionnable)</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-500"></div><span className="text-sm text-slate-600 dark:text-slate-300">À Ajouter</span></div>
                </div>

                {/* GRILLE SCROLLABLE */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/50">
                    {loadingGrid ? (
                         <div className="flex h-full items-center justify-center"><div className="animate-spin text-4xl text-indigo-500"><FiGrid/></div></div>
                    ) : (
                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                            {gridNumbers.map(num => {
                                const state = getTicketState(num);
                                let btnClass = "py-2 px-1 rounded text-sm font-bold font-mono transition-all border shadow-sm ";
                                
                                if (state === 'sold') btnClass += "bg-red-500 text-white border-red-600 opacity-50 cursor-not-allowed";
                                else if (state === 'stock') btnClass += "bg-orange-400 text-white border-orange-500 opacity-60 cursor-not-allowed";
                                else if (state === 'selected') btnClass += "bg-emerald-500 text-white border-emerald-600 transform scale-110 shadow-emerald-500/30 ring-2 ring-emerald-300 z-10";
                                else btnClass += "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md cursor-pointer";

                                return (
                                    <button 
                                        key={num} 
                                        onClick={() => handleTicketClick(num)}
                                        className={btnClass}
                                        title={state === 'sold' ? 'Vendu' : state === 'stock' ? 'Déjà en stock' : 'Disponible'}
                                    >
                                        {num}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 flex justify-between items-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        <strong className="text-emerald-600 dark:text-emerald-400 text-lg">{selectedForAdd.length}</strong> ticket(s) sélectionné(s)
                    </p>
                    <button 
                        onClick={confirmGridAdd} 
                        disabled={selectedForAdd.length === 0}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all"
                    >
                        Confirmer l'ajout
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL DÉTAILS LISTE (Reste identique mais incluse pour compilation) --- */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-slate-700">
                
                {/* LISTE GAUCHE */}
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

                {/* INFO DROITE */}
                <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-800">
                    <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><FiX className="text-xl"/></button>
                    <div className="p-8 flex-1 flex flex-col justify-center items-center">
                        {selectedTicketInfo ? (
                            selectedTicketInfo.statut === 'disponible' ? (
                                <div className="text-center space-y-4">
                                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-4"><FiCheck /></div>
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Ticket #{selectedTicketInfo.ticket_num}</h2>
                                    <p className="text-slate-500">Ce ticket est actuellement en stock et disponible à la vente.</p>
                                    <button onClick={() => removeTicket(selectedTicketInfo.ticket_num)} className="mt-6 px-6 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center gap-2 mx-auto"><FiXCircle /> Retirer du stock</button>
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
                                            <div><p className="text-xs text-slate-400 uppercase font-bold">Client</p><p className="font-bold text-lg text-slate-800 dark:text-white">{selectedTicketInfo.contact_last_name} {selectedTicketInfo.contact_first_name}</p></div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="text-center text-slate-400"><FiInfo className="text-6xl mx-auto mb-4 opacity-20" /><p>Sélectionnez un ticket dans la liste<br/>pour voir les détails.</p></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}