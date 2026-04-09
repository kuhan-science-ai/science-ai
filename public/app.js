const storageKeys = {
  notes: "scienceHubNotes",
  chats: "scienceHubChats",
  progress: "scienceHubProgress",
};

const subjectMeta = {
  physics: {
    label: "Physics AI",
    greeting:
      "Hello. I am your Physics AI. Ask me about mechanics, relativity, quantum physics, electromagnetism, thermodynamics, astrophysics, or research ideas.",
    placeholder: "Ask a deeper physics question. Example: Derive the photoelectric effect and explain the assumptions.",
  },
  chemistry: {
    label: "Chemistry AI",
    greeting:
      "Hello. I am your Chemistry AI. Ask me about organic chemistry, physical chemistry, inorganic chemistry, reaction mechanisms, thermochemistry, or research ideas.",
    placeholder: "Ask a deeper chemistry question. Example: Explain SN1 vs SN2 with energy profiles and solvent effects.",
  },
};

const progressLabels = {
  10: "Idea stage",
  30: "Literature review",
  50: "Method and calculations",
  70: "Draft writing",
  85: "Revision",
  100: "Ready to submit",
};

const subjectLock = document.body.dataset.subjectLock || null;

const dom = {
  betaStartBtn: document.getElementById("betaStartBtn"),
  authStatus: document.getElementById("authStatus"),
  serverStatus: document.getElementById("serverStatus"),
  aiStatus: document.getElementById("aiStatus"),
  userGreeting: document.getElementById("userGreeting"),
  subjectTitle: document.getElementById("subjectTitle"),
  askButton: document.getElementById("askButton"),
  chatForm: document.getElementById("chatForm"),
  questionInput: document.getElementById("questionInput"),
  chatMessages: document.getElementById("chatMessages"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  paperSearchForm: document.getElementById("paperSearchForm"),
  paperSubject: document.getElementById("paperSubject"),
  paperQuery: document.getElementById("paperQuery"),
  paperResults: document.getElementById("paperResults"),
  saveNoteForm: document.getElementById("saveNoteForm"),
  noteSubject: document.getElementById("noteSubject"),
  noteTitle: document.getElementById("noteTitle"),
  noteContent: document.getElementById("noteContent"),
  noteSearchInput: document.getElementById("noteSearchInput"),
  exportNotesBtn: document.getElementById("exportNotesBtn"),
  noteCount: document.getElementById("noteCount"),
  savedNotes: document.getElementById("savedNotes"),
  buildDraftBtn: document.getElementById("buildDraftBtn"),
  paperDraft: document.getElementById("paperDraft"),
  progressStage: document.getElementById("progressStage"),
  saveProgressBtn: document.getElementById("saveProgressBtn"),
  progressLabel: document.getElementById("progressLabel"),
  progressFill: document.getElementById("progressFill"),
  viewButtons: document.querySelectorAll("[data-view-target]"),
  subjectButtons: document.querySelectorAll("[data-subject]"),
  aiView: document.getElementById("aiView"),
  researchView: document.getElementById("researchView"),
};

let currentSubject = "physics";
let aiBusy = false;

init();

function init() {
  attachEvents();
  if (dom.aiView || dom.researchView) {
    showView("ai");
  }
  if (dom.subjectTitle && dom.askButton && dom.questionInput) {
    setSubject(subjectLock || "physics");
    renderCurrentChat();
    renderNotes();
    renderProgress();
  }

  checkServerHealth();
}

function attachEvents() {
  if (dom.betaStartBtn) {
    dom.betaStartBtn.addEventListener("click", activateBetaMode);
  }
  if (dom.chatForm) {
    dom.chatForm.addEventListener("submit", handleQuestionSubmit);
  }
  if (dom.clearChatBtn) {
    dom.clearChatBtn.addEventListener("click", clearCurrentChat);
  }
  if (dom.paperSearchForm) {
    dom.paperSearchForm.addEventListener("submit", handlePaperSearch);
  }
  if (dom.saveNoteForm) {
    dom.saveNoteForm.addEventListener("submit", saveNote);
  }
  if (dom.buildDraftBtn) {
    dom.buildDraftBtn.addEventListener("click", buildDraft);
  }
  if (dom.saveProgressBtn) {
    dom.saveProgressBtn.addEventListener("click", saveProgress);
  }
  if (dom.noteSearchInput) {
    dom.noteSearchInput.addEventListener("input", renderNotes);
  }
  if (dom.exportNotesBtn) {
    dom.exportNotesBtn.addEventListener("click", exportNotes);
  }
  dom.viewButtons.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewTarget));
  });
  dom.subjectButtons.forEach((button) => {
    button.addEventListener("click", () => setSubject(button.dataset.subject));
  });
}

