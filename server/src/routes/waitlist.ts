import { Router } from "express";
import { query } from "../db";
import { generateId } from "../utils/id";

const router = Router();

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post("/", async (req, res) => {
  const emailRaw = typeof req.body?.email === "string" ? req.body.email : "";
  const email = emailRaw.trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }

  const sourceRaw =
    typeof req.body?.source === "string" ? req.body.source.trim() : "landing";
  const source = sourceRaw || "landing";

  try {
    const result = await query<{ id: string; inserted: boolean }>(
      `
        INSERT INTO waitlist_emails (id, email, source)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
          SET source = EXCLUDED.source,
              updated_at = NOW()
        RETURNING id, (xmax = 0) AS inserted
      `,
      [generateId(), email, source]
    );

    const wasInserted = result.rows[0]?.inserted ?? false;

    return res.status(wasInserted ? 201 : 200).json({
      ok: true,
      status: wasInserted ? "subscribed" : "already_subscribed",
    });
  } catch (err) {
    console.error("Failed to save waitlist email", err);
    return res.status(500).json({ error: "Failed to save email" });
  }
});

export default router;
