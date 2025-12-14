import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { initDb } from "./db";
import cron from "node-cron";
import { processNotifications } from "./jobs/notifications";
import { createLogger } from "./utils/logger";

const PORT = process.env.PORT || 4000;
const log = createLogger("Server");

initDb()
  .then(() => {
    app.listen(PORT, () => {
      log.info(`Push / Pull API running on http://localhost:${PORT}`);

      // Schedule daily notification job at 9am
      cron.schedule("0 9 * * *", async () => {
        log.info("Running daily notification job at 9am...");
        try {
          await processNotifications();
          log.info("Daily notification job completed successfully");
        } catch (error) {
          log.error("Daily notification job failed", { error });
        }
      });

      log.info("Daily notification job scheduled for 9:00 AM");
    });
  })
  .catch((err) => {
    log.error("Failed to initialize database", { error: err });
    process.exit(1);
  });
