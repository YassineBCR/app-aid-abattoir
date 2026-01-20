import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PaiementOk from "./pages/PaiementOk"; 
import PaiementAnnule from "./pages/PaiementAnnule";
import MockPay from "./pages/Mockpay"; 
import UpdatePassword from "./pages/UpdatePassword"; 
import Bouclage from "./pages/Bouclage";
import Account from "./pages/Account";


// import Navbar from "./components/Navbar"; // Décommente quand tu voudras le menu

function AppRoutes() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    // Pages accessibles sans vérification stricte
    const isPublicPage = 
      location.pathname.startsWith("/paiement") || 
      location.pathname.startsWith("/mock-pay") ||
      location.pathname === "/update-password";

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
        // NOTE: On NE redirige PAS automatiquement vers dashboard ici
        // pour laisser l'utilisateur sur la page d'accueil s'il le souhaite.
      } else {
        setSession(null);
        // Sécurité : Si on essaie d'aller sur dashboard sans être connecté, on renvoie à l'accueil
        if (!isPublicPage && location.pathname.startsWith("/dashboard")) {
          navigate("/", { replace: true });
        }
      }
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      
      const isPublicNow = 
        location.pathname.startsWith("/paiement") || 
        location.pathname.startsWith("/mock-pay") ||
        location.pathname === "/update-password";

      if (!isPublicNow) {
        // Si on se déconnecte alors qu'on était sur le dashboard -> Hop accueil
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
        <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {/* <Navbar session={session} /> */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/paiement-ok" element={<PaiementOk />} />
        <Route path="/paiement-annule" element={<PaiementAnnule />} />
        <Route path="/mock-pay" element={<MockPay />} />
        <Route path="/bouclage" element={<Bouclage />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </>
  );
}

export default AppRoutes;