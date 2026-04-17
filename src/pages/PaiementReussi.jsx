import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiCheckCircle, FiArrowRight, FiDownload, FiLoader, FiMail, FiTag, FiCalendar, FiUser } from "react-icons/fi";
import { supabase } from "../lib/supabase";
import { QRCodeCanvas } from "qrcode.react";

export default function PaiementReussi() {
  const [searchParams] = useSearchParams();
  const panierId = searchParams.get('panier_id');
  const sessionId = searchParams.get('session_id'); 
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailsSent, setEmailsSent] = useState(false);

  const processedRef = useRef(false);

  useEffect(() => {
    const validateAndFetch = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user) {
            setLoading(false);
            return;
        }

        // --- CREATION DE LA RESERVATION UNIQUEMENT APRÈS LE PAIEMENT ! ---
        const reserveNow = searchParams.get('reserve_now');
        if (reserveNow === "true") {
            const { error: rpcError } = await supabase.rpc("reserver_prochain_ticket", {
                p_creneau_id: searchParams.get('c_id'),
                p_client_id: user.id,
                p_nom: searchParams.get('ln'),
                p_prenom: searchParams.get('fn'),
                p_email: searchParams.get('em'),
                p_tel: searchParams.get('ph'),
                p_sacrifice_name: searchParams.get('sac'),
                p_categorie: searchParams.get('cat'),
                p_montant_total_cents: parseInt(searchParams.get('prix') || '0', 10),
                p_acompte_cents: 5000
            });
            
            if (rpcError) console.error("Erreur de création ticket :", rpcError);
            
            // On nettoie l'URL pour éviter de recréer un ticket si l'utilisateur rafraichit la page
            const newUrl = window.location.pathname + "?session_id=" + sessionId;
            window.history.replaceState({}, document.title, newUrl);
        }
        // -----------------------------------------------------------------

        // Le reste de ton code ne bouge pas : on traite les billets fraichement créés
        let queryTickets = supabase
          .from('commandes')
          .select('*')
          .eq('client_id', user.id)
          .eq('statut', 'en_attente');

        if (panierId) {
          queryTickets = queryTickets.eq('panier_id', panierId);
        }

        const { data: ticketsToPay } = await queryTickets;

        if (ticketsToPay && ticketsToPay.length > 0) {
            for (const ticket of ticketsToPay) {
                const vraiMontantAcompte = ticket.acompte_cents || 5000; 

                const { error: updateError } = await supabase
                  .from('commandes')
                  .update({ 
                      statut: 'acompte_paye',
                      montant_paye_cents: vraiMontantAcompte 
                  }) 
                  .eq('id', ticket.id);

                if (updateError) {
                  console.error(`Erreur update ticket ${ticket.ticket_num}:`, updateError);
                  continue; 
                }

                const refUniqueParTicket = sessionId 
                  ? `${sessionId}_${ticket.id}` 
                  : `web_${ticket.id}`;

                const { data: existing } = await supabase
                    .from('historique_paiements')
                    .select('id')
                    .eq('reference_externe', refUniqueParTicket)
                    .eq('commande_id', ticket.id)
                    .maybeSingle();

                if (!existing) {
                    const { error: insertError } = await supabase
                      .from('historique_paiements')
                      .insert({
                        commande_id: ticket.id,
                        ticket_num: ticket.ticket_num,
                        montant_cents: vraiMontantAcompte,
                        moyen_paiement: 'stripe',
                        encaisse_par: 'Site Web (Stripe)',
                        reference_externe: refUniqueParTicket
                    });

                    if (insertError) {
                      console.error(`Erreur historique ticket ${ticket.ticket_num}:`, insertError);
                    }
                }
            }
        }

        let query = supabase
          .from('commandes')
          .select('*, creneaux_horaires(date, heure_debut)')
          .eq('client_id', user.id)
          .eq('statut', 'acompte_paye')
          .order('ticket_num', { ascending: true });

        if (panierId) query = query.eq('panier_id', panierId);

        const { data, error } = await query;
        if (error) throw error;
        
        setTickets(data || []);
      } catch (err) {
        console.error("Erreur globale PaiementReussi:", err);
      } finally {
        setLoading(false);
      }
    };

    validateAndFetch();
  }, [panierId, sessionId]);

  useEffect(() => {
      if (tickets.length > 0) {
          const envoyerEmails = async () => {
              const storageKey = panierId ? `emails_sent_${panierId}` : `emails_sent_last_order`;
              const alreadySent = sessionStorage.getItem(storageKey);
              
              if (alreadySent) {
                  setEmailsSent(true);
                  return;
              }

              let emailSentCount = 0;

              for (const ticket of tickets) {
                  if (ticket.contact_email && !ticket.contact_email.includes('surplace')) {
                      try {
                          const qrData = JSON.stringify({ id: ticket.id, ticket: ticket.ticket_num, nom: ticket.contact_last_name });

                          await fetch("/api/send-ticket-email", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                  email: ticket.contact_email,
                                  firstName: ticket.contact_first_name,
                                  lastName: ticket.contact_last_name,
                                  phone: ticket.contact_phone,
                                  ticketNum: ticket.ticket_num,
                                  sacrificeName: ticket.sacrifice_name,
                                  qrData: qrData
                              })
                          });
                          emailSentCount++;
                      } catch (err) {
                          console.error(`Erreur email ticket ${ticket.ticket_num}`, err);
                      }
                  }
              }

              sessionStorage.setItem(storageKey, 'true');
              if (emailSentCount > 0) setEmailsSent(true);
          };

          envoyerEmails();
      }
  }, [tickets, panierId]);

  const downloadQR = (ticketNum) => {
    const canvas = document.getElementById(`qr-${ticketNum}`);
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `Grammont_Ticket_${ticketNum}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
              <FiLoader className="text-5xl text-emerald-500 animate-spin mb-4" />
              <p className="text-slate-500 font-bold text-lg">Validation du paiement et génération des tickets...</p>
          </div>
      );
  }

  const listNumeros = tickets.map(t => `#${t.ticket_num}`).join(', ');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 md:p-12 text-center animate-fade-in-up border-t-8 border-emerald-500">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiCheckCircle className="text-6xl" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
              Paiement Validé !
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">
              Merci pour votre commande. Vos tickets{' '}
              <strong className="text-emerald-600">{listNumeros}</strong>{' '}
              sont officiellement réservés.
          </p>

          {emailsSent && (
              <div className="mt-6 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200 dark:border-blue-800/50">
                  <FiMail className="text-lg" />
                  Vos tickets ont été envoyés par email !
              </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {tickets.map((ticket) => (
                <div key={ticket.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative group">
                    <div className="bg-emerald-500 p-4 flex justify-between items-center text-white shadow-md z-10">
                        <h3 className="font-black text-2xl tracking-wide">TICKET #{ticket.ticket_num}</h3>
                        <FiTag className="text-3xl opacity-50" />
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col sm:flex-row gap-6 items-center">
                        <div className="flex-1 space-y-4 w-full">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5"><FiUser/> Pour le sacrifice de</p>
                                <p className="font-black text-lg text-slate-800 dark:text-white">{ticket.sacrifice_name}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5"><FiCalendar/> Retrait Prévu</p>
                                <p className="font-bold text-slate-700 dark:text-slate-300">
                                    {ticket.creneaux_horaires 
                                        ? new Date(ticket.creneaux_horaires.date).toLocaleDateString('fr-FR') 
                                        : "Date inconnue"}
                                    <br/>
                                    <span className="text-emerald-600">
                                        à {ticket.creneaux_horaires?.heure_debut?.slice(0,5)}
                                    </span>
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase">Catégorie</p>
                                <p className="font-bold text-slate-600 dark:text-slate-400">Catégorie {ticket.categorie}</p>
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase">Acompte payé</p>
                                <p className="font-black text-emerald-600 text-lg">
                                    {((ticket.montant_paye_cents || ticket.acompte_cents || 0) / 100).toFixed(2)} €
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-center gap-3">
                            <div className="bg-white p-3 rounded-2xl shadow-inner border-2 border-slate-100 dark:border-slate-700">
                                <QRCodeCanvas
                                    id={`qr-${ticket.ticket_num}`}
                                    value={JSON.stringify({ id: ticket.id, ticket: ticket.ticket_num, nom: ticket.contact_last_name })}
                                    size={130}
                                    level={"H"}
                                    includeMargin={false}
                                />
                            </div>
                            <button 
                                onClick={() => downloadQR(ticket.ticket_num)}
                                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-emerald-50 text-emerald-700 dark:bg-slate-700 dark:text-emerald-400 py-2 rounded-xl text-sm font-bold transition-colors border border-transparent hover:border-emerald-200"
                            >
                                <FiDownload /> Télécharger
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {!loading && tickets.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 text-center">
                <p className="text-slate-500 font-medium">
                    Le paiement a bien été reçu. Si vos tickets n'apparaissent pas, 
                    contactez-nous en mentionnant votre référence Stripe.
                </p>
            </div>
        )}

        <div className="text-center pt-8">
            <Link 
                to="/" 
                className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold shadow-xl hover:scale-105 transition-all text-lg"
            >
                Retourner à l'accueil <FiArrowRight />
            </Link>
        </div>

      </div>
    </div>
  );
}