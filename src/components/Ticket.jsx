import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";

// Ce composant attend un objet 'commande' complet
// (id, ticket_num, prenom, nom, sacrifice, creneau...)
export default function Ticket({ commande }) {
  const qrRef = useRef();

  if (!commande) return null;

  // Fonction pour télécharger le PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(22);
    doc.text("TICKET DE RÉSERVATION - AÏD", 105, 20, { align: "center" });
    
    // Infos principales
    doc.setFontSize(14);
    doc.text(`N° Ticket : ${commande.ticket_num}`, 20, 40);
    doc.text(`Nom : ${commande.contact_last_name} ${commande.contact_first_name}`, 20, 50);
    doc.text(`Sacrifice : ${commande.sacrifice_name}`, 20, 60);
    
    // Infos Créneau (si disponibles)
    if (commande.creneaux_horaires) {
      const c = commande.creneaux_horaires;
      doc.text(`Date : ${c.date} | Heure : ${c.heure_debut}`, 20, 70);
    }

    // Récupération de l'image QR Code depuis le canvas React
    const canvas = qrRef.current.querySelector("canvas");
    const qrImage = canvas.toDataURL("image/png");
    
    // Ajout du QR Code au PDF (x, y, width, height)
    doc.addImage(qrImage, "PNG", 70, 90, 70, 70);
    
    // Footer
    doc.setFontSize(10);
    doc.text(`ID Commande : ${commande.id}`, 105, 180, { align: "center" });
    doc.text("Présentez ce code à l'entrée de l'abattoir.", 105, 190, { align: "center" });

    doc.save(`Ticket_Aid_${commande.ticket_num}.pdf`);
  };

  // Données à encoder dans le QR Code (JSON pour être lu par l'app Vendeur)
  const qrData = JSON.stringify({
    id: commande.id,
    ticket: commande.ticket_num,
    nom: commande.contact_last_name
  });

  return (
    <div className="flex flex-col items-center gap-6 p-6 border-2 border-dashed border-gray-300 rounded-xl bg-white max-w-md mx-auto my-6">
      {/* --- VISUEL DU TICKET (Ce qu'on voit à l'écran) --- */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold uppercase text-green-700">Votre Ticket</h2>
        <div className="text-5xl font-black text-gray-800">{commande.ticket_num}</div>
        <p className="text-sm opacity-60">À présenter le jour J</p>
      </div>

      {/* Le QR Code (affiché + utilisé pour le PDF) */}
      <div ref={qrRef} className="p-4 bg-white border rounded-xl shadow-sm">
        <QRCodeCanvas value={qrData} size={180} level={"H"} />
      </div>

      <div className="text-center text-sm space-y-1">
        <p><b>{commande.contact_first_name} {commande.contact_last_name}</b></p>
        <p>{commande.sacrifice_name}</p>
        {commande.creneaux_horaires && (
          <p className="text-blue-600 font-semibold">
            {commande.creneaux_horaires.heure_debut} — {commande.creneaux_horaires.heure_fin}
          </p>
        )}
      </div>

      {/* Bouton Télécharger */}
      <button
        onClick={downloadPDF}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <span>📥 Télécharger le PDF</span>
      </button>
    </div>
  );
}