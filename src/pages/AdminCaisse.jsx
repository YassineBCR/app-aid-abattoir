import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FiDollarSign, FiCreditCard, FiFileText, FiDownload, FiUser, FiCalendar, FiSmartphone } from "react-icons/fi";

export default function AdminCaisse() {
  const [encaissements, setEncaissements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Totaux par moyen de paiement
  const [totaux, setTotaux] = useState({ stripe: 0, especes: 0, cb: 0, cheque: 0 });

  useEffect(() => {
    fetchEncaissements();
    
    // Rafraîchissement en direct dès qu'un vendeur encaisse au guichet
    const sub = supabase.channel('caisse_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'encaissements' }, () => fetchEncaissements())
      // Et on écoute aussi les paiements Stripe (qui mettent à jour la table commandes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, () => fetchEncaissements())
      .subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchEncaissements() {
    setLoading(true);
    try {
      // 1. Récupérer TOUS les encaissements manuels (Guichet)
      const { data: caisseData, error: caisseErr } = await supabase
        .from("encaissements")
        .select(`
          id, montant, moyen_paiement, reference, created_at,
          vendeur_id,
          profiles:vendeur_id(email),
          commandes:commande_id(ticket_num, contact_last_name)
        `)
        .order("created_at", { ascending: false });

      if (caisseErr) throw caisseErr;

      // 2. Récupérer TOUS les acomptes Stripe (qui sont stockés dans la table commandes)
      const { data: stripeData, error: stripeErr } = await supabase
        .from("commandes")
        .select(`id, acompte_cents, ticket_num, contact_last_name, created_at`)
        .in("statut", ["acompte_paye", "en_attente_caisse", "paye_integralement"]);

      if (stripeErr) throw stripeErr;

      // 3. On reformate et on fusionne les deux listes
      let tousPaiements = [];

      // Ajout des encaissements guichet
      if (caisseData) {
        caisseData.forEach(e => {
            tousPaiements.push({
                id: e.id,
                date: new Date(e.created_at),
                montant: e.montant,
                moyen: e.moyen_paiement, // 'especes', 'cb', 'cheque'
                ticket: e.commandes?.ticket_num || "?",
                client: e.commandes?.contact_last_name || "Inconnu",
                vendeur: e.profiles?.email || "Système"
            });
        });
      }

      // Ajout des paiements Stripe (Acomptes initiaux)
      if (stripeData) {
        stripeData.forEach(c => {
            tousPaiements.push({
                id: `stripe_${c.id}`,
                date: new Date(c.created_at), // La date exacte du paiement Stripe
                montant: c.acompte_cents / 100,
                moyen: 'stripe',
                ticket: c.ticket_num || "?",
                client: c.contact_last_name || "Inconnu",
                vendeur: "Paiement en ligne"
            });
        });
      }

      // 4. On trie tout par date (du plus récent au plus ancien)
      tousPaiements.sort((a, b) => b.date - a.date);
      setEncaissements(tousPaiements);

      // 5. Calcul des totaux par catégorie
      let sums = { stripe: 0, especes: 0, cb: 0, cheque: 0 };
      tousPaiements.forEach(p => {
          if (sums[p.moyen] !== undefined) {
              sums[p.moyen] += p.montant;
          }
      });
      setTotaux(sums);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Icône et couleur selon le moyen de paiement
  const getBadgeStyle = (moyen) => {
    switch(moyen) {
        case 'stripe': return { icon: <FiSmartphone />, color: "bg-purple-100 text-purple-700 border-purple-200", label: "Stripe (Site)" };
        case 'especes': return { icon: <FiDollarSign />, color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Espèces" };
        case 'cb': return { icon: <FiCreditCard />, color: "bg-blue-100 text-blue-700 border-blue-200", label: "Carte Bancaire" };
        case 'cheque': return { icon: <FiFileText />, color: "bg-orange-100 text-orange-700 border-orange-200", label: "Chèque" };
        default: return { icon: <FiFileText />, color: "bg-slate-100 text-slate-700 border-slate-200", label: moyen };
    }
  };

  const grandTotal = totaux.stripe + totaux.especes + totaux.cb + totaux.cheque;

  const exportToCSV = () => {
    const headers = ["Date", "Heure", "Ticket", "Client", "Moyen de paiement", "Montant", "Encaissé par"];
    const rows = encaissements.map(e => [
        e.date.toLocaleDateString('fr-FR'),
        e.date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
        e.ticket,
        e.client,
        e.moyen.toUpperCase(),
        `${e.montant.toFixed(2)} €`,
        e.vendeur
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Z_de_Caisse_Abattoir.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FiDollarSign className="text-yellow-600" /> Grand Livre de Caisse
          </h2>
          <p className="text-slate-500 text-sm mt-1">Historique complet de toutes les transactions financières (Site & Guichet).</p>
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-bold text-sm">
          <FiDownload /> Exporter Z de caisse
        </button>
      </div>

      {/* BLOCS DE TOTAUX (Z DE CAISSE) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase">Stripe (Site)</p>
            <p className="text-2xl font-black text-purple-600 mt-1">{totaux.stripe.toFixed(2)} €</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase">Espèces (Guichet)</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totaux.especes.toFixed(2)} €</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase">CB (Guichet)</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{totaux.cb.toFixed(2)} €</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase">Chèque (Guichet)</p>
            <p className="text-2xl font-black text-orange-600 mt-1">{totaux.cheque.toFixed(2)} €</p>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl shadow-sm col-span-2 lg:col-span-1">
            <p className="text-xs font-bold text-slate-400 uppercase">Chiffre d'Affaires Global</p>
            <p className="text-2xl font-black text-white mt-1">{grandTotal.toFixed(2)} €</p>
        </div>
      </div>

      {/* TABLEAU DES TRANSACTIONS */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Date & Heure</th>
                <th className="p-4">Dossier</th>
                <th className="p-4">Moyen de paiement</th>
                <th className="p-4">Caissier / Origine</th>
                <th className="p-4 text-right">Montant Encaissé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400 animate-pulse">Chargement de la caisse...</td></tr>
              ) : encaissements.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400">Aucune transaction pour le moment.</td></tr>
              ) : (
                encaissements.map((enc) => {
                  const style = getBadgeStyle(enc.moyen);
                  return (
                    <tr key={enc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                            <FiCalendar className="text-slate-400" /> {enc.date.toLocaleDateString('fr-FR')}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 ml-6">{enc.date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      
                      <td className="p-4">
                        <p className="font-bold text-slate-800 dark:text-white">Ticket #{enc.ticket}</p>
                        <p className="text-xs text-slate-500">{enc.client}</p>
                      </td>
                      
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${style.color}`}>
                          {style.icon} {style.label}
                        </span>
                      </td>

                      <td className="p-4">
                        {enc.moyen === 'stripe' ? (
                            <span className="text-purple-600 font-bold text-xs bg-purple-50 px-2 py-1 rounded">Paiement Automatique Site</span>
                        ) : (
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs font-bold"><FiUser /> {enc.vendeur.split('@')[0]}</span>
                        )}
                      </td>

                      <td className="p-4 text-right font-black text-lg text-slate-800 dark:text-white">
                        + {enc.montant.toFixed(2)} €
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}