function activateBetaMode() {
  renderAccessState("Workspace ready. No sign-in is required.");
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getAllChats() {
  return readJson(storageKeys.chats, {});
}

function getCurrentChat() {
  const chats = getAllChats();
  return chats[currentSubject] || [{ author: "ai", text: subjectMeta[currentSubject].greeting }];
}

function saveCurrentChat(chat) {
  const chats = getAllChats();
  chats[currentSubject] = chat;
  writeJson(storageKeys.chats, chats);
}

function setSubject(subject) {
  if (aiBusy) {
    return;
  }

  const nextSubject = subjectLock || subject;
  currentSubject = subjectMeta[nextSubject] ? nextSubject : "physics";
  if (!dom.subjectTitle || !dom.askButton || !dom.questionInput) {
    return;
  }
  dom.subjectTitle.textContent = subjectMeta[currentSubject].label;
  dom.askButton.textContent = `Ask ${subjectMeta[currentSubject].label}`;
  dom.questionInput.placeholder = subjectMeta[currentSubject].placeholder;
  if (dom.paperSubject) {
    dom.paperSubject.value = currentSubject;
  }
  if (dom.noteSubject) {
    dom.noteSubject.value = currentSubject;
  }

  dom.subjectButtons.forEach((button) => {
    button.classList.toggle("active-subject", button.dataset.subject === currentSubject);
  });

  renderCurrentChat();
  renderNotes();
  renderProgress();
}

function renderCurrentChat() {
  if (!dom.chatMessages) {
    return;
  }
  const chat = getCurrentChat();
  dom.chatMessages.innerHTML = "";
  for (const entry of chat) {
    renderMessage(entry.author, entry.text);
  }
}

function renderMessage(author, text) {
  if (!dom.chatMessages) {
    return;
  }
  const article = document.createElement("article");
  article.className = `message ${author}`;

  const heading = document.createElement("h4");
  heading.textContent = author === "user" ? "You" : subjectMeta[currentSubject].label;

  const body = document.createElement("p");
  body.className = "message-body";
  if (author === "ai") {
    body.innerHTML = formatDisplayHtml(text);
  } else {
    body.textContent = formatDisplayText(text);
  }

  article.append(heading, body);
  dom.chatMessages.append(article);
  if (shouldAutoScroll(dom.chatMessages)) {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }
}

async function getSubjectAnswer(question) {
  const history = getCurrentChat()
    .slice(-10)
    .map((entry) => ({
      role: entry.author === "ai" ? "assistant" : "user",
      content: entry.text,
    }));

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: currentSubject,
      question,
      history,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Subject AI request failed.");
  }

  return payload.answer || "The AI did not return a response.";
}

async function handleQuestionSubmit(event) {
  event.preventDefault();
  const question = dom.questionInput.value.trim();
  if (!question || aiBusy) {
    return;
  }

  setAiBusy(true);
  const chat = getCurrentChat();
  chat.push({ author: "user", text: question });
  saveCurrentChat(chat);
  renderCurrentChat();
  dom.questionInput.value = "";

  try {
    const answer = await getSubjectAnswer(question);
    await revealAiAnswer(answer, chat);
  } catch (error) {
    chat.push({
      author: "ai",
      text: error instanceof Error
        ? error.message
        : "The AI is unavailable right now. Make sure the local server and model are running.",
    });
  }

  saveCurrentChat(chat);
  renderCurrentChat();
  setAiBusy(false);
}

