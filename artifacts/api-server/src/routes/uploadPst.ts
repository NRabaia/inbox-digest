import { Router, type IRouter } from "express";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { PSTFile, PSTFolder, PSTMessage } from "pst-extractor";

const router: IRouter = Router();

const MAX_PST_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_MESSAGES = 5000;

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `inbox-digest-${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: MAX_PST_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith(".pst") && !name.endsWith(".ost")) {
      cb(new Error("Only .pst or .ost files are accepted"));
      return;
    }
    cb(null, true);
  },
});

interface ExtractedEmail {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  from: string | null;
  fromEmail: string | null;
  receivedAt: string;
  isRead: boolean;
  importance: "low" | "normal" | "high";
  hasAttachments: boolean;
  webLink: null;
  folder: string;
}

function importanceFromInt(n: number): "low" | "normal" | "high" {
  if (n >= 2) return "high";
  if (n <= 0) return "low";
  return "normal";
}

function walkFolder(
  folder: PSTFolder,
  folderPath: string,
  out: ExtractedEmail[],
  limit: number,
): void {
  if (out.length >= limit) return;

  if (folder.contentCount > 0) {
    let msg = folder.getNextChild() as PSTMessage | null;
    while (msg && out.length < limit) {
      try {
        const date =
          msg.clientSubmitTime ?? msg.messageDeliveryTime ?? new Date(0);
        const subject = msg.subject || null;
        const senderName = msg.senderName || null;
        const senderEmail = msg.senderEmailAddress || null;
        const id = crypto
          .createHash("sha1")
          .update(`${folderPath}|${subject ?? ""}|${date.toISOString()}|${senderEmail ?? ""}`)
          .digest("hex");
        const body = (msg.bodyPreview || msg.body || "").trim();
        out.push({
          id,
          subject,
          bodyPreview: body ? body.slice(0, 500) : null,
          from: senderName ?? senderEmail,
          fromEmail: senderEmail,
          receivedAt: date.toISOString(),
          isRead: msg.isRead,
          importance: importanceFromInt(msg.importance),
          hasAttachments: msg.hasAttachments,
          webLink: null,
          folder: folderPath,
        });
      } catch {
        // skip messages that fail to parse
      }
      msg = folder.getNextChild() as PSTMessage | null;
    }
  }

  if (folder.hasSubfolders) {
    for (const child of folder.getSubFolders()) {
      if (out.length >= limit) break;
      const childPath = folderPath
        ? `${folderPath}/${child.displayName}`
        : child.displayName;
      walkFolder(child, childPath, out, limit);
    }
  }
}

router.post("/emails/upload-pst", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No .pst file uploaded" });
    return;
  }

  let pst: PSTFile | null = null;
  try {
    pst = new PSTFile(file.path);
    const root = pst.getRootFolder();
    const emails: ExtractedEmail[] = [];
    walkFolder(root, "", emails, MAX_MESSAGES);

    emails.sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    );

    req.log.info(
      { count: emails.length, file: file.originalname, sizeMB: Math.round(file.size / 1024 / 1024) },
      "Parsed PST file",
    );

    res.json({
      emails,
      truncated: emails.length >= MAX_MESSAGES,
      totalReturned: emails.length,
    });
  } catch (err) {
    req.log.error({ err, filename: file.originalname }, "Failed to parse PST");
    res.status(500).json({
      error:
        "Failed to parse PST file. The file may be corrupt, password-protected, or in an unsupported format.",
    });
  } finally {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore
    }
  }
});

export default router;
