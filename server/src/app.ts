import express from "express";
import cors from "cors";
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
import stripeWebhookRouter from "./webhooks/stripe";
import appStoreWebhookRouter from "./webhooks/appstore";
import { attachUser, ensureUser, maybeRequireAuth } from "./middleware/auth";

const app = express();

// Stripe webhooks need the raw body, so mount before JSON parsing.
app.use("/webhooks/stripe", stripeWebhookRouter);
app.use("/webhooks/appstore", appStoreWebhookRouter);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/waitlist", waitlistRouter);
app.use("/api/exercises", exercisesRouter);
const authChain = [maybeRequireAuth, attachUser, ensureUser];
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

    console.error("Unhandled error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