function clearCurrentChat() {
  saveCurrentChat([{ author: "ai", text: subjectMeta[currentSubject].greeting }]);
  renderCurrentChat();
}

async function checkServerHealth() {
  if (!dom.serverStatus) {
    return;
  }
  try {
    const response = await fetch("/api/health");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error("Local server health check failed.");
    }

    const providerLabel = payload.provider || "unknown";
    const modelLabel = payload.ollamaModel || "";
    dom.serverStatus.textContent = providerLabel === "ollama"
      ? `Local server is running. Provider: ${providerLabel}. Model: ${modelLabel}.`
      : `Local server is running. Provider: ${providerLabel}.`;
  } catch {
    dom.serverStatus.textContent = "Local server is not reachable. Open http://localhost:3000 from the running Node server.";
  }
}

function renderAccessState(message = "Workspace ready. No login or verification is required.") {
  if (!dom.authStatus) {
    return;
  }

  if (dom.userGreeting) {
    dom.userGreeting.textContent = `${capitalize(currentSubject)} Researcher`;
  }

  dom.authStatus.textContent = message;
}

function showView(viewName) {
  if (dom.aiView) {
    dom.aiView.classList.toggle("active-view", viewName === "ai");
  }
  if (dom.researchView) {
    dom.researchView.classList.toggle("active-view", viewName === "research");
  }
}

