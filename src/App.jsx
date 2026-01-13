import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PaiementOk from "./pages/PaiementOk"; 
import PaiementAnnule from "./pages/PaiementAnnule";
import MockPay from "./pages/Mockpay"; 

// Import de la Navbar (étape suivante) - Décommente la ligne ci-dessous quand tu as créé le fichier Navbar
import Navbar from "./components/Navbar";

function AppRoutes() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const isPaiementLike =
      location.pathname.startsWith("/paiement") || location.pathname.startsWith("/mock-pay");

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
        // --- MODIFICATION ICI : On empêche la redirection automatique vers le Dashboard ---
        // Si tu veux réactiver la redirection plus tard, décommente ce bloc :
        /*
        if (!isPaiementLike) {
          if (location.pathname === "/" || location.pathname === "/auth") {
            navigate("/dashboard", { replace: true });
          }
        }
        */
      } else {
        setSession(null);
        // Sécurité : Si PAS connecté et sur Dashboard -> Go Accueil
        if (!isPaiementLike) {
          if (location.pathname.startsWith("/dashboard")) {
            navigate("/", { replace: true });
          }
        }
      }
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      
      const isPaiementLikeNow =
        location.pathname.startsWith("/paiement") || location.pathname.startsWith("/mock-pay");

      if (!isPaiementLikeNow) {
        // --- MODIFICATION ICI AUSSI : On commente la redirection automatique ---
        /*
        if (newSession && (location.pathname === "/" || location.pathname === "/auth")) {
          navigate("/dashboard", { replace: true });
        } else 
        */
        if (!newSession && location.pathname.startsWith("/dashboard")) {
          navigate("/", { replace: true });
        }
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-green-600 font-semibold">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* C'est ici que tu placeras ta barre d'onglets plus tard */}
      {/* <Navbar session={session} /> */}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/paiement-ok" element={<PaiementOk />} />
        <Route path="/paiement-annule" element={<PaiementAnnule />} />
        <Route path="/mock-pay" element={<MockPay />} />
      </Routes>
    </>
  );
}

export default AppRoutes;