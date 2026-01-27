import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";
import { supabase } from "../lib/supabase";
import { FiLock, FiCreditCard, FiCheckCircle, FiAlertCircle, FiArrowLeft, FiLoader, FiShield } from "react-icons/fi";

const customStyles = `
  @keyframes blob { 
    0% { transform: translate(0px, 0px) scale(1); } 
    33% { transform: translate(30px, -50px) scale(1.1); } 
    66% { transform: translate(-20px, 20px) scale(0.9); } 
    100% { transform: translate(0px, 0px) scale(1); } 
  }
  .animate-blob { animation: blob 7s infinite; }
  
  .glass-panel { 
    background: rgba(255, 255, 255, 0.85); 
    backdrop-filter: blur(20px); 
    border: 1px solid rgba(255, 255, 255, 0.3); 
  }
  .dark .glass-panel { 
    background: rgba(15, 23, 42, 0.8); 
    border: 1px solid rgba(255, 255, 255, 0.1); 
  }
  
  #yavin-container {
    min-height: 400px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;

const BlobBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
    <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
    <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
  </div>
);

export default function PaiementYavin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode } = useDarkMode();
  
  const state = location.state || {};
  const { commandeId, ticketNum, montant, clientEmail } = state;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!commandeId) {
      setTimeout(() => navigate('/reservation'), 100);
    }
  }, [commandeId, navigate]);

  useEffect(() => {
    if (!commandeId) return;

    const initYavin = async () => {
      try {
        console.log("--> Démarrage paiement...");

        const { data, error } = await supabase.functions.invoke('create-yavin-payment', {
          body: { 
            amount: montant / 100,
            email: clientEmail, 
            ref: commandeId 
          }
        });

        if (error) throw new Error(`Erreur connexion serveur : ${error.message}`);
        if (data && data.error) throw new Error(data.error);
        if (!data || !data.token) throw new Error("Token de paiement manquant.");

        const paymentToken = data.token;
        const YavinSDK = window.Yavin || window.yavin;

        if (!YavinSDK) throw new Error("Le script Yavin n'est pas chargé.");

        setLoading(false);

        const yavinWidget = new YavinSDK({
            token: paymentToken,
            elementId: 'yavin-container',
            style: { height: '400px' },
            onSuccess: (result) => handleSuccess(result),
            onError: (err) => {
                console.error("Erreur Widget:", err);
                setStatus("error");
                setErrorMessage("Le paiement a été refusé ou annulé.");
            }
        });

        if (yavinWidget && typeof yavinWidget.mount === 'function') {
            yavinWidget.mount('#yavin-container');
        }

      } catch (err) {
        console.error("EXCEPTION CRITIQUE:", err);
        setLoading(false);
        setStatus("error");
        setErrorMessage(err.message || "Erreur technique inconnue.");
      }
    };

    initYavin();
  }, [commandeId, montant, clientEmail]);

  const handleSuccess = async (result) => {
    console.log("--> Paiement Succès:", result);
    setStatus("success");
    
    // ON GARDE LE STATUT ACOMPTE_PAYE
    const { error } = await supabase.from('commandes')
        .update({ statut: 'acompte_paye', date_paiement: new Date() })
        .eq('id', commandeId);

    if (error) console.error("Erreur update DB:", error);

    setTimeout(() => navigate('/dashboard'), 3000);
  };

  if (!commandeId) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center"><FiLoader className="animate-spin text-3xl text-slate-500"/></div>;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 flex flex-col items-center justify-center p-4 ${darkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
      <style>{customStyles}</style>
      <BlobBackground />

      <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-center gap-2 mb-6 text-slate-500 dark:text-slate-400 text-sm font-medium">
          <FiLock className="text-green-500" /> Paiement sécurisé SSL
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900 text-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10 flex justify-between">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Montant à régler</p>
                <h1 className="text-4xl font-black mt-1">{(montant / 100).toFixed(2)} €</h1>
              </div>
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                <FiCreditCard className="text-2xl" />
              </div>
            </div>
            <div className="mt-6 flex gap-3 text-sm text-slate-300">
                <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded text-xs font-bold border border-green-500/30">ACOMPTE</span>
                <span>Ticket #{ticketNum}</span>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-800 transition-colors min-h-[300px] flex flex-col justify-center">
            {loading && (
                <div className="flex flex-col items-center justify-center space-y-4 py-10">
                    <FiLoader className="text-4xl text-green-500 animate-spin" />
                    <p className="text-sm text-slate-500">Initialisation du paiement...</p>
                </div>
            )}

            <div id="yavin-container" style={{ display: (!loading && status === "pending") ? 'flex' : 'none' }}></div>

            {status === "success" && (
                <div className="text-center py-10 animate-in fade-in zoom-in">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl"><FiCheckCircle /></div>
                    <h3 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">Paiement Accepté !</h3>
                    <p className="text-slate-500">Votre réservation est enregistrée.</p>
                    <p className="text-xs text-slate-400 mt-4">Redirection vers votre espace...</p>
                </div>
            )}

            {status === "error" && (
                <div className="text-center py-10 animate-in fade-in zoom-in">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl"><FiAlertCircle /></div>
                    <h3 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">Problème détecté</h3>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800 mb-6 mx-auto max-w-xs">
                        <p className="text-red-600 dark:text-red-300 text-sm font-medium breaking-words">{errorMessage}</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">Réessayer</button>
                </div>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 text-center border-t border-slate-200 dark:border-slate-800">
             <p className="text-xs text-slate-400 flex items-center justify-center gap-1"><FiShield /> Powered by Yavin</p>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="mt-8 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-sm font-bold w-full transition-colors"><FiArrowLeft /> Annuler la transaction</button>
      </div>
    </div>
  );
}