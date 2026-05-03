import { Router, type IRouter } from "express";
import {
  GetEmailsQueryParams,
  SummarizeEmailsBody,
  GetEmailDigestQueryParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

const router: IRouter = Router();

// Helper to get Outlook access token from Replit connectors
async function getOutlookToken(): Promise<string | null> {
  try {
    const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
    const replIdentity = process.env["REPL_IDENTITY"];
    const renewal = process.env["WEB_REPL_RENEWAL"];

    if (!hostname || !replIdentity) {
      return null;
    }

    const connectorId = process.env["OUTLOOK_CONNECTOR_ID"];
    if (!connectorId) {
      return null;
    }

    const response = await fetch(
      `https://${hostname}/api/v2/connection?connectorConfigId=${connectorId}`,
      {
        headers: {
          "X-Replit-Identity": replIdentity,
          ...(renewal ? { "X-Replit-Identity-Renewal": renewal } : {}),
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

// Fetch emails from Microsoft Graph API
async function fetchOutlookEmails(
  accessToken: string,
  since?: string,
  top = 50,
): Promise<unknown[]> {
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,receivedDateTime,isRead,importance,hasAttachments,webLink`;

  if (since) {
    const encoded = encodeURIComponent(since);
    url += `&$filter=receivedDateTime ge ${encoded}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Graph API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { value?: unknown[] };
  return data.value ?? [];
}

// Transform raw Graph API message to our Email type
function transformMessage(msg: Record<string, unknown>) {
  const from = msg["from"] as
    | { emailAddress?: { name?: string; address?: string } }
    | null
    | undefined;
  return {
    id: msg["id"] as string,
    subject: (msg["subject"] as string | null) ?? null,
    bodyPreview: (msg["bodyPreview"] as string | null) ?? null,
    from: from?.emailAddress?.name ?? null,
    fromEmail: from?.emailAddress?.address ?? null,
    receivedAt: msg["receivedDateTime"] as string,
    isRead: (msg["isRead"] as boolean) ?? false,
    importance:
      (msg["importance"] as "low" | "normal" | "high" | null) ?? "normal",
    hasAttachments: (msg["hasAttachments"] as boolean) ?? false,
    webLink: (msg["webLink"] as string | null) ?? null,
  };
}

// GET /api/emails
router.get("/emails", async (req, res) => {
  const parseResult = GetEmailsQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { since, top } = parseResult.data;

  const token = await getOutlookToken();
  if (!token) {
    res
      .status(401)
      .json({ error: "Not connected to Outlook. Please connect your account." });
    return;
  }

  try {
    const raw = await fetchOutlookEmails(token, since, top ?? 50);
    const emails = (raw as Record<string, unknown>[]).map(transformMessage);
    res.json(emails);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch emails");
    res.status(500).json({ error: "Failed to fetch emails from Outlook" });
  }
});

// POST /api/emails/summarize
router.post("/emails/summarize", async (req, res) => {
  const parseResult = SummarizeEmailsBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { emails } = parseResult.data;

  if (emails.length === 0) {
    res.json([]);
    return;
  }

  try {
    const summaries = await batchProcess(
      emails,
      async (email) => {
        const content = `Subject: ${email.subject ?? "(no subject)"}
From: ${email.from ?? "Unknown"} <${email.fromEmail ?? ""}>
Received: ${email.receivedAt}
Preview: ${email.bodyPreview ?? "(no preview)"}`;

        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 500,
          messages: [
            {
              role: "system",
              content: `You are an email assistant helping someone catch up after a holiday. For each email, provide:
1. A concise 1-2 sentence summary
2. Whether it needs a reply (true/false)
3. Urgency level: low, medium, or high
4. A suggested action (brief, or null if just FYI)
5. Up to 3 key points as a list

Respond ONLY with valid JSON in this exact format:
{
  "summary": "...",
  "needsReply": true/false,
  "urgency": "low"|"medium"|"high",
  "suggestedAction": "..." or null,
  "keyPoints": ["...", "..."]
}

Consider high urgency if: deadline mentions, urgent/ASAP language, from senior people, action required. Consider needs reply if: questions asked, approval needed, direct requests. Be practical and decisive.`,
            },
            {
              role: "user",
              content,
            },
          ],
        });

        const text = response.choices[0]?.message?.content ?? "{}";
        let parsed: {
          summary?: string;
          needsReply?: boolean;
          urgency?: string;
          suggestedAction?: string | null;
          keyPoints?: string[];
        };
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = {};
        }

        return {
          emailId: email.id,
          subject: email.subject ?? null,
          from: email.from ?? null,
          receivedAt: email.receivedAt,
          summary: parsed.summary ?? "Unable to summarize",
          needsReply: parsed.needsReply ?? false,
          urgency: (parsed.urgency as "low" | "medium" | "high") ?? "low",
          suggestedAction: parsed.suggestedAction ?? null,
          keyPoints: parsed.keyPoints ?? [],
        };
      },
      { concurrency: 3, retries: 3 },
    );

    res.json(summaries);
  } catch (err) {
    req.log.error({ err }, "Failed to summarize emails");
    res.status(500).json({ error: "Failed to summarize emails" });
  }
});

// GET /api/emails/digest
router.get("/emails/digest", async (req, res) => {
  const parseResult = GetEmailDigestQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { since } = parseResult.data;

  const token = await getOutlookToken();
  if (!token) {
    res
      .status(401)
      .json({ error: "Not connected to Outlook. Please connect your account." });
    return;
  }

  try {
    const raw = await fetchOutlookEmails(token, since, 200);
    const emails = (raw as Record<string, unknown>[]).map(transformMessage);

    const unreadEmails = emails.filter((e) => !e.isRead).length;

    // Count top senders
    const senderMap = new Map<string, number>();
    for (const email of emails) {
      const sender = email.from ?? email.fromEmail ?? "Unknown";
      senderMap.set(sender, (senderMap.get(sender) ?? 0) + 1);
    }
    const topSenders = Array.from(senderMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sender, count]) => ({ sender, count }));

    const sorted = emails
      .slice()
      .sort(
        (a, b) =>
          new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
      );

    res.json({
      totalEmails: emails.length,
      unreadEmails,
      needsReplyCount: 0, // will be populated after summarization
      highUrgencyCount: 0, // will be populated after summarization
      topSenders,
      earliestEmail: sorted[0]?.receivedAt ?? null,
      latestEmail: sorted[sorted.length - 1]?.receivedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get digest");
    res.status(500).json({ error: "Failed to get email digest" });
  }
});

export default router;
