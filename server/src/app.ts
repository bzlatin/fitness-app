import express from "express";
import cors from "cors";
import exercisesRouter from "./routes/exercises";
import templatesRouter from "./routes/templates";
import sessionsRouter from "./routes/sessions";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/exercises", exercisesRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/sessions", sessionsRouter);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