async function handlePaperSearch(event) {
  event.preventDefault();
  const query = dom.paperQuery.value.trim();
  const subject = subjectLock || (dom.paperSubject ? dom.paperSubject.value : currentSubject);
  if (!query) {
    return;
  }

  dom.paperResults.innerHTML = '<p class="empty-state">Searching online papers...</p>';

  try {
    const response = await fetch(`/api/papers?q=${encodeURIComponent(`${subject} ${query}`)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Paper search failed.");
    }

    renderPaperResults(payload.results || [], subject);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Online paper search could not load.";
    dom.paperResults.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  }
}

function renderPaperResults(results, subject) {
  dom.paperResults.innerHTML = "";

  if (!results.length) {
    dom.paperResults.innerHTML = '<p class="empty-state">No results found for that query.</p>';
    return;
  }

  for (const result of results) {
    const card = document.createElement("article");
    card.className = "result-card";

    const heading = document.createElement("h5");
    heading.textContent = result.title;

    const authorText = document.createElement("p");
    authorText.textContent = `${capitalize(subject)} | ${result.authors}`;

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const anchor = document.createElement("a");
    anchor.className = "link-btn";
    anchor.href = result.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = "Open source";

    const saveButton = document.createElement("button");
    saveButton.className = "small-btn";
    saveButton.type = "button";
    saveButton.textContent = "Save to notes";
    saveButton.addEventListener("click", () => saveResearchFromPaper(result.title, result.url, subject));

    actions.append(anchor, saveButton);
    card.append(heading, authorText, actions);
    dom.paperResults.appendChild(card);
  }
}

function saveResearchFromPaper(title, url, subject) {
  if (dom.noteSubject) {
    dom.noteSubject.value = subject;
  }
  dom.noteTitle.value = title;
  dom.noteContent.value = `Source: ${url}\nSubject: ${capitalize(subject)}\n\nSummary:\n\nKey idea:\n\nHow this helps my research:\n`;
  dom.noteContent.focus();
  showView("research");
}

function getNotes() {
  return readJson(storageKeys.notes, []);
}

function renderNotes() {
  if (!dom.savedNotes) {
    return;
  }
  const notes = getNotes().filter((note) => note.subject === currentSubject);
  const query = dom.noteSearchInput ? dom.noteSearchInput.value.trim().toLowerCase() : "";
  const filteredNotes = query
    ? notes.filter((note) => `${note.title}\n${note.content}`.toLowerCase().includes(query))
    : notes;
  dom.savedNotes.innerHTML = "";
  if (dom.noteCount) {
    dom.noteCount.textContent = filteredNotes.length
      ? `Showing ${filteredNotes.length} of ${notes.length} saved ${currentSubject} notes.`
      : query
        ? `No saved ${currentSubject} notes match "${query}".`
        : `No saved ${currentSubject} notes yet.`;
  }

  if (!filteredNotes.length) {
    dom.savedNotes.innerHTML = `<p class="empty-state">No saved ${currentSubject} notes yet.</p>`;
    return;
  }

  for (const note of filteredNotes) {
    const card = document.createElement("article");
    card.className = "note-card";

    const heading = document.createElement("h5");
    heading.textContent = note.title;

    const meta = document.createElement("p");
    meta.textContent = `${capitalize(note.subject)} research note | ${formatSavedAt(note.savedAt)}`;

    const content = document.createElement("p");
    content.className = "multiline";
    content.textContent = note.content;

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const editButton = document.createElement("button");
    editButton.className = "small-btn";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      if (dom.noteSubject) {
        dom.noteSubject.value = note.subject;
      }
      dom.noteTitle.value = note.title;
      dom.noteContent.value = note.content;
      deleteNote(note.id, false);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteNote(note.id, true));

    actions.append(editButton, deleteButton);
    card.append(heading, meta, content, actions);
    dom.savedNotes.appendChild(card);
  }
}

function deleteNote(id, rerender = true) {
  const nextNotes = getNotes().filter((note) => note.id !== id);
  writeJson(storageKeys.notes, nextNotes);
  if (rerender) {
    renderNotes();
  }
}

function saveNote(event) {
  event.preventDefault();
  const subject = subjectLock || (dom.noteSubject ? dom.noteSubject.value : currentSubject);
  const title = dom.noteTitle.value.trim();
  const content = dom.noteContent.value.trim();

  if (!title || !content) {
    return;
  }

  const notes = getNotes();
  notes.unshift({
    id: crypto.randomUUID(),
    subject,
    title,
    content,
    savedAt: new Date().toISOString(),
  });

  writeJson(storageKeys.notes, notes);
  dom.noteTitle.value = "";
  dom.noteContent.value = "";
  if (dom.noteSearchInput) {
    dom.noteSearchInput.value = "";
  }

  if (subject !== currentSubject) {
    setSubject(subject);
  } else {
    renderNotes();
  }
}

function getProgressMap() {
  return readJson(storageKeys.progress, {});
}

function saveProgress() {
  const value = Number(dom.progressStage.value);
  const progress = getProgressMap();
  progress[currentSubject] = value;
  writeJson(storageKeys.progress, progress);
  renderProgress();
}

function renderProgress() {
  if (!dom.progressFill || !dom.progressLabel || !dom.progressStage) {
    return;
  }
  const progress = getProgressMap();
  const value = Number(progress[currentSubject] || 0);

  dom.progressFill.style.width = `${value}%`;
  dom.progressLabel.textContent = value
    ? `${value}% complete: ${progressLabels[value] || "Custom stage"}`
    : `No ${currentSubject} milestones saved yet.`;
  dom.progressStage.value = String(value || 10);
}

function buildDraft() {
  if (!dom.paperDraft) {
    return;
  }
  const notes = getNotes().filter((note) => note.subject === currentSubject);
  const progress = getProgressMap();
  const progressValue = Number(progress[currentSubject] || 0);

  if (!notes.length) {
    dom.paperDraft.value = `Add ${currentSubject} research notes first, then create a draft.`;
    return;
  }

  const noteSections = notes
    .map((note, index) => `Source ${index + 1}: ${note.title}\n${note.content}`)
    .join("\n\n");

  dom.paperDraft.value = `Title: Draft ${capitalize(currentSubject)} Research Paper

Current publishing stage:
${progressValue ? `${progressValue}% complete - ${progressLabels[progressValue]}` : "No stage saved yet"}

Abstract:
This draft was generated from the stored ${currentSubject} research notes in the beta workspace. Refine the claims, verify citations, and adjust the technical depth before submission.

Introduction:
This paper explores the selected ${currentSubject} topic by synthesizing saved sources, derivations, observations, and research notes.

Literature Review:
${noteSections}

Methodology:
Describe how the sources were selected, what mathematical, physical, or chemical framework was used, and how evidence or derivations were evaluated.

Results and Analysis:
Summarize the main findings, equations, proofs, mechanisms, or computational outputs that support the central claim.

Discussion:
Compare the findings to prior work, note limitations, and identify what still needs to be verified before publication.

Conclusion:
State the main insight, practical or theoretical significance, and next steps toward submission.

References:
Convert the saved source titles and links into the citation style required by your target journal or conference.`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setAiBusy(isBusy) {
  aiBusy = isBusy;
  if (dom.askButton) {
    dom.askButton.disabled = isBusy;
  }
  if (dom.clearChatBtn) {
    dom.clearChatBtn.disabled = isBusy;
  }
  dom.subjectButtons.forEach((button) => {
    button.disabled = isBusy;
  });
  if (dom.aiStatus) {
    dom.aiStatus.textContent = isBusy
      ? `${subjectMeta[currentSubject].label} is thinking. Please wait...`
      : "AI ready for questions.";
  }
}

async function revealAiAnswer(answer, chat) {
  const cleanedAnswer = formatDisplayText(answer);
  const aiMessage = { author: "ai", text: "" };
  chat.push(aiMessage);
  saveCurrentChat(chat);
  renderCurrentChat();

  const aiBodies = dom.chatMessages.querySelectorAll(".message.ai .message-body");
  const target = aiBodies[aiBodies.length - 1];
  if (!target) {
    aiMessage.text = cleanedAnswer;
    return;
  }

  if (dom.aiStatus) {
    dom.aiStatus.textContent = `${subjectMeta[currentSubject].label} is answering...`;
  }
  target.classList.add("typing-cursor");

  const segments = buildTypingSegments(cleanedAnswer);
  let visibleText = "";
  for (const segment of segments) {
    const autoScroll = shouldAutoScroll(dom.chatMessages);
    visibleText += segment.text;
    aiMessage.text = visibleText;
    target.textContent = visibleText;
    if (autoScroll) {
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }
    await wait(segment.delay);
  }

  target.classList.remove("typing-cursor");
  target.innerHTML = formatDisplayHtml(cleanedAnswer);
}

function formatDisplayText(text) {
  return applyReadableSymbols(normalizeAnswerStructure(normalizeScientificText(text)))
    .replace(/\s+\*\s+(?=[A-Z])/g, "\n- ")
    .replace(/(^|\n)\*\s+/g, "$1- ")
    .replace(/\s+\*(?=\s|$)/g, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDisplayHtml(text) {
  const cleaned = formatDisplayText(text);
  const escaped = applyReadableScripts(formatInlineRichText(escapeHtml(cleaned)));

  return escaped
    .split(/\n\s*\n/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) {
        return "";
      }

      const lines = trimmed.split("\n");
      const allBullets = lines.every((line) => /^[-•]\s+/.test(line.trim()));
      if (allBullets) {
        const items = lines
          .map((line) => line.replace(/^[-•]\s+/, "").trim())
          .filter(Boolean)
          .map((line) => `<li>${formatLeadLabel(line)}</li>`)
          .join("");
        return `<ul class="answer-list">${items}</ul>`;
      }

      if (lines.length === 1 && isAnswerHeading(lines[0])) {
        return `<h5 class="answer-heading">${lines[0]}</h5>`;
      }

      if (lines.length > 1 && isAnswerHeading(lines[0])) {
        const [heading, ...rest] = lines;
        return `
          <section class="answer-section">
            <h5 class="answer-heading">${heading}</h5>
            <p>${rest.map((line) => formatLeadLabel(line)).join("<br>")}</p>
          </section>
        `;
      }

      return `<p>${lines.map((line) => formatLeadLabel(line)).join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeScientificText(text) {
  let result = String(text || "");

  result = result
    .replace(/\r/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\\begin\{(?:aligned|align\*?|equation\*?|gather\*?|cases|array)\}/g, "\n")
    .replace(/\\end\{(?:aligned|align\*?|equation\*?|gather\*?|cases|array)\}/g, "\n")
    .replace(/\\\\/g, "\n")
    .replace(/&/g, " ")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\operatorname\{([^}]+)\}/g, "$1")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\\mathit\{([^}]+)\}/g, "$1")
    .replace(/\\mathcal\{([^}]+)\}/g, "$1")
    .replace(/\\vec\{([^}]+)\}/g, "$1")
    .replace(/\\hat\{([^}]+)\}/g, "$1")
    .replace(/\\bar\{([^}]+)\}/g, "$1")
    .replace(/\\overline\{([^}]+)\}/g, "$1")
    .replace(/\\underline\{([^}]+)\}/g, "$1")
    .replace(/\\boxed\{([^}]+)\}/g, "$1")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\:/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\quad/g, " ")
    .replace(/\\qquad/g, "  ");

  while (/\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}/.test(result)) {
    result = result.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1 divided by $2");
  }

  while (/\\sqrt\s*\{[^{}]*\}/.test(result)) {
    result = result.replace(/\\sqrt\s*\{([^{}]+)\}/g, "square root of $1");
  }

  result = result
    .replace(/\\fracd2([a-zA-Z])dt2/g, "second derivative of $1 with respect to t")
    .replace(/\\fracd([a-zA-Z])dt/g, "derivative of $1 with respect to t")
    .replace(/d\^?2\s*([a-zA-Z])\/d([a-zA-Z])\^?2/g, "second derivative of $1 with respect to $2")
    .replace(/d\s*([a-zA-Z])\/d([a-zA-Z])/g, "derivative of $1 with respect to $2")
    .replace(/\\sum/g, "sum")
    .replace(/\\int/g, "integral")
    .replace(/\\partial/g, "partial")
    .replace(/\\nabla/g, "nabla")
    .replace(/\\infty/g, "infinity")
    .replace(/\\to/g, " -> ")
    .replace(/\\rightarrow/g, " -> ")
    .replace(/\\leftarrow/g, " <- ")
    .replace(/\\leftrightarrow/g, " <-> ")
    .replace(/\\mapsto/g, " maps to ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\times/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\mp/g, " minus or plus ")
    .replace(/\\approx/g, " approximately ")
    .replace(/\\neq/g, " not equal to ")
    .replace(/\\geq/g, " greater than or equal to ")
    .replace(/\\leq/g, " less than or equal to ")
    .replace(/\\gg/g, " much greater than ")
    .replace(/\\ll/g, " much less than ")
    .replace(/\\sim/g, " is proportional to ")
    .replace(/\\propto/g, " is proportional to ")
    .replace(/\\therefore/g, " therefore ")
    .replace(/\\because/g, " because ")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\log/g, "log")
    .replace(/\\ln/g, "ln");

  const latexWords = {
    '\\Alpha': 'Alpha',
    '\\Beta': 'Beta',
    '\\Gamma': 'Gamma',
    '\\Delta': 'Delta',
    '\\Theta': 'Theta',
    '\\Lambda': 'Lambda',
    '\\Pi': 'Pi',
    '\\Sigma': 'Sigma',
    '\\Omega': 'Omega',
    '\\alpha': 'alpha',
    '\\beta': 'beta',
    '\\gamma': 'gamma',
    '\\delta': 'delta',
    '\\epsilon': 'epsilon',
    '\\theta': 'theta',
    '\\lambda': 'lambda',
    '\\mu': 'mu',
    '\\pi': 'pi',
    '\\sigma': 'sigma',
    '\\omega': 'omega'
  };

  for (const [latex, plain] of Object.entries(latexWords)) {
    result = result.replace(new RegExp(latex.replace(/\\/g, "\\\\"), "g"), plain);
  }

  while (/\^\{[^{}]+\}/.test(result) || /_\{[^{}]+\}/.test(result)) {
    result = result
      .replace(/\^\{([^{}]+)\}/g, " to the power of $1")
      .replace(/_\{([^{}]+)\}/g, " sub $1");
  }

  result = result
    .replace(/\^([A-Za-z0-9+\-]+)/g, " to the power of $1")
    .replace(/_([A-Za-z0-9+\-]+)/g, " sub $1")
    .replace(/([A-Za-z])([0-9]{1,3})\b/g, "$1 $2")
    .replace(/\{([^{}]+)\}/g, "$1")
    .replace(/\\/g, "")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s{2,}/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return result;
}

