export default function Home({ onLogin }) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="border rounded-2xl p-8 shadow w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">
            Réservation Abattoir Aïd
          </h1>
  
          <p className="text-sm opacity-70">
            Réservez votre créneau, payez l’acompte et recevez votre numéro de ticket.
          </p>
  
          {/* ✅ BOUTON PRINCIPAL */}
          <button
            onClick={onLogin}
            className="border rounded-xl px-6 py-3 text-lg font-semibold w-full"
          >
            Se connecter
          </button>
  
          <p className="text-xs opacity-60">
            Accès réservé aux clients et vendeurs autorisés
          </p>
        </div>
      </div>
    );
  }
  