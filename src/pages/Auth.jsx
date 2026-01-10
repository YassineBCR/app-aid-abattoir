import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setMessage(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Compte créé ✅ Tu peux maintenant te connecter.");
        setMode("login");
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="border rounded-2xl p-6 shadow w-full max-w-md space-y-5">
        <div className="text-2xl font-bold text-center">
          {mode === "login" ? "Connexion" : "Inscription"}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Adresse email"
            className="border rounded-xl p-3 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            required
            placeholder="Mot de passe"
            className="border rounded-xl p-3 w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* ✅ Bouton principal */}
          <button
            type="submit"
            disabled={loading}
            className="border rounded-xl p-3 w-full font-semibold"
          >
            {loading
              ? "Chargement…"
              : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>
        </form>

        {message && (
          <div className="text-sm text-center opacity-80">{message}</div>
        )}

        {/* ✅ Bouton secondaire clair */}
        <div className="text-center">
          {mode === "login" ? (
            <button
              onClick={() => setMode("register")}
              className="border rounded-xl px-4 py-2 text-sm"
            >
              Créer un compte
            </button>
          ) : (
            <button
              onClick={() => setMode("login")}
              className="border rounded-xl px-4 py-2 text-sm"
            >
              Se connecter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
