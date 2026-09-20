/* ═══════════════════════════════════════════════
   G-DMAD App Controller
   ═══════════════════════════════════════════════ */

const stageOrder = [
    "Question Received",
    "Initializing Agents",
    "Generating Independent Agent Reasoning",
    "Group Formation",
    "Group Debate",
    "Evaluation",
    "Winner Selection",
    "Leader Synthesis",
    "Final Answer",
];

const $ = (id) => document.getElementById(id);

const el = {
    runBtn: $("run-btn"),
    clearBtn: $("clear-btn"),
    questionInput: $("question-input"),
    spinnerWrap: $("spinner-wrap"),
    navStatus: $("nav-status"),
    elapsedTime: $("elapsed-time"),
    totalTokens: $("total-tokens"),
    progressBadge: $("progress-badge"),
    progressFill: $("progress-fill"),
    logStream: $("log-stream"),

    // Token stats
    promptTokens: $("prompt-tokens"),
    completionTokens: $("completion-tokens"),
    totalTokensDetail: $("total-tokens-detail"),
    apiCalls: $("api-calls"),

    // Group panels
    group1Agents: $("group-1-agents"),
    group2Agents: $("group-2-agents"),
    group1Status: $("group-1-status"),
    group2Status: $("group-2-status"),
    group1Synthesis: $("group-1-synthesis"),
    group2Synthesis: $("group-2-synthesis"),
    group1Panel: $("group-1-panel"),
    group2Panel: $("group-2-panel"),

    // Eval
    evalGrid: $("eval-grid"),
    evalRoundBadge: $("eval-round-badge"),

    // Final
    finalAnswer: $("final-answer"),
    finalTime: $("final-time"),
    finalTokens: $("final-tokens"),
    finalCalls: $("final-calls"),
};

const state = {
    running: false,
    startedAt: 0,
    timerId: null,
    stageSet: new Set(),
    completedAgents: 0,
    totalGroups: 0,
    totalRounds: 0,
    tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, api_calls: 0 },
    rounds: new Map(),

    // Track per-group, per-agent state for the LATEST round
    groupAgents: { 1: {}, 2: {} },
    groupSynthesis: { 1: "", 2: "" },

    // Individual token tracking per agent across rounds
    agentTokens: {
        "1_IO_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "1_CCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "1_DDCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "2_IO_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "2_CCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "2_DDCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    },
};

/* ── Helpers ── */
function setProcessing(active) {
    if (!el.spinnerWrap) return;
    el.spinnerWrap.hidden = !active;
    el.spinnerWrap.style.display = active ? "inline-flex" : "none";
}

// Ensure processing spinner is hidden on initial load
setProcessing(false);

function updateAgentBreakdown() {
    const map = {
        "1_IO_Agent": "tok-g1-io",
        "1_CCoT_Agent": "tok-g1-ccot",
        "1_DDCoT_Agent": "tok-g1-ddcot",
        "2_IO_Agent": "tok-g2-io",
        "2_CCoT_Agent": "tok-g2-ccot",
        "2_DDCoT_Agent": "tok-g2-ddcot",
    };
    for (const [key, id] of Object.entries(map)) {
        const itemEl = $(id);
        if (itemEl) {
            const val = state.agentTokens[key]?.total_tokens || 0;
            itemEl.textContent = `${val.toLocaleString()} tok`;
        }
    }
}

function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(text, len = 120) {
    if (!text) return "";
    const s = String(text).replace(/\s+/g, " ").trim();
    return s.length > len ? s.slice(0, len) + "…" : s;
}

function formatTime(ms) {
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = (totalSec % 60).toFixed(1);
    return min > 0 ? `${String(min).padStart(2, "0")}:${sec.padStart(4, "0")}` : `00:${sec.padStart(4, "0")}`;
}

function logTimeStamp() {
    if (!state.startedAt) return "00:00";
    const sec = ((Date.now() - state.startedAt) / 1000).toFixed(1);
    return sec.padStart(5, " ") + "s";
}

