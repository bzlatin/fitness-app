import express from "express";
import cors from "cors";
import { UnauthorizedError } from "express-oauth2-jwt-bearer";
import exercisesRouter from "./routes/exercises";
import templatesRouter from "./routes/templates";
import sessionsRouter from "./routes/sessions";
import socialRouter from "./routes/social";
import { attachUser, ensureUser, maybeRequireAuth } from "./middleware/auth";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/exercises", exercisesRouter);
const authChain = [maybeRequireAuth, attachUser, ensureUser];
app.use("/api/templates", ...authChain, templatesRouter);
app.use("/api/sessions", ...authChain, sessionsRouter);
app.use("/api/social", ...authChain, socialRouter);

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
