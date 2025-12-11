"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const db_1 = require("./db");
const node_cron_1 = __importDefault(require("node-cron"));
const notifications_1 = require("./jobs/notifications");
const PORT = process.env.PORT || 4000;
(0, db_1.initDb)()
    .then(() => {
    app_1.default.listen(PORT, () => {
        console.log(`Push / Pull API running on http://localhost:${PORT}`);
        // Schedule daily notification job at 9am
        node_cron_1.default.schedule("0 9 * * *", async () => {
            console.log("[Cron] Running daily notification job at 9am...");
            try {
                await (0, notifications_1.processNotifications)();
                console.log("[Cron] Daily notification job completed successfully");
            }
            catch (error) {
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
