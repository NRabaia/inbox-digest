import { Router, type IRouter } from "express";
import multer from "multer";
import { simpleParser } from "mailparser";
import crypto from "node:crypto";

const router: IRouter = Router();

const MAX_FILES = 100;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "message/rfc822" ||
      file.originalname.toLowerCase().endsWith(".eml");
    if (!ok) {
      cb(new Error("Only .eml files are accepted"));
      return;
    }
    cb(null, true);
  },
});

router.post(
  "/emails/upload-eml",
  upload.array("files", MAX_FILES),
  async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];

    if (files.length === 0) {
      res.status(400).json({ error: "No .eml files uploaded" });
      return;
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      res.status(413).json({
        error: `Upload too large: ${Math.round(totalBytes / 1024 / 1024)}MB exceeds ${MAX_TOTAL_BYTES / 1024 / 1024}MB limit`,
      });
      return;
    }

    try {
      const emails = [];
      for (const file of files) {
        try {
          const parsed = await simpleParser(file.buffer);

          const fromAddr = parsed.from?.value?.[0];
          const id =
            parsed.messageId ??
            crypto
              .createHash("sha1")
              .update(file.originalname + (parsed.date?.toISOString() ?? ""))
              .digest("hex");

          emails.push({
            id,
            subject: parsed.subject ?? null,
            bodyPreview:
              (parsed.text ?? "").trim().slice(0, 500) || null,
            from: fromAddr?.name ?? fromAddr?.address ?? null,
            fromEmail: fromAddr?.address ?? null,
            receivedAt: (parsed.date ?? new Date()).toISOString(),
            isRead: false,
            importance: "normal" as const,
            hasAttachments: (parsed.attachments?.length ?? 0) > 0,
            webLink: null,
          });
        } catch (err) {
          req.log.warn(
            { err, filename: file.originalname },
            "Failed to parse .eml file",
          );
        }
      }

      // Sort by date desc
      emails.sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
      );

      res.json(emails);
    } catch (err) {
      req.log.error({ err }, "Failed to process .eml files");
      res.status(500).json({ error: "Failed to process uploaded files" });
    }
  },
);

export default router;
