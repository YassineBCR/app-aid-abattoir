import { useState } from 'react';
import Header from './components/Header';
import DeliveryDayPicker from './components/DeliveryDayPicker';
import AddressForm from './components/AddressForm';
import ContactForm from './components/ContactForm';
import PaymentSummary from './components/PaymentSummary';
import SuccessView from './components/SuccessView';

const INITIAL_ADDRESS = {
  rue: '',
  codePostal: '',
  ville: '',
  complement: '',
};

const INITIAL_CONTACT = {
  nom: '',
  prenom: '',
  telephone: '',
  email: '',
};

export default function App() {
  const [deliveryDay, setDeliveryDay] = useState('');
  const [address, setAddress] = useState(INITIAL_ADDRESS);
  const [contact, setContact] = useState(INITIAL_CONTACT);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isFormValid =
    deliveryDay &&
    address.rue.trim() &&
    address.codePostal.trim() &&
    address.ville.trim() &&
    contact.nom.trim() &&
    contact.prenom.trim() &&
    contact.telephone.trim() &&
    contact.email.trim();

  const handlePay = async () => {
    if (!isFormValid) return;
    setLoading(true);
    // Mock payment delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <SuccessView deliveryDay={deliveryDay} address={address} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-5 pb-8">
        {/* Hero message */}
        <div className="text-center py-2">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 text-balance">
            {"Commandez votre mouton,"}
            <br />
            <span className="text-brand-700">{"recevez-le chez vous"}</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto">
            {"Choisissez votre jour de livraison, renseignez votre adresse et payez votre acompte en ligne."}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          <StepPill number={1} label="Jour" active={true} done={!!deliveryDay} />
          <div className="w-6 h-px bg-stone-200" />
          <StepPill number={2} label="Adresse" active={!!deliveryDay} done={!!address.rue && !!address.codePostal && !!address.ville} />
          <div className="w-6 h-px bg-stone-200" />
          <StepPill number={3} label="Contact" active={!!address.rue} done={!!contact.nom && !!contact.telephone} />
          <div className="w-6 h-px bg-stone-200" />
          <StepPill number={4} label="Paiement" active={isFormValid} done={false} />
        </div>

        <DeliveryDayPicker selected={deliveryDay} onSelect={setDeliveryDay} />
        <AddressForm data={address} onChange={setAddress} />
        <ContactForm data={contact} onChange={setContact} />
        <PaymentSummary loading={loading} onPay={handlePay} disabled={!isFormValid} />
      </main>
    </div>
  );
}

function StepPill({ number, label, active, done }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <span
        className={`
          flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
          ${done
            ? 'bg-brand-600 text-white'
            : active
              ? 'bg-brand-100 text-brand-800 border border-brand-300'
              : 'bg-stone-100 text-stone-400'
          }
        `}
      >
        {done ? '\u2713' : number}
      </span>
      <span className={`text-xs font-medium ${active ? 'text-stone-700' : 'text-stone-400'}`}>
        {label}
      </span>
    </div>
  );
}
