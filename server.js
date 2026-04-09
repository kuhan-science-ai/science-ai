import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const aiProvider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: aiProvider,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "gemma3",
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().toLowerCase() : "physics";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!question) {
      res.status(400).json({ error: "Question is required." });
      return;
    }

    const answer = aiProvider === "openai"
      ? await askOpenAI(question, subject, history)
      : aiProvider === "gemini"
        ? await askGemini(question, subject, history)
        : await askOllama(question, subject, history);

    res.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Physics AI request failed.";
    console.error(`[api/chat] provider=${aiProvider} error=${message}`);
    res.status(500).json({ error: message });
  }
});

app.get("/api/papers", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query) {
      res.status(400).json({ error: "Query is required." });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(
      `https://api.crossref.org/works?rows=8&query.bibliographic=${encodeURIComponent(query)}&sort=relevance&order=desc`,
      {
        headers: {
          "User-Agent": "ScienceAIBeta/1.0 (research assistant; mailto:local@example.com)",
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      res.status(502).json({ error: `Paper search failed with status ${response.status}.` });
      return;
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.message?.items) ? payload.message.items : [];
    const results = items.map((item) => ({
      id: item.DOI || item.URL || crypto.randomUUID(),
      title: item.title?.[0] || "Untitled paper",
      authors:
        (item.author || [])
          .slice(0, 4)
          .map((author) => `${author.given || ""} ${author.family || ""}`.trim())
          .filter(Boolean)
          .join(", ") || "Author information unavailable",
      url: item.URL || "#",
    }));

    res.json({ results });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Paper search timed out. Please try a shorter or more specific topic."
        : "Paper search is unavailable right now.";
    res.status(500).json({ error: message });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/physics", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "physics.html"));
});

app.get("/chemistry", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "chemistry.html"));
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Physics Nexus is running at http://localhost:${port}`);
});

async function askOpenAI(question, subject, history) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in your .env file.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: {
      effort: "medium",
    },
    instructions: buildSubjectInstructions(subject),
    input: buildOpenAIInput(history, question),
  });

  return response.output_text?.trim() || "The model returned an empty answer.";
}

async function askOllama(question, subject, history) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "gemma3";

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 600000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: buildSubjectInstructions(subject),
        },
        ...buildOllamaHistory(history, question),
      ],
    }),
  }).finally(() => clearTimeout(timeout));

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Ollama request failed.");
  }

  const answer = payload?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The local model returned an empty answer.");
  }

  return answer.trim();
}

async function askGemini(question, subject, history) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in your .env file.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSubjectInstructions(subject) }],
        },
        contents: buildGeminiContents(history, question),
        generationConfig: {
          temperature: 0.4,
        },
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = payload?.error?.message || "Gemini request failed.";
    throw new Error(apiError);
  }

  const answer = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error("Gemini returned an empty answer.");
  }

  return answer;
}

function buildSubjectInstructions(subject) {
  const normalized = ["physics", "chemistry"].includes(subject) ? subject : "physics";

  if (normalized === "chemistry") {
    return "You are a careful chemistry AI assistant. Prioritize correctness over speed. Before answering, internally check whether the reaction, mechanism, formula, stoichiometry, oxidation state, units, and conditions are consistent. Give clear, scientifically grounded answers in plain student-friendly language. Structure most answers point by point using short bullet-style sections or numbered points instead of one long paragraph. Explain reactions, mechanisms, formulas, units, symbols, and scientific notation so a normal student can follow them without already knowing the shorthand. Do not rely on raw notation alone. When you use a formula, immediately explain it in words and briefly define each symbol. Never output raw LaTeX-style notation such as \\frac, \\sum, \\mathbf, ^, _, or $...$ unless you also rewrite it into plain English in the same line. If a sentence can be said more clearly in normal English, prefer normal English first and formula second. If there is uncertainty, say so explicitly instead of guessing. Distinguish established chemistry from speculation, and make safety risks explicit when dangerous substances or procedures are discussed.";
  }

  return "You are a careful physics AI assistant. Prioritize correctness over speed. Before answering, internally check formulas, units, sign conventions, assumptions, and limiting cases. Give clear, scientifically grounded answers in plain student-friendly language. Structure most answers point by point using short bullet-style sections or numbered points instead of one long paragraph. Use formulas only when they genuinely help, and do not rely on raw notation alone. When you write an equation, immediately explain it in words and briefly define what each symbol stands for. Explain scientific notation and symbolic expressions so a normal student can understand them without already knowing the shorthand. Never output raw LaTeX-style notation such as \\frac, \\sum, \\mathbf, ^, _, or $...$ unless you also rewrite it into plain English in the same line. If a sentence can be said more clearly in normal English, prefer normal English first and formula second. State uncertainty for speculative topics. If the user asks to correct a previous answer, explicitly identify and fix the mistake rather than starting over vaguely.";
}

function buildOpenAIInput(history, question) {
  const safeHistory = normalizeHistory(history);
  const input = [];

  for (const item of safeHistory) {
    input.push({
      role: item.role,
      content: item.content,
    });
  }

  input.push({
    role: "user",
    content: question,
  });

  return input;
}

function buildOllamaHistory(history, question) {
  const safeHistory = normalizeHistory(history);
  const messages = safeHistory.map((item) => ({
    role: item.role,
    content: item.content,
  }));

  messages.push({
    role: "user",
    content: question,
  });

  return messages;
}

function buildGeminiContents(history, question) {
  const safeHistory = normalizeHistory(history);
  const contents = safeHistory.map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: question }],
  });

  return contents;
}

function normalizeHistory(history) {
  return history
    .map((item) => {
      const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
      const content = typeof item?.content === "string" ? item.content.trim() : "";
      if (!role || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-12);
}