/* ── Logging ── */
function log(text, cls = "log-info") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${cls}`;
    entry.innerHTML = `<span class="log-time">${logTimeStamp()}</span>${escapeHtml(text)}`;
    el.logStream.appendChild(entry);
    el.logStream.scrollTop = el.logStream.scrollHeight;
}

/* ── Timer ── */
function updateTimer() {
    if (!state.startedAt) return;
    const ms = Date.now() - state.startedAt;
    el.elapsedTime.textContent = formatTime(ms);
}

/* ── Token Usage ── */
function updateTokens(usage) {
    if (!usage) return;
    state.tokenUsage = usage;
    el.promptTokens.textContent = (usage.prompt_tokens || 0).toLocaleString();
    el.completionTokens.textContent = (usage.completion_tokens || 0).toLocaleString();
    el.totalTokensDetail.textContent = (usage.total_tokens || 0).toLocaleString();
    el.apiCalls.textContent = usage.api_calls || 0;
    el.totalTokens.textContent = `${(usage.total_tokens || 0).toLocaleString()} tokens`;
}

/* ── Progress ── */
function updateProgress() {
    const pct = Math.round((state.stageSet.size / stageOrder.length) * 100);
    el.progressBadge.textContent = `${pct}%`;
    el.progressFill.style.width = `${pct}%`;
}

/* ── Pipeline Steps ── */
function setStage(stage) {
    state.stageSet.add(stage);
    const stageIndex = stageOrder.indexOf(stage);
    document.querySelectorAll(".step").forEach((step, i) => {
        step.classList.remove("active", "complete");
        const stepStage = step.dataset.stage;
        if (stepStage === stage) {
            step.classList.add("active");
        } else if (state.stageSet.has(stepStage) || i < stageIndex) {
            step.classList.add("complete");
        }
    });
    updateProgress();
}

/* ── Group Agent Rendering ── */
function renderGroupAgents(groupIndex) {
    const container = groupIndex === 1 ? el.group1Agents : el.group2Agents;
    const agents = state.groupAgents[groupIndex] || {};
    const agentDefs = [
        { key: "IO_Agent", icon: "io", label: "IO", name: "IO Agent" },
        { key: "CCoT_Agent", icon: "ccot", label: "CC", name: "CCoT Agent" },
        { key: "DDCoT_Agent", icon: "ddcot", label: "DD", name: "DDCoT Agent" },
    ];

    container.innerHTML = agentDefs.map((def) => {
        const data = agents[def.key];
        const statusCls = data
            ? data.status === "running" ? "running" : "completed"
            : "empty-slot";
        const content = data
            ? data.status === "running"
                ? "Generating response..."
                : truncate(data.answer, 140)
            : "Waiting for input...";

        const tokKey = `${groupIndex}_${def.key}`;
        const tokData = state.agentTokens[tokKey] || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const totalToks = tokData.total_tokens || 0;
        const promptToks = tokData.prompt_tokens || 0;
        const compToks = tokData.completion_tokens || 0;

        let badgeHtml = "";
        if (data?.status === "running") {
            badgeHtml = `<span class="agent-token-badge running-pulse" title="Reasoning in progress..."><span class="pulse-dot"></span>${totalToks > 0 ? totalToks.toLocaleString() + ' tok' : 'Active'}</span>`;
        } else if (totalToks > 0) {
            badgeHtml = `<span class="agent-token-badge has-tokens" title="Prompt: ${promptToks.toLocaleString()} | Completion: ${compToks.toLocaleString()}">${totalToks.toLocaleString()} tokens</span>`;
        } else {
            badgeHtml = `<span class="agent-token-badge" title="Token counter">0 tokens</span>`;
        }

        return `
            <div class="agent-slot ${statusCls}">
                <span class="agent-icon ${def.icon}">${def.label}</span>
                <div class="agent-body">
                    <div class="agent-header">
                        <strong>${def.name}</strong>
                        ${badgeHtml}
                    </div>
                    <p>${escapeHtml(content)}</p>
                </div>
            </div>
        `;
    }).join("");
}

function renderGroupSynthesis(groupIndex) {
    const container = groupIndex === 1 ? el.group1Synthesis : el.group2Synthesis;
    const text = state.groupSynthesis[groupIndex];
    if (text) {
        container.className = "group-synthesis has-content";
        container.innerHTML = `
            <span class="synthesis-label">Group Synthesis</span>
            <p class="synthesis-text">${escapeHtml(truncate(text, 200))}</p>
        `;
    } else {
        container.className = "group-synthesis";
        container.innerHTML = `
            <span class="synthesis-label">Group Synthesis</span>
            <p class="synthesis-text">Pending debate synthesis...</p>
        `;
    }
}

function setGroupStatus(groupIndex, text) {
    const badge = groupIndex === 1 ? el.group1Status : el.group2Status;
    badge.textContent = text;
}

/* ── Evaluation Rendering ── */
function renderEvaluations(roundNumber, evaluations, winnerIndex) {
    el.evalRoundBadge.textContent = `R${roundNumber}`;
    el.evalGrid.innerHTML = evaluations.map((ev) => {
        const isWinner = ev.Group_Index === winnerIndex;
        return `
            <div class="eval-card ${isWinner ? "winner-card" : ""}">
                <div class="eval-card-header">
                    <strong>Group ${ev.Group_Index}</strong>
                    ${isWinner ? '<span class="winner-badge">★ Winner</span>' : ""}
                </div>
                <div class="scores-row">
                    <span class="score-chip">EG <span class="score-val">${ev.Evidence_Grounding ?? "-"}</span></span>
                    <span class="score-chip">LC <span class="score-val">${ev.Logical_Coherence ?? "-"}</span></span>
                    <span class="score-chip">HD <span class="score-val">${ev.Hallucination_Detection ?? "-"}</span></span>
                    <span class="score-chip">DT <span class="score-val">${ev.Depth_of_Thought ?? "-"}</span></span>
                    <span class="score-chip score-total">Total <span class="score-val">${ev.Total_Score ?? "-"}</span></span>
                </div>
            </div>
        `;
    }).join("");
}

/* ── Group winner highlight ── */
function highlightWinner(winnerIndex) {
    el.group1Panel.classList.remove("winner", "loser");
    el.group2Panel.classList.remove("winner", "loser");
    if (winnerIndex === 1) {
        el.group1Panel.classList.add("winner");
        el.group2Panel.classList.add("loser");
    } else if (winnerIndex === 2) {
        el.group2Panel.classList.add("winner");
        el.group1Panel.classList.add("loser");
    }
}

/* ── Reset ── */
function resetState(clearQuestion = false) {
    state.running = false;
    state.startedAt = 0;
    state.stageSet = new Set();
    state.completedAgents = 0;
    state.totalGroups = 0;
    state.totalRounds = 0;
    state.tokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, api_calls: 0 };
    state.rounds = new Map();
    state.groupAgents = { 1: {}, 2: {} };
    state.groupSynthesis = { 1: "", 2: "" };
    state.agentTokens = {
        "1_IO_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "1_CCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "1_DDCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "2_IO_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "2_CCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        "2_DDCoT_Agent": { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
    updateAgentBreakdown();

    clearInterval(state.timerId);
    state.timerId = null;

    if (clearQuestion) el.questionInput.value = "";

    el.runBtn.disabled = false;
    el.clearBtn.disabled = false;
    setProcessing(false);
    el.navStatus.textContent = "Idle";
    el.elapsedTime.textContent = "00:00.0";
    el.totalTokens.textContent = "0 tokens";
    el.progressBadge.textContent = "0%";
    el.progressFill.style.width = "0%";
    updateTokens(state.tokenUsage);

    // Reset groups
    [1, 2].forEach((g) => {
        renderGroupAgents(g);
        renderGroupSynthesis(g);
        setGroupStatus(g, "Waiting");
    });
    el.group1Panel.classList.remove("winner", "loser");
    el.group2Panel.classList.remove("winner", "loser");

    // Reset eval
    el.evalGrid.innerHTML = '<div class="eval-empty">Scores will appear after group debate completes.</div>';
    el.evalRoundBadge.textContent = "—";

    // Reset final
    el.finalAnswer.className = "final-answer";
    el.finalAnswer.textContent = "The final consensus answer will appear here after the debate concludes.";
    el.finalTime.textContent = "0.0s";
    el.finalTokens.textContent = "0";
    el.finalCalls.textContent = "0";

    // Reset pipeline
    document.querySelectorAll(".step").forEach((s) => s.classList.remove("active", "complete"));

    // Reset log
    el.logStream.innerHTML = '<div class="log-entry log-info">System ready. Enter a question to begin.</div>';
}

/* ── Begin Run ── */
function beginRun() {
    state.running = true;
    state.startedAt = Date.now();
    el.runBtn.disabled = true;
    setProcessing(true);
    el.navStatus.textContent = "Running";
    el.navStatus.closest(".stat-chip").querySelector("svg circle")?.setAttribute("fill", "#68d391");
    state.timerId = setInterval(updateTimer, 100);
    setStage("Question Received");
    log("Debate started", "log-stage");
}

/* ── Event Handler ── */
function handleEvent(event) {
    if (event.token_usage) updateTokens(event.token_usage);

    switch (event.type) {
        case "question_received":
            setStage("Question Received");
            log("Question received by pipeline", "log-info");
            break;

        case "stage_update":
            setStage(event.stage);
            log(`Stage: ${event.stage}`, "log-stage");
            break;

        case "agents_initialized":
            state.totalGroups = event.total_groups || 0;
            state.totalRounds = event.total_rounds || 0;
            setStage("Initializing Agents");
            [1, 2].forEach((g) => setGroupStatus(g, "Ready"));
            log(`${event.total_groups} groups × 3 agents initialized`, "log-info");
            break;

        case "round_started":
            setStage("Generating Independent Agent Reasoning");
            // Clear agent answer state for new round while preserving token usage
            state.groupAgents = { 1: {}, 2: {} };
            state.groupSynthesis = { 1: "", 2: "" };
            [1, 2].forEach((g) => {
                renderGroupAgents(g);
                renderGroupSynthesis(g);
                setGroupStatus(g, `R${event.round_number}`);
            });
            el.group1Panel.classList.remove("winner", "loser");
            el.group2Panel.classList.remove("winner", "loser");
            log(`Round ${event.round_number} started`, "log-stage");
            break;

        case "agent_started":
            state.groupAgents[event.group_index] = state.groupAgents[event.group_index] || {};
            state.groupAgents[event.group_index][event.agent_name] = { status: "running", answer: "" };
            if (event.agent_token_usage) {
                state.agentTokens[`${event.group_index}_${event.agent_name}`] = event.agent_token_usage;
                updateAgentBreakdown();
            }
            renderGroupAgents(event.group_index);
            setGroupStatus(event.group_index, "Reasoning");
            log(`G${event.group_index} ${event.agent_name} started`, "log-agent");
            break;

        case "agent_completed":
            state.groupAgents[event.group_index] = state.groupAgents[event.group_index] || {};
            state.groupAgents[event.group_index][event.agent_name] = { status: "completed", answer: event.answer };
            state.completedAgents++;
            if (event.agent_token_usage) {
                state.agentTokens[`${event.group_index}_${event.agent_name}`] = event.agent_token_usage;
                updateAgentBreakdown();
            }
            renderGroupAgents(event.group_index);
            const callToks = event.agent_last_token_usage?.total_tokens || event.agent_token_usage?.total_tokens;
            const tokInfo = callToks !== undefined ? ` (${callToks.toLocaleString()} tokens)` : "";
            log(`G${event.group_index} ${event.agent_name} completed${tokInfo}`, "log-success");
            break;

        case "leader_context_applied":
            log(`Leader context applied to Group ${event.group_index}`, "log-info");
            break;

        case "group_round_completed":
            setStage("Group Debate");
            state.groupSynthesis[event.group_index] = event.group_answer || "";
            if (event.agents_token_usage) {
                for (const [agentName, usage] of Object.entries(event.agents_token_usage)) {
                    state.agentTokens[`${event.group_index}_${agentName}`] = usage;
                }
                updateAgentBreakdown();
            }
            renderGroupSynthesis(event.group_index);
            setGroupStatus(event.group_index, "Debated");
            log(`G${event.group_index} debate synthesis complete`, "log-success");
            break;

        case "evaluation_completed": {
            setStage("Evaluation");
            const roundData = { evaluations: event.evaluations || [], winnerIndex: null };
            state.rounds.set(event.round_number, roundData);
            log(`Round ${event.round_number} evaluation complete`, "log-stage");
            break;
        }

        case "winner_selected": {
            setStage("Winner Selection");
            const rd = state.rounds.get(event.round_number) || { evaluations: [], winnerIndex: null };
            rd.winnerIndex = event.winner_index;
            state.rounds.set(event.round_number, rd);
            renderEvaluations(event.round_number, rd.evaluations, event.winner_index);
            highlightWinner(event.winner_index);
            log(`Round ${event.round_number}: Group ${event.winner_index} wins`, "log-success");
            break;
        }

        case "leader_synthesis_completed":
            setStage("Leader Synthesis");
            log(`Leader synthesis R${event.round_number} complete`, "log-info");
            break;

        case "final_answer":
            setStage("Final Answer");
            el.finalAnswer.className = "final-answer has-answer";
            el.finalAnswer.textContent = event.leader_answer || "No answer returned.";
            log("Final answer generated", "log-success");
            break;

        case "complete":
            state.stageSet = new Set(stageOrder);
            updateProgress();
            el.navStatus.textContent = "Completed";
            el.runBtn.disabled = false;
            setProcessing(false);
            clearInterval(state.timerId);
            state.timerId = null;

            if (event.elapsed_seconds) {
                const fmt = Number(event.elapsed_seconds).toFixed(1);
                el.elapsedTime.textContent = formatTime(event.elapsed_seconds * 1000);
                el.finalTime.textContent = `${fmt}s`;
            }
            el.finalTokens.textContent = (state.tokenUsage.total_tokens || 0).toLocaleString();
            el.finalCalls.textContent = state.tokenUsage.api_calls || 0;

            if (event.result?.leader_answer) {
                el.finalAnswer.className = "final-answer has-answer";
                el.finalAnswer.textContent = event.result.leader_answer;
            }
            if (event.result?.token_usage) updateTokens(event.result.token_usage);

            log("Pipeline completed successfully", "log-success");
            break;

        case "error":
            el.navStatus.textContent = "Error";
            el.runBtn.disabled = false;
            setProcessing(false);
            clearInterval(state.timerId);
            state.timerId = null;
            log(`Error: ${event.message || "Unknown error"}`, "log-error");
            break;
    }
}

/* ── Stream Debate ── */
async function streamDebate(question) {
    const res = await fetch("/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
        body: JSON.stringify({ question }),
    });

    if (!res.ok) throw new Error(await res.text() || "Failed to start debate.");
    if (!res.body) throw new Error("No event stream returned.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) handleEvent(JSON.parse(trimmed));
        }
    }
    if (buffer.trim()) handleEvent(JSON.parse(buffer.trim()));
}

/* ── Run Debate ── */
async function runDebate() {
    const question = el.questionInput.value.trim();
    if (!question) {
        el.questionInput.focus();
        el.questionInput.classList.add("input-shake");
        setTimeout(() => el.questionInput.classList.remove("input-shake"), 400);
        return;
    }
    if (state.running) return;

    resetState(false);
    beginRun();

    try {
        await streamDebate(question);
    } catch (err) {
        handleEvent({ type: "error", message: err.message });
    } finally {
        state.running = false;
        el.runBtn.disabled = false;
        setProcessing(false);
    }
}

/* ── Event Listeners ── */
// Click with cursor on "Run Debate" button
el.runBtn.addEventListener("click", (e) => {
    e.preventDefault();
    runDebate();
});

el.clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    resetState(true);
});

// Trigger debate on pressing Enter key (Shift+Enter allows multiline input)
el.questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runDebate();
    }
});

/* ── Theme Switcher (Dark / Light Mode) ── */
const themeToggleBtn = $("theme-toggle");
const themeLabel = $("theme-label");

function applyTheme(theme) {
    if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        if (themeLabel) themeLabel.textContent = "Dark";
        localStorage.setItem("g_dmad_theme", "light");
    } else {
        document.documentElement.removeAttribute("data-theme");
        if (themeLabel) themeLabel.textContent = "Light";
        localStorage.setItem("g_dmad_theme", "dark");
    }
}

// Initialize theme from localStorage or system preference
const savedTheme = localStorage.getItem("g_dmad_theme") || "dark";
applyTheme(savedTheme);

let isThemeTransitioning = false;

function toggleTheme(e) {
    if (isThemeTransitioning) return;

    const currentTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    const toDark = newTheme === "dark";

    // Calculate exact center coordinates of the theme toggle button
    const rect = themeToggleBtn.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    const endRadius = Math.ceil(
        Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        )
    ) + 30;

    // Bind CSS variables for native keyframes on root
    document.documentElement.style.setProperty("--theme-btn-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-btn-y", `${y}px`);
    document.documentElement.style.setProperty("--theme-end-radius", `${endRadius}px`);

    const transitionAttr = toDark ? "to-dark" : "to-light";
    document.documentElement.setAttribute("data-theme-transition", transitionAttr);

    // Modern View Transitions API with circular clip-path expansion / collapse
    if (document.startViewTransition) {
        isThemeTransitioning = true;

        const transition = document.startViewTransition(() => {
            applyTheme(newTheme);
        });

        transition.ready.then(() => {
            const animTarget = toDark ? "::view-transition-old(root)" : "::view-transition-new(root)";
            const keyframes = toDark
                ? [
                    { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
                    { clipPath: `circle(0px at ${x}px ${y}px)` }
                ]
                : [
                    { clipPath: `circle(0px at ${x}px ${y}px)` },
                    { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }
                ];

            const animation = document.documentElement.animate(keyframes, {
                duration: 650,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                pseudoElement: animTarget,
                fill: "forwards"
            });

            const cleanUp = () => {
                document.documentElement.removeAttribute("data-theme-transition");
                isThemeTransitioning = false;
            };

            animation.onfinish = cleanUp;
            animation.oncancel = cleanUp;
        }).catch(() => {
            document.documentElement.removeAttribute("data-theme-transition");
            isThemeTransitioning = false;
        });

        transition.finished.finally(() => {
            document.documentElement.removeAttribute("data-theme-transition");
            isThemeTransitioning = false;
        });
    } else {
        // High performance fallback for browsers without View Transitions
        isThemeTransitioning = true;
        const ripple = document.createElement("div");
        ripple.className = "theme-ripple-fallback";
        const size = endRadius * 2;
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x - endRadius}px`;
        ripple.style.top = `${y - endRadius}px`;

        if (toDark) {
            // Dark ends in button: light overlay contracts smoothly into button
            ripple.style.backgroundColor = "#f8fafc";
            ripple.style.transform = "scale(1)";
            ripple.style.opacity = "1";
            applyTheme("dark");
            document.body.appendChild(ripple);

            requestAnimationFrame(() => {
                ripple.style.transform = "scale(0)";
                setTimeout(() => {
                    ripple.remove();
                    document.documentElement.removeAttribute("data-theme-transition");
                    isThemeTransitioning = false;
                }, 600);
            });
        } else {
            // Light starts from button: light overlay expands smoothly from button
            ripple.style.backgroundColor = "#f8fafc";
            ripple.style.transform = "scale(0)";
            ripple.style.opacity = "1";
            document.body.appendChild(ripple);

            requestAnimationFrame(() => {
                ripple.style.transform = "scale(1)";
                setTimeout(() => {
                    applyTheme("light");
                    ripple.style.opacity = "0";
                    setTimeout(() => {
                        ripple.remove();
                        document.documentElement.removeAttribute("data-theme-transition");
                        isThemeTransitioning = false;
                    }, 350);
                }, 550);
            });
        }
    }
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
}

