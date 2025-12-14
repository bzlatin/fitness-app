"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
const exercises_1 = __importDefault(require("./routes/exercises"));
const templates_1 = __importDefault(require("./routes/templates"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const social_1 = __importDefault(require("./routes/social"));
const ai_1 = __importDefault(require("./routes/ai"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const waitlist_1 = __importDefault(require("./routes/waitlist"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const engagement_1 = __importDefault(require("./routes/engagement"));
const templateShares_1 = require("./routes/templateShares");
const appstore_1 = __importDefault(require("./webhooks/appstore"));
const auth_1 = require("./middleware/auth");
const app = (0, express_1.default)();
app.disable("x-powered-by");
app.use("/webhooks/appstore", appstore_1.default);
const isProduction = process.env.NODE_ENV === "production";
if (process.env.TRUST_PROXY) {
    app.set("trust proxy", process.env.TRUST_PROXY);
}
else if (isProduction) {
    app.set("trust proxy", 1);
}
const parseAllowedOrigins = () => {
    const raw = process.env.CORS_ALLOWED_ORIGINS;
    if (raw && raw.trim()) {
        return raw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
    }
    if (isProduction)
        return [];
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ];
};
const allowedOrigins = new Set(parseAllowedOrigins());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.has(origin))
            return callback(null, true);
        return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Template-Share-Code"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
}));
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
const defaultJson = express_1.default.json({ limit: "200kb" });
app.use("/api/ai", express_1.default.json({ limit: "500kb" }));
app.use("/api/subscriptions", express_1.default.json({ limit: "50kb" }));
app.use("/api/social", express_1.default.json({ limit: "100kb" }));
app.use("/api/feedback", express_1.default.json({ limit: "100kb" }));
app.use(defaultJson);
// Serve static files from public directory
app.use(express_1.default.static(path_1.default.join(__dirname, "..", "public")));
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.use("/api/waitlist", waitlist_1.default);
app.use("/api/exercises", exercises_1.default);
const authChain = [auth_1.maybeRequireAuth, auth_1.attachUser, auth_1.ensureUser];
app.use("/api/templates/share", templateShares_1.templateSharesPublicRouter);
app.use("/api/templates/share", ...authChain, templateShares_1.templateSharesAuthedRouter);
app.use("/api/templates", ...authChain, templates_1.default);
app.use("/api/sessions", ...authChain, sessions_1.default);
app.use("/api/social", ...authChain, social_1.default);
app.use("/api/ai", ...authChain, ai_1.default);
app.use("/api/analytics", ...authChain, analytics_1.default);
app.use("/api/subscriptions", ...authChain, subscriptions_1.default);
app.use("/api/notifications", ...authChain, notifications_1.default);
app.use("/api/feedback", ...authChain, feedback_1.default);
app.use("/api/engagement", ...authChain, engagement_1.default);
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
    const bodyParserError = err;
    if (bodyParserError.type === "entity.too.large" || bodyParserError.status === 413) {
        return res.status(413).json({ error: "Payload too large" });
    }
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({ error: "Invalid JSON body" });
    }
    console.error("Unhandled error", err);
    return res.status(500).json({ error: "Internal server error" });
});
exports.default = app;