function normalizeAnswerStructure(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/(\n|^)\s*(\d+)\.\s*/g, "$1$2. ")
    .replace(/([^\n])\s+(\d+\.\s)/g, "$1\n\n$2")
    .replace(/([^\n])\s+-\s+/g, "$1\n- ")
    .replace(/([^\n:])\s+([A-Z][A-Za-z][A-Za-z ]{2,40}:)/g, "$1\n\n$2")
    .replace(/:\s+(?=-\s)/g, ":\n- ")
    .replace(/([.!?])\s+(?=\d+\.\s)/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function isAnswerHeading(line) {
  const value = String(line || "").trim();
  if (!value || value.length > 70) {
    return false;
  }

  return /^[0-9]+\. .+/.test(value)
    || /^[A-Z][A-Za-z0-9 ()/-]{2,}:$/.test(value)
    || /^(In Plain English|In a Nutshell|Why It Matters|Key Idea|Main Idea)$/i.test(value);
}

function formatInlineRichText(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,:;!?])/g, "$1<em>$2</em>");
}

function formatLeadLabel(line) {
  return String(line || "").replace(
    /^([A-Z][A-Za-z0-9 ()/-]{1,50}:)(\s*)/,
    "<strong>$1</strong>$2"
  );
}

function applyReadableScripts(text) {
  return String(text || "")
    .replace(/10 to the power of ([+\-]?\d+)/g, "10<sup>$1</sup>")
    .replace(/([A-Za-z]) to the power of ([+\-]?\d+)/g, "$1<sup>$2</sup>")
    .replace(/([A-Za-z]) sub ([A-Za-z0-9+\-]+)/g, "$1<sub>$2</sub>")
    .replace(/([A-Za-z])_([A-Za-z0-9+\-]+)/g, "$1<sub>$2</sub>");
}

