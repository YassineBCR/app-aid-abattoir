import { MapPin } from 'lucide-react';

export default function AddressForm({ data, onChange }) {
  const update = (field) => (e) =>
    onChange({ ...data, [field]: e.target.value });

  return (
    <section className="section-card animate-fade-in" style={{ animationDelay: '0.05s' }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700">
          <MapPin className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-semibold text-stone-900">
          Adresse de livraison
        </h2>
      </div>

      <div className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="rue" className="block text-sm font-medium text-stone-700 mb-1.5">
            {"Num\u00e9ro et Rue"}
          </label>
          <input
            id="rue"
            type="text"
            placeholder="12 Rue de la Paix"
            value={data.rue}
            onChange={update('rue')}
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="codePostal" className="block text-sm font-medium text-stone-700 mb-1.5">
              Code Postal
            </label>
            <input
              id="codePostal"
              type="text"
              inputMode="numeric"
              placeholder="75001"
              maxLength={5}
              value={data.codePostal}
              onChange={update('codePostal')}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="ville" className="block text-sm font-medium text-stone-700 mb-1.5">
              Ville
            </label>
            <input
              id="ville"
              type="text"
              placeholder="Paris"
              value={data.ville}
              onChange={update('ville')}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label htmlFor="complement" className="block text-sm font-medium text-stone-700 mb-1.5">
            {"Compl\u00e9ment"}
            <span className="ml-1 text-xs font-normal text-stone-400">(optionnel)</span>
          </label>
          <input
            id="complement"
            type="text"
            placeholder={"Etage, B\u00e2timent, Digicode\u2026"}
            value={data.complement}
            onChange={update('complement')}
            className="input-field"
          />
        </div>
      </div>
    </section>
  );
}
