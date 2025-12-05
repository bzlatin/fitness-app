import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { initDb } from "./db";
import cron from "node-cron";
import { processNotifications } from "./jobs/notifications";

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Push / Pull API running on http://localhost:${PORT}`);

      // Schedule daily notification job at 9am
      cron.schedule("0 9 * * *", async () => {
        console.log("[Cron] Running daily notification job at 9am...");
        try {
          await processNotifications();
          console.log("[Cron] Daily notification job completed successfully");
        } catch (error) {
          console.error("[Cron] Daily notification job failed:", error);
        }
      });

      console.log("[Cron] Daily notification job scheduled for 9:00 AM");
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
  });
