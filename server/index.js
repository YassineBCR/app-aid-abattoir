import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/api/sumup/checkout", async (req, res) => {
  try {
    const { commande_id, montant_cents, redirect_url } = req.body;

    if (!commande_id || !montant_cents) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }

    const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
    const SUMUP_EMAIL = process.env.SUMUP_EMAIL;

    if (!SUMUP_API_KEY || !SUMUP_EMAIL) {
      return res.status(500).json({ error: "Config SumUp manquante (.env)" });
    }

    const payload = {
        checkout_reference: commande_id,
        amount: (Number(montant_cents) / 100).toFixed(2),
        currency: "EUR",
        pay_to_email: SUMUP_EMAIL,
        description: "Acompte réservation",
        redirect_url: redirect_url || "http://localhost:5173/",
        hosted_checkout: { enabled: true }, // ✅ IMPORTANT
      };

    const r = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUMUP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: "SumUp API error",
        details: data,
      });
    }

    const url = data.hosted_checkout_url || null;


    return res.json({
        ...data,
        checkout_url: url, // on garde ce nom pour ton front
      });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