function applyReadableSymbols(text) {
  return String(text || "")
    .replace(/\bH[\s-]*hat\b/g, "Ĥ")
    .replace(/\bh[\s-]*hat\b/g, "ĥ")
    .replace(/\bh[\s-]*bar\b/g, "ℏ")
    .replace(/\bH[\s-]*bar\b/g, "H̄")
    .replace(/\(\s*Psi\s*\(\s*Ψ\s*\)\s*\)/g, "(Ψ)")
    .replace(/\(\s*psi\s*\(\s*ψ\s*\)\s*\)/g, "(ψ)")
    .replace(/\bPsi\s*\(\s*Ψ\s*\)/g, "Ψ")
    .replace(/\bpsi\s*\(\s*ψ\s*\)/g, "ψ")
    .replace(/\bAlpha\s*\(\s*Α\s*\)/g, "Α")
    .replace(/\balpha\s*\(\s*α\s*\)/g, "α")
    .replace(/\bBeta\s*\(\s*Β\s*\)/g, "Β")
    .replace(/\bbeta\s*\(\s*β\s*\)/g, "β")
    .replace(/\bGamma\s*\(\s*Γ\s*\)/g, "Γ")
    .replace(/\bgamma\s*\(\s*γ\s*\)/g, "γ")
    .replace(/\bDelta\s*\(\s*Δ\s*\)/g, "Δ")
    .replace(/\bdelta\s*\(\s*δ\s*\)/g, "δ")
    .replace(/\bTheta\s*\(\s*Θ\s*\)/g, "Θ")
    .replace(/\btheta\s*\(\s*θ\s*\)/g, "θ")
    .replace(/\bLambda\s*\(\s*Λ\s*\)/g, "Λ")
    .replace(/\blambda\s*\(\s*λ\s*\)/g, "λ")
    .replace(/\bSigma\s*\(\s*Σ\s*\)/g, "Σ")
    .replace(/\bsigma\s*\(\s*σ\s*\)/g, "σ")
    .replace(/\bOmega\s*\(\s*Ω\s*\)/g, "Ω")
    .replace(/\bomega\s*\(\s*ω\s*\)/g, "ω")
    .replace(/\bpi\s*\(\s*π\s*\)/g, "π")
    .replace(/\bmu\s*\(\s*μ\s*\)/g, "μ")
    .replace(/\bPsi\b/g, "Ψ")
    .replace(/\bpsi\b/g, "ψ")
    .replace(/\bAlpha\b/g, "Α")
    .replace(/\balpha\b/g, "α")
    .replace(/\bBeta\b/g, "Β")
    .replace(/\bbeta\b/g, "β")
    .replace(/\bGamma\b/g, "Γ")
    .replace(/\bgamma\b/g, "γ")
    .replace(/\bDelta\b/g, "Δ")
    .replace(/\bdelta\b/g, "δ")
    .replace(/\bTheta\b/g, "Θ")
    .replace(/\btheta\b/g, "θ")
    .replace(/\bLambda\b/g, "Λ")
    .replace(/\blambda\b/g, "λ")
    .replace(/\bSigma\b/g, "Σ")
    .replace(/\bsigma\b/g, "σ")
    .replace(/\bOmega\b/g, "Ω")
    .replace(/\bomega\b/g, "ω")
    .replace(/(\d)\s*pi\b/g, "$1π")
    .replace(/(\d)\s*Pi\b/g, "$1Π")
    .replace(/\bpi\b/g, "π")
    .replace(/\bPi\b/g, "Π")
    .replace(/\bmu\b/g, "μ");
}

