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

      // Run notification job every 15 minutes (delivers at 3pm user-local)
      cron.schedule("*/15 * * * *", async () => {
        log.info("Running notification job (15-min cadence)...");
        try {
          await processNotifications();
          log.info("Notification job completed successfully");
        } catch (error) {
          log.error("Notification job failed", { error });
        }
      });

      log.info("Notification job scheduled every 15 minutes (3pm user-local)");
    });
  })
  .catch((err) => {
    log.error("Failed to initialize database", { error: err });
    process.exit(1);
  });