/* ── Draggable Splitter Divider ── */
function initSplitter() {
    const splitter = $("sidebar-splitter");
    const layout = document.querySelector(".layout");
    const sidebar = document.querySelector(".sidebar");
    const sidebarRight = document.querySelector(".sidebar-right");

    if (!splitter || !layout || !sidebar) return;

    const MIN_SIDEBAR_WIDTH = 220; // Question textarea & pipeline remain fully readable
    const MIN_MAIN_WIDTH = 340;    // Group panels & synthesis remain fully readable
    const MAX_SIDEBAR_CAP = 750;   // Prevent sidebar from overtaking on wide screens
    const DEFAULT_SIDEBAR_WIDTH = 320;

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    function getBounds() {
        const layoutRect = layout.getBoundingClientRect();
        const rightWidth = sidebarRight ? sidebarRight.offsetWidth : 280;
        const splitterWidth = splitter.offsetWidth || 6;
        const maxAllowed = Math.min(
            MAX_SIDEBAR_CAP,
            Math.max(MIN_SIDEBAR_WIDTH, layoutRect.width - rightWidth - splitterWidth - MIN_MAIN_WIDTH)
        );
        return { min: MIN_SIDEBAR_WIDTH, max: maxAllowed };
    }

    function setSidebarWidth(width, persist = true) {
        const bounds = getBounds();
        const clamped = Math.round(Math.max(bounds.min, Math.min(width, bounds.max)));
        layout.style.setProperty("--sidebar-width", `${clamped}px`);
        splitter.setAttribute("aria-valuenow", clamped);
        splitter.setAttribute("aria-valuemin", bounds.min);
        splitter.setAttribute("aria-valuemax", bounds.max);
        if (persist) {
            localStorage.setItem("g_dmad_sidebar_width", clamped);
        }
        return clamped;
    }

    // Restore saved width if available
    const saved = localStorage.getItem("g_dmad_sidebar_width");
    if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH) {
            setSidebarWidth(parsed, false);
        }
    } else {
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH, false);
    }
    const bounds = getBounds();
    splitter.setAttribute("aria-valuenow", DEFAULT_SIDEBAR_WIDTH);
    splitter.setAttribute("aria-valuemin", bounds.min);
    splitter.setAttribute("aria-valuemax", bounds.max);

    function onDragStart(clientX, pointerId) {
        isDragging = true;
        startX = clientX;
        startWidth = sidebar.getBoundingClientRect().width;

        splitter.classList.add("is-dragging");
        layout.classList.add("is-resizing");
        document.body.style.cursor = "col-resize";

        if (pointerId !== undefined && splitter.setPointerCapture) {
            try {
                splitter.setPointerCapture(pointerId);
            } catch (_) {}
        }
    }

    function onDragMove(clientX) {
        if (!isDragging) return;
        const deltaX = clientX - startX;
        setSidebarWidth(startWidth + deltaX, false);
    }

    function onDragEnd(pointerId) {
        if (!isDragging) return;
        isDragging = false;

        splitter.classList.remove("is-dragging");
        layout.classList.remove("is-resizing");
        document.body.style.cursor = "";

        if (pointerId !== undefined && splitter.releasePointerCapture) {
            try {
                splitter.releasePointerCapture(pointerId);
            } catch (_) {}
        }

        // Persist final width
        const currentWidth = sidebar.getBoundingClientRect().width;
        setSidebarWidth(currentWidth, true);
    }

    // Pointer Events
    splitter.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; // Only primary button
        e.preventDefault();
        onDragStart(e.clientX, e.pointerId);
    });

    splitter.addEventListener("pointermove", (e) => {
        if (isDragging) {
            e.preventDefault();
            onDragMove(e.clientX);
        }
    });

    splitter.addEventListener("pointerup", (e) => {
        onDragEnd(e.pointerId);
    });

    splitter.addEventListener("pointercancel", (e) => {
        onDragEnd(e.pointerId);
    });

    // Window safety listeners
    window.addEventListener("pointermove", (e) => {
        if (isDragging) onDragMove(e.clientX);
    });

    window.addEventListener("pointerup", (e) => {
        if (isDragging) onDragEnd(e.pointerId);
    });

    // Double-click to reset to default width
    splitter.addEventListener("dblclick", () => {
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH, true);
    });

    // Keyboard accessibility
    splitter.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 40 : 10;
        const currentWidth = sidebar.getBoundingClientRect().width;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            setSidebarWidth(currentWidth - step, true);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setSidebarWidth(currentWidth + step, true);
        } else if (e.key === "Home") {
            e.preventDefault();
            setSidebarWidth(MIN_SIDEBAR_WIDTH, true);
        } else if (e.key === "End") {
            e.preventDefault();
            setSidebarWidth(MAX_SIDEBAR_CAP, true);
        }
    });

    // Window resize handler
    window.addEventListener("resize", () => {
        if (!isDragging) {
            const currentWidth = sidebar.getBoundingClientRect().width;
            setSidebarWidth(currentWidth, false);
        }
    });
}

initSplitter();


