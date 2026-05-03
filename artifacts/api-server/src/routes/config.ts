import { Router, type IRouter } from "express";
import { getAIProviderName } from "../lib/aiClient";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  const outlookConfigured = Boolean(
    process.env["REPLIT_CONNECTORS_HOSTNAME"] &&
      process.env["REPL_IDENTITY"] &&
      process.env["OUTLOOK_CONNECTOR_ID"],
  );

  res.json({
    aiProvider: getAIProviderName(),
    outlookConfigured,
    standaloneMode: process.env["STANDALONE_MODE"] === "1",
  });
});

export default router;
