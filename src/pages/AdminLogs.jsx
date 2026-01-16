import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiActivity, FiSearch, FiFilter, FiAlertTriangle, FiCheckCircle, 
  FiDollarSign, FiBox, FiUser, FiSettings, FiRefreshCw 
} from "react-icons/fi";

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("TOUS");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
    
    // Écoute temps réel (pour voir les actions en direct !)
    const sub = supabase
      .channel('global_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("global_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100); // On charge les 100 derniers

    if (!error) setLogs(data || []);
    setLoading(false);
  }

  // --- FILTRAGE ---
  const filteredLogs = logs.filter(log => {
    const matchCat = filterCategory === "TOUS" ? true : log.category === filterCategory;
    const matchSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  // --- DESIGN HELPERS ---
  const getIcon = (cat) => {
    switch(cat) {
      case 'CAISSE': return <FiDollarSign className="text-green-500" />;
      case 'STOCK': return <FiBox className="text-blue-500" />;
      case 'AUTH': return <FiUser className="text-purple-500" />;
      case 'CONFIG': return <FiSettings className="text-gray-500" />;
      case 'ERREUR': return <FiAlertTriangle className="text-red-500" />;
      default: return <FiActivity className="text-indigo-500" />;
    }
  };

  const getColor = (action) => {
    if (action.includes('DELETE') || action.includes('SUPPRESSION') || action.includes('ANNULATION')) return "bg-red-50 border-red-200 text-red-700";
    if (action.includes('AJOUT') || action.includes('CREATION')) return "bg-green-50 border-green-200 text-green-700";
    if (action.includes('MODIF')) return "bg-orange-50 border-orange-200 text-orange-700";
    return "bg-white border-slate-200 text-slate-700";
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FiActivity className="text-indigo-600" />
            Logs & Surveillance
          </h1>
          <p className="text-slate-500 text-sm">Historique complet des actions (Boîte Noire).</p>
        </div>
        <button onClick={fetchLogs} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><FiRefreshCw/></button>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
                type="text" 
                placeholder="Chercher un utilisateur, une action..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {['TOUS', 'CAISSE', 'STOCK', 'COMMANDE', 'AUTH', 'CONFIG', 'ERREUR'].map(cat => (
                <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        filterCategory === cat 
                        ? "bg-indigo-600 text-white shadow-md" 
                        : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>
      </div>

      {/* Liste des Logs */}
      <div className="space-y-3">
        {loading ? <div className="text-center py-10">Chargement...</div> : 
         filteredLogs.length === 0 ? <div className="text-center py-10 text-slate-400">Aucun log trouvé.</div> :
         filteredLogs.map(log => (
            <div key={log.id} className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:shadow-md transition-all ${getColor(log.action)}`}>
                
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/80 rounded-full shadow-sm text-xl">
                        {getIcon(log.category)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm uppercase tracking-wide opacity-70">{log.category}</span>
                            <span className="text-[10px] bg-slate-900/10 px-2 py-0.5 rounded font-mono">{log.action}</span>
                        </div>
                        <p className="font-bold text-base">{log.details}</p>
                        <p className="text-xs opacity-70 mt-1">
                            Par <span className="font-semibold">{log.user_email}</span> ({log.role})
                        </p>
                    </div>
                </div>

                <div className="text-right min-w-[150px]">
                    <div className="text-xs font-mono font-semibold opacity-60">
                        {new Date(log.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs font-mono font-bold opacity-80">
                        {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                    {/* Affichage Metadata si dispo */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 text-[10px] bg-black/5 p-1 rounded font-mono break-all max-w-[200px]">
                            {JSON.stringify(log.metadata).slice(0, 50)}...
                        </div>
                    )}
                </div>

            </div>
        ))}
      </div>

    </div>
  );
}