function shouldAutoScroll(element) {
  if (!element) {
    return false;
  }

  const threshold = 48;
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
  return distanceFromBottom <= threshold;
}

function buildTypingSegments(text) {
  const segments = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === "\n") {
      segments.push({ text: "\n", delay: 40 });
      index += 1;
      continue;
    }

    if (/\s/.test(char)) {
      let whitespace = char;
      index += 1;
      while (index < text.length && /\s/.test(text[index]) && text[index] !== "\n") {
        whitespace += text[index];
        index += 1;
      }
      segments.push({ text: whitespace, delay: 8 });
      continue;
    }

    let chunk = char;
    index += 1;
    while (index < text.length && !/\s/.test(text[index])) {
      chunk += text[index];
      index += 1;
    }

    const lastChar = chunk[chunk.length - 1];
    let delay = 16;
    if (/[,:;]/.test(lastChar)) {
      delay = 28;
    } else if (/[.!?]/.test(lastChar)) {
      delay = 40;
    }

    segments.push({ text: chunk, delay });
  }

  return segments;
}

function exportNotes() {
  const notes = getNotes().filter((note) => note.subject === currentSubject);
  if (!notes.length) {
    if (dom.noteCount) {
      dom.noteCount.textContent = `No saved ${currentSubject} notes available to export yet.`;
    }
    return;
  }

  const payload = notes
    .map((note, index) => [
      `${index + 1}. ${note.title}`,
      `Saved: ${formatSavedAt(note.savedAt)}`,
      "",
      note.content,
    ].join("\n"))
    .join("\n\n--------------------\n\n");

  const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${currentSubject}-notes-export.txt`;
  anchor.click();
  URL.revokeObjectURL(url);

  if (dom.noteCount) {
    dom.noteCount.textContent = `Exported ${notes.length} ${currentSubject} notes to a text file.`;
  }
}

function formatSavedAt(value) {
  if (!value) {
    return "Saved recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved recently";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}











