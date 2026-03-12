import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiActivity, FiSearch, FiClock, FiUser, FiDatabase, FiPlusCircle, 
  FiEdit3, FiTrash2, FiDownload, FiInfo, FiLayers, FiX
} from "react-icons/fi";

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();

    // Écoute en temps réel des nouveaux logs
    const sub = supabase.channel('realtime_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'action_logs' }, (payload) => {
        setLogs((current) => [payload.new, ...current]);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500); // On limite aux 500 derniers pour la performance

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Erreur chargement logs:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- FILTRES ---
  const filteredLogs = logs.filter(log => {
    const matchSearch = 
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchType = filterType === "ALL" || log.entity_type === filterType;

    return matchSearch && matchType;
  });

  // --- DESIGN DES BADGES ---
  const getActionStyle = (action) => {
      switch (action) {
          case 'CREATION': return { icon: <FiPlusCircle/>, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
          case 'MODIFICATION': return { icon: <FiEdit3/>, color: 'text-blue-600 bg-blue-50 border-blue-200' };
          case 'SUPPRESSION': return { icon: <FiTrash2/>, color: 'text-red-600 bg-red-50 border-red-200' };
          case 'EXPORT': return { icon: <FiDownload/>, color: 'text-purple-600 bg-purple-50 border-purple-200' };
          default: return { icon: <FiInfo/>, color: 'text-slate-600 bg-slate-100 border-slate-200' };
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in">
      
      {/* HEADER & FILTRES */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-slate-700 rounded-2xl text-white shadow-lg shadow-slate-500/30"><FiActivity className="text-2xl" /></div>
            Traçabilité & Sécurité
          </h2>
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Historique complet des actions effectuées par les utilisateurs sur le système.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl flex items-center shadow-sm border border-slate-200 dark:border-slate-700">
            {['ALL', 'COMMANDE', 'CAISSE', 'STOCK', 'SYSTEME'].map(type => (
                <button 
                    key={type} onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterType === type ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    {type === 'ALL' ? 'Tous' : type}
                </button>
            ))}
          </div>
          
          <div className="relative flex-1 sm:w-64 group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-800 transition-colors text-lg" />
            <input 
                type="text" placeholder="Rechercher (email, action, ticket...)" 
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-medium dark:text-white" 
            />
          </div>
        </div>
      </div>

      {/* TABLEAU DES LOGS */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="p-5">Date & Heure</th>
                <th className="p-5">Utilisateur</th>
                <th className="p-5">Action</th>
                <th className="p-5">Module</th>
                <th className="p-5">Aperçu Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold animate-pulse">Scan des registres en cours...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="p-12 text-center text-slate-400">Aucun log trouvé pour cette recherche.</td></tr>
              ) : (
                filteredLogs.map(log => {
                  const style = getActionStyle(log.action_type);

                  return (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer group"
                    >
                      <td className="p-5">
                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><FiClock className="text-slate-400"/> {new Date(log.created_at).toLocaleDateString('fr-FR')}</div>
                        <div className="text-xs text-slate-500 mt-1 ml-5">{new Date(log.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</div>
                      </td>
                      <td className="p-5">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                            <FiUser className="text-slate-400"/> {log.user_email}
                        </span>
                      </td>
                      <td className="p-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border shadow-sm ${style.color}`}>
                              {style.icon} {log.action_type}
                          </span>
                      </td>
                      <td className="p-5">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold tracking-wider">
                              {log.entity_type}
                          </span>
                      </td>
                      <td className="p-5 text-xs text-slate-500 font-mono truncate max-w-[250px]">
                          {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL DE DETAILS DU LOG ================= */}
      {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                  
                  <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                      <div className="flex items-center gap-3">
                          <FiDatabase className="text-2xl text-slate-400" />
                          <div>
                              <h3 className="text-xl font-black">Détails de l'action</h3>
                              <p className="text-slate-400 text-xs font-mono mt-1">ID: {selectedLog.id}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedLog(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><FiX className="text-xl"/></button>
                  </div>

                  <div className="p-6 md:p-8 space-y-6">
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Date & Heure</p>
                              <p className="font-bold text-slate-800 dark:text-white">{new Date(selectedLog.created_at).toLocaleString('fr-FR')}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Utilisateur</p>
                              <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiUser className="text-slate-400"/>{selectedLog.user_email}</p>
                          </div>
                      </div>

                      <div className="flex items-center gap-4 py-4 border-y border-slate-100 dark:border-slate-700">
                          <div className="flex-1">
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Type d'action</p>
                              <p className="font-black text-lg text-slate-800 dark:text-white">{selectedLog.action_type}</p>
                          </div>
                          <div className="w-px h-10 bg-slate-200 dark:bg-slate-700"></div>
                          <div className="flex-1 pl-4">
                              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Module ciblé</p>
                              <p className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><FiLayers/> {selectedLog.entity_type}</p>
                          </div>
                      </div>

                      <div>
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Payload (Données JSON transmises)</p>
                          <div className="bg-slate-900 p-4 rounded-2xl overflow-x-auto shadow-inner border border-slate-800">
                              <pre className="text-emerald-400 text-sm font-mono whitespace-pre-wrap">
                                  {JSON.stringify(selectedLog.details, null, 2)}
                              </pre>
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      )}

    </div>
  );
}