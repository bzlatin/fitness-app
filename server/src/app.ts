import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { UnauthorizedError } from "express-oauth2-jwt-bearer";
import exercisesRouter from "./routes/exercises";
import templatesRouter from "./routes/templates";
import sessionsRouter from "./routes/sessions";
import socialRouter from "./routes/social";
import aiRouter from "./routes/ai";
import analyticsRouter from "./routes/analytics";
import subscriptionsRouter from "./routes/subscriptions";
import waitlistRouter from "./routes/waitlist";
import notificationsRouter from "./routes/notifications";
import feedbackRouter from "./routes/feedback";
import engagementRouter from "./routes/engagement";
import { templateSharesAuthedRouter, templateSharesPublicRouter } from "./routes/templateShares";
import stripeWebhookRouter from "./webhooks/stripe";
import appStoreWebhookRouter from "./webhooks/appstore";
import { attachUser, ensureUser, maybeRequireAuth } from "./middleware/auth";

const app = express();
app.disable("x-powered-by");

// Stripe webhooks need the raw body, so mount before JSON parsing.
app.use("/webhooks/stripe", stripeWebhookRouter);
app.use("/webhooks/appstore", appStoreWebhookRouter);

const isProduction = process.env.NODE_ENV === "production";

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (raw && raw.trim()) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (isProduction) return [];

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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Template-Share-Code"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const defaultJson = express.json({ limit: "200kb" });
app.use("/api/ai", express.json({ limit: "500kb" }));
app.use("/api/subscriptions", express.json({ limit: "50kb" }));
app.use("/api/social", express.json({ limit: "100kb" }));
app.use("/api/feedback", express.json({ limit: "100kb" }));
app.use(defaultJson);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/waitlist", waitlistRouter);
app.use("/api/exercises", exercisesRouter);
const authChain = [maybeRequireAuth, attachUser, ensureUser];
app.use("/api/templates/share", templateSharesPublicRouter);
app.use("/api/templates/share", ...authChain, templateSharesAuthedRouter);
app.use("/api/templates", ...authChain, templatesRouter);
app.use("/api/sessions", ...authChain, sessionsRouter);
app.use("/api/social", ...authChain, socialRouter);
app.use("/api/ai", ...authChain, aiRouter);
app.use("/api/analytics", ...authChain, analyticsRouter);
app.use("/api/subscriptions", ...authChain, subscriptionsRouter);
app.use("/api/notifications", ...authChain, notificationsRouter);
app.use("/api/feedback", ...authChain, feedbackRouter);
app.use("/api/engagement", ...authChain, engagementRouter);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof UnauthorizedError) {
      const status = err.status ?? 401;
      if (err.headers) {
        Object.entries(err.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }
      return res.status(status).json({ error: err.message || "Unauthorized" });
    }

    const bodyParserError = err as Error & { type?: string; status?: number };
    if (bodyParserError.type === "entity.too.large" || bodyParserError.status === 413) {
      return res.status(413).json({ error: "Payload too large" });
    }

    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    console.error("Unhandled error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
