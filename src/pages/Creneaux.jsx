import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiClock, FiUsers, FiEdit3, FiSave, FiX, FiCheckCircle, FiAlertTriangle, FiPlus, FiTrash2, FiPieChart, FiEye, FiSearch, FiPrinter, FiPhone, FiFileText
} from "react-icons/fi";
import { useNotification } from "../contexts/NotificationContext";

export default function Creneaux() {
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  
  // --- ÉTATS MODALE ÉDITION ---
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ heure_debut: "", heure_fin: "", quota: 50 });
  
  // --- ÉTATS MODALE DÉTAILS (CONSULTATION) ---
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotOrders, setSlotOrders] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Stats globales
  const [stats, setStats] = useState({ totalQuota: 0, totalResa: 0, percent: 0 });

  // --- CHARGEMENT DES DONNÉES & REALTIME ---
  const fetchCreneaux = async () => {
    try {
      // 1. Récupérer les créneaux
      const { data: slots, error } = await supabase
        .from("creneaux_horaires")
        .select("*")
        .order("heure_debut", { ascending: true });

      if (error) throw error;

      // 2. Compter les réservations
      const slotsWithCounts = await Promise.all(slots.map(async (slot) => {
          const { count } = await supabase
            .from("commandes")
            .select("*", { count: 'exact', head: true })
            .eq("creneau_id", slot.id);
          
          return { ...slot, remplissage: count || 0 };
      }));

      // 3. Calculs Globaux
      const totQuota = slotsWithCounts.reduce((acc, curr) => acc + (curr.quota || 0), 0);
      const totResa = slotsWithCounts.reduce((acc, curr) => acc + (curr.remplissage || 0), 0);
      
      setStats({
          totalQuota: totQuota,
          totalResa: totResa,
          percent: totQuota > 0 ? Math.round((totResa / totQuota) * 100) : 0
      });

      setCreneaux(slotsWithCounts);
    } catch (error) {
      console.error(error);
      showNotification("Erreur de synchronisation", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreneaux();
    const sub = supabase.channel('creneaux-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => fetchCreneaux())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creneaux_horaires' }, () => fetchCreneaux())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  // --- LOGIQUE DÉTAILS (NOUVEAU) ---
  const openDetails = async (slot) => {
      setSelectedSlot(slot);
      setDetailLoading(true);
      setShowDetailModal(true);
      setSearchTerm("");

      try {
          const { data, error } = await supabase
              .from("commandes")
              .select("*")
              .eq("creneau_id", slot.id)
              .order("ticket_num", { ascending: true });

          if (error) throw error;
          setSlotOrders(data || []);
      } catch (err) {
          showNotification("Impossible de charger les détails", "error");
      } finally {
          setDetailLoading(false);
      }
  };

  const handlePrintList = () => {
      window.print();
  };

  // --- LOGIQUE ÉDITION ---
  const openModal = (creneau = null) => {
      if (creneau) {
          setEditingId(creneau.id);
          setFormData({ heure_debut: creneau.heure_debut, heure_fin: creneau.heure_fin, quota: creneau.quota });
      } else {
          setEditingId(null);
          setFormData({ heure_debut: "", heure_fin: "", quota: 50 });
      }
      setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.heure_debut >= formData.heure_fin) return showNotification("L'heure de fin doit être après l'heure de début.", "error");

    try {
      if (editingId) {
          const { error } = await supabase.from("creneaux_horaires").update(formData).eq("id", editingId);
          if (error) throw error;
          showNotification("Créneau mis à jour", "success");
      } else {
          const { error } = await supabase.from("creneaux_horaires").insert([formData]);
          if (error) throw error;
          showNotification("Créneau créé", "success");
      }
      setShowModal(false);
      fetchCreneaux();
    } catch (error) {
      showNotification("Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Supprimer ce créneau ?")) return;
      try {
          const { error } = await supabase.from("creneaux_horaires").delete().eq("id", id);
          if(error) throw error;
          showNotification("Créneau supprimé", "success");
          fetchCreneaux();
      } catch(err) {
          showNotification("Impossible de supprimer (Commandes actives ?)", "error");
      }
  };

  // Helper pour statut paiement
  const getStatusBadge = (cmd) => {
      const total = cmd.montant_total_cents || 0;
      const paye = cmd.montant_paye_cents || 0;
      
      if (paye >= total && total > 0) return <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold border border-green-200">Payé</span>;
      if (paye > 0) return <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">Acompte</span>;
      return <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">À Payer</span>;
  };

  // Filtrage liste détails
  const filteredOrders = slotOrders.filter(o => 
      o.contact_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.ticket_num?.toString().includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      
      {/* HEADER & DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
          <div className="lg:col-span-2 flex flex-col justify-center">
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl text-white shadow-xl shadow-blue-500/30">
                        <FiClock className="text-3xl" />
                    </div>
                    Gestion des Créneaux
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-lg ml-1">
                    Planification horaire et contrôle des accès.
                </p>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-white/20 transition-all"></div>
              <div className="flex justify-between items-start relative z-10">
                  <div>
                      <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Capacité Journalière</p>
                      <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-black">{stats.totalResa}</span>
                          <span className="text-slate-400 font-medium">/ {stats.totalQuota} Agneaux</span>
                      </div>
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm"><FiPieChart className="text-2xl"/></div>
              </div>
              <div className="mt-4 relative z-10">
                  <div className="flex justify-between text-xs font-bold mb-1">
                      <span>Taux d'occupation</span>
                      <span>{stats.percent}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ease-out ${stats.percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${stats.percent}%`}}></div>
                  </div>
              </div>
          </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700 print:hidden"></div>

      {/* BOUTON AJOUT */}
      <div className="flex justify-end print:hidden">
          <button onClick={() => openModal()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95">
              <FiPlus className="text-xl" /> Nouveau Créneau
          </button>
      </div>

      {/* GRID DES CRÉNEAUX */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:hidden">
        {loading ? (
            <p className="col-span-full text-center py-10 text-slate-400 animate-pulse">Chargement des données en temps réel...</p>
        ) : creneaux.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <FiClock className="mx-auto text-4xl text-slate-300 mb-4"/>
                <p className="text-slate-500 font-medium">Aucun créneau configuré.</p>
            </div>
        ) : creneaux.map((c) => {
            const percent = Math.min(100, (c.remplissage / (c.quota || 1)) * 100);
            
            let statusColor = "bg-emerald-500";
            let statusText = "Disponible";
            let statusBg = "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400";
            
            if(percent >= 100) {
                statusColor = "bg-slate-800 dark:bg-slate-200";
                statusText = "COMPLET";
                statusBg = "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
            } else if (percent > 85) {
                statusColor = "bg-red-500";
                statusText = "Critique";
                statusBg = "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400";
            } else if (percent > 60) {
                statusColor = "bg-orange-500";
                statusText = "Rempli";
                statusBg = "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400";
            }

            return (
                <div key={c.id} className="group bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 relative">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusColor}`}></div>

                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                {c.heure_debut.slice(0,5)}
                                <span className="text-slate-300 mx-1 font-light">à</span>
                                {c.heure_fin.slice(0,5)}
                            </h3>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-transparent ${statusBg}`}>
                                {statusText}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    <FiUsers className="text-lg"/> Occupé
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white">{c.remplissage}</span>
                                    <span className="text-sm text-slate-400 font-bold"> / {c.quota}</span>
                                </div>
                            </div>
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                                <div className={`h-full rounded-full ${statusColor} shadow-sm transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <button onClick={() => openDetails(c)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors">
                            <FiEye /> Consulter
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => openModal(c)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><FiEdit3 /></button>
                            <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><FiTrash2 /></button>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {/* --- MODALE CRÉATION / ÉDITION --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in print:hidden">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {editingId ? <><FiEdit3/> Modifier le créneau</> : <><FiPlus/> Nouveau Créneau</>}
                    </h2>
                    <button onClick={() => setShowModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><FiX/></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Heure Début</label>
                            <input type="time" required value={formData.heure_debut} onChange={e => setFormData({...formData, heure_debut: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Heure Fin</label>
                            <input type="time" required value={formData.heure_fin} onChange={e => setFormData({...formData, heure_fin: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">Quota (Capacité) <span className="text-indigo-600">{formData.quota} pers.</span></label>
                        <div className="flex items-center gap-4">
                            <FiUsers className="text-slate-400 text-xl"/>
                            <input type="range" min="1" max="500" step="1" value={formData.quota} onChange={e => setFormData({...formData, quota: parseInt(e.target.value)})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                            <input type="number" value={formData.quota} onChange={e => setFormData({...formData, quota: parseInt(e.target.value)})} className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODALE DÉTAILS / LISTE D'ÉMARGEMENT --- */}
      {showDetailModal && selectedSlot && (
          <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200 print:bg-white print:p-0 print:block">
              <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none flex flex-col max-h-[90vh]">
                  
                  {/* HEADER MODAL */}
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center print:hidden shrink-0">
                      <div>
                          <h2 className="text-2xl font-bold flex items-center gap-2"><FiFileText /> Liste du Créneau</h2>
                          <p className="text-slate-400 font-mono text-lg">{selectedSlot.heure_debut.slice(0,5)} - {selectedSlot.heure_fin.slice(0,5)}</p>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={handlePrintList} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg"><FiPrinter/> Imprimer</button>
                          <button onClick={() => setShowDetailModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><FiX className="text-xl"/></button>
                      </div>
                  </div>

                  {/* SEARCH BAR */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 print:hidden shrink-0">
                      <div className="relative">
                          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                          <input 
                              type="text" 
                              placeholder="Rechercher un nom, un n° de ticket..." 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                      </div>
                  </div>

                  {/* HEADER PRINT (VISIBLE SEULEMENT À L'IMPRESSION) */}
                  <div className="hidden print:block p-8 border-b-2 border-black">
                      <h1 className="text-3xl font-black uppercase mb-2">LISTE DE CONTRÔLE / ÉMARGEMENT</h1>
                      <div className="flex justify-between items-end">
                          <div>
                              <p className="text-xl font-bold">CRÉNEAU : {selectedSlot.heure_debut.slice(0,5)} - {selectedSlot.heure_fin.slice(0,5)}</p>
                              <p>Date : {new Date().toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                              <p className="font-bold">Total Inscrits : {slotOrders.length}</p>
                          </div>
                      </div>
                  </div>

                  {/* LISTE SCROLLABLE */}
                  <div className="overflow-y-auto flex-1 p-0">
                      {detailLoading ? (
                          <div className="p-10 text-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div></div>
                      ) : (
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 print:static">
                                  <tr className="text-slate-500 uppercase text-xs border-b border-slate-200 dark:border-slate-700 print:border-black">
                                      <th className="p-4 print:p-2">Ticket</th>
                                      <th className="p-4 print:p-2">Client</th>
                                      <th className="p-4 print:p-2">Téléphone</th>
                                      <th className="p-4 print:p-2 text-center">Paiement</th>
                                      <th className="hidden print:table-cell p-4 print:p-2 text-center border-l border-black">Émargement</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 print:divide-slate-300">
                                  {filteredOrders.length === 0 ? (
                                      <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">Aucune commande trouvée.</td></tr>
                                  ) : filteredOrders.map(order => (
                                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 print:hover:bg-transparent">
                                          <td className="p-4 print:p-2 font-mono font-bold text-indigo-600 print:text-black">#{order.ticket_num}</td>
                                          <td className="p-4 print:p-2 font-bold text-slate-800 dark:text-white print:text-black">
                                              {order.contact_last_name} {order.contact_first_name}
                                          </td>
                                          <td className="p-4 print:p-2 text-slate-500 flex items-center gap-2 print:text-black">
                                              <FiPhone className="print:hidden"/> {order.contact_phone}
                                          </td>
                                          <td className="p-4 print:p-2 text-center">
                                              {getStatusBadge(order)}
                                          </td>
                                          <td className="hidden print:table-cell border-l border-black"></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>

                  {/* FOOTER MODAL */}
                  <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center print:hidden shrink-0">
                      <span className="text-sm font-bold text-slate-500">
                          {filteredOrders.length} résultats
                      </span>
                      <button onClick={() => setShowDetailModal(false)} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-colors">
                          Fermer
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}