import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
// 👇 CORRECTION DES NOMS (Respect des majuscules/minuscules)
import PaiementOk from "./pages/PaiementOk"; 
import PaiementAnnule from "./pages/PaiementAnnule";
import MockPay from "./pages/Mockpay"; 

function AppRoutes() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    // On liste les pages qui ne nécessitent pas de redirection de sécurité
    const isPaiementLike =
      location.pathname.startsWith("/paiement") || location.pathname.startsWith("/mock-pay");

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
        // Si connecté et sur Accueil/Auth -> Go Dashboard (Sauf si on est en paiement)
        if (!isPaiementLike) {
          if (location.pathname === "/" || location.pathname === "/auth") {
            navigate("/dashboard", { replace: true });
          }
        }
      } else {
        setSession(null);
        // Si PAS connecté et sur Dashboard -> Go Accueil
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
      
      // On revérifie la sécurité au changement de session
      const isPaiementLikeNow =
        location.pathname.startsWith("/paiement") || location.pathname.startsWith("/mock-pay");

      if (!isPaiementLikeNow) {
        if (newSession && (location.pathname === "/" || location.pathname === "/auth")) {
          navigate("/dashboard", { replace: true });
        } else if (!newSession && location.pathname.startsWith("/dashboard")) {
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
    return <div className="min-h-screen flex items-center justify-center">Chargement…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Home onLogin={() => navigate("/auth")} />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard/*" element={<Dashboard />} />
      <Route path="/paiement-ok" element={<PaiementOk />} />
      <Route path="/paiement-annule" element={<PaiementAnnule />} />
      <Route path="/mock-pay" element={<MockPay />} />
    </Routes>
  );
}

export default AppRoutes;