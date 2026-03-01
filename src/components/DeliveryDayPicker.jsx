import { Calendar, CheckCircle } from 'lucide-react';

const DELIVERY_OPTIONS = [
  {
    id: 'j1',
    label: "Lendemain de l'A\u00efd (J+1)",
    date: 'Samedi 7 Juin 2025',
    spotsLeft: 12,
  },
  {
    id: 'j2',
    label: "Sur-lendemain de l'A\u00efd (J+2)",
    date: 'Dimanche 8 Juin 2025',
    spotsLeft: 24,
  },
];

export default function DeliveryDayPicker({ selected, onSelect }) {
  return (
    <section className="section-card animate-fade-in">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700">
          <Calendar className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-semibold text-stone-900">
          Choisissez votre jour de livraison
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {DELIVERY_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={`
                relative w-full rounded-xl border-2 p-4 text-left transition-all duration-200
                ${isSelected
                  ? 'border-brand-600 bg-brand-50/60 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                }
              `}
            >
              {isSelected && (
                <div className="absolute top-3.5 right-3.5">
                  <CheckCircle className="w-5 h-5 text-brand-600" />
                </div>
              )}

              <p className={`text-sm font-semibold ${isSelected ? 'text-brand-800' : 'text-stone-900'}`}>
                {option.label}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {option.date}
              </p>

              <div className="mt-3 flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${option.spotsLeft <= 15 ? 'bg-amber-400' : 'bg-brand-400'}`} />
                <span className="text-xs font-medium text-stone-500">
                  {option.spotsLeft} places restantes
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
