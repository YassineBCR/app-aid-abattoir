import { User } from 'lucide-react';

export default function ContactForm({ data, onChange }) {
  const update = (field) => (e) =>
    onChange({ ...data, [field]: e.target.value });

  return (
    <section className="section-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-700">
          <User className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-semibold text-stone-900">
          Vos coordonnées
        </h2>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-stone-700 mb-1.5">
              Nom
            </label>
            <input
              id="nom"
              type="text"
              placeholder="Dupont"
              value={data.nom}
              onChange={update('nom')}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-stone-700 mb-1.5">
              {"Pr\u00e9nom"}
            </label>
            <input
              id="prenom"
              type="text"
              placeholder="Ahmed"
              value={data.prenom}
              onChange={update('prenom')}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label htmlFor="telephone" className="block text-sm font-medium text-stone-700 mb-1.5">
            {"T\u00e9l\u00e9phone mobile"}
          </label>
          <input
            id="telephone"
            type="tel"
            inputMode="tel"
            placeholder="06 12 34 56 78"
            value={data.telephone}
            onChange={update('telephone')}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            placeholder="ahmed.dupont@email.com"
            value={data.email}
            onChange={update('email')}
            className="input-field"
          />
        </div>
      </div>
    </section>
  );
}
