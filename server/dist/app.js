"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
const exercises_1 = __importDefault(require("./routes/exercises"));
const templates_1 = __importDefault(require("./routes/templates"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const social_1 = __importDefault(require("./routes/social"));
const ai_1 = __importDefault(require("./routes/ai"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const stripe_1 = __importDefault(require("./webhooks/stripe"));
const appstore_1 = __importDefault(require("./webhooks/appstore"));
const auth_1 = require("./middleware/auth");
const app = (0, express_1.default)();
// Stripe webhooks need the raw body, so mount before JSON parsing.
app.use("/webhooks/stripe", stripe_1.default);
app.use("/webhooks/appstore", appstore_1.default);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files from public directory
app.use(express_1.default.static(path_1.default.join(__dirname, "..", "public")));
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.use("/api/exercises", exercises_1.default);
const authChain = [auth_1.maybeRequireAuth, auth_1.attachUser, auth_1.ensureUser];
app.use("/api/templates", ...authChain, templates_1.default);
app.use("/api/sessions", ...authChain, sessions_1.default);
app.use("/api/social", ...authChain, social_1.default);
app.use("/api/ai", ...authChain, ai_1.default);
app.use("/api/analytics", ...authChain, analytics_1.default);
app.use("/api/subscriptions", ...authChain, subscriptions_1.default);
app.use(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
(err, _req, res, _next) => {
    if (err instanceof express_oauth2_jwt_bearer_1.UnauthorizedError) {
        const status = err.status ?? 401;
        if (err.headers) {
            Object.entries(err.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }
        return res.status(status).json({ error: err.message || "Unauthorized" });
    }
    console.error("Unhandled error", err);
    return res.status(500).json({ error: "Internal server error" });
});
exports.default = app;
