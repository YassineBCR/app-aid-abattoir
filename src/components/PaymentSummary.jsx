import { CreditCard, Loader2 } from 'lucide-react';

export default function PaymentSummary({ loading, onPay, disabled }) {
  return (
    <section
      className="section-card animate-fade-in border-brand-200 bg-gradient-to-b from-brand-50/50 to-white"
      style={{ animationDelay: '0.15s' }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700">
          <CreditCard className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-semibold text-stone-900">
          {"R\u00e9capitulatif"}
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600">Mouton entier</span>
          <span className="text-sm font-semibold text-stone-900">{"300\u00a0\u20ac"}</span>
        </div>

        <div className="h-px bg-stone-200" />

        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600">{"Acompte \u00e0 payer maintenant"}</span>
          <span className="text-base font-bold text-brand-700">{"100\u00a0\u20ac"}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600">{"Reste \u00e0 payer \u00e0 la livraison"}</span>
          <span className="text-sm font-semibold text-stone-900">{"200\u00a0\u20ac"}</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-brand-50 border border-brand-100 p-3">
        <p className="text-xs text-brand-800 leading-relaxed">
          {"Vous payez 100\u00a0\u20ac d\u2019acompte en ligne. Les 200\u00a0\u20ac restants sont \u00e0 r\u00e9gler en esp\u00e8ces le jour de la livraison."}
        </p>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={disabled || loading}
        className={`
          mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold
          transition-all duration-200
          ${disabled
            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
            : 'bg-brand-700 text-white hover:bg-brand-800 active:scale-[0.98] shadow-lg shadow-brand-700/25'
          }
        `}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Traitement en cours...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            {"Payer l\u2019acompte (100\u00a0\u20ac)"}
          </>
        )}
      </button>
    </section>
  );
}
