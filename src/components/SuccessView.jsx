import { CheckCircle, MapPin, Calendar, Banknote } from 'lucide-react';

const DAY_LABELS = {
  j1: "Lendemain de l'A\u00efd (J+1) \u2014 Samedi 7 Juin",
  j2: "Sur-lendemain de l'A\u00efd (J+2) \u2014 Dimanche 8 Juin",
};

export default function SuccessView({ deliveryDay, address }) {
  const fullAddress = [
    address.rue,
    `${address.codePostal} ${address.ville}`,
    address.complement,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 flex flex-col items-center animate-fade-in">
      {/* Animated check icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center animate-scale-in">
          <CheckCircle className="w-10 h-10 text-brand-600" strokeWidth={2} />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-brand-300 animate-ping opacity-30" />
      </div>

      <h1 className="text-2xl font-bold text-stone-900 text-center text-balance">
        {"Commande valid\u00e9e\u00a0!"}
      </h1>
      <p className="mt-2 text-sm text-stone-500 text-center max-w-xs">
        {"Votre commande a bien \u00e9t\u00e9 enregistr\u00e9e. Pr\u00e9parez 200\u00a0\u20ac pour le livreur."}
      </p>

      <div className="mt-8 w-full section-card flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">Jour de livraison</p>
            <p className="text-sm font-semibold text-stone-900 mt-0.5">
              {DAY_LABELS[deliveryDay] || deliveryDay}
            </p>
          </div>
        </div>

        <div className="h-px bg-stone-100" />

        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">Adresse</p>
            <p className="text-sm font-semibold text-stone-900 mt-0.5">{fullAddress}</p>
          </div>
        </div>

        <div className="h-px bg-stone-100" />

        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700 shrink-0">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">{"Reste \u00e0 payer"}</p>
            <p className="text-sm font-semibold text-stone-900 mt-0.5">
              {"200\u00a0\u20ac en esp\u00e8ces \u00e0 la livraison"}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-stone-400 text-center">
        {"Un email de confirmation vous a \u00e9t\u00e9 envoy\u00e9."}
      </p>
    </div>
  );
}
