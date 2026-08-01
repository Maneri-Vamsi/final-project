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

const elements = {
    runBtn: document.getElementById("run-btn"),
    clearBtn: document.getElementById("clear-btn"),
    questionInput: document.getElementById("question-input"),
    spinnerWrap: document.getElementById("spinner-wrap"),
    runState: document.getElementById("run-state"),
    currentStage: document.getElementById("current-stage"),
    progressValue: document.getElementById("progress-value"),
    progressFill: document.getElementById("progress-fill"),
    statusLine: document.getElementById("status-line"),
    activeProcess: document.getElementById("active-process"),
    activeProcessDetail: document.getElementById("active-process-detail"),
    latestDecision: document.getElementById("latest-decision"),
    latestDecisionDetail: document.getElementById("latest-decision-detail"),
    reasoningFlow: document.getElementById("reasoning-flow"),
    timeline: document.getElementById("timeline"),
    statTime: document.getElementById("stat-time"),
    statStage: document.getElementById("stat-stage"),
    statAgents: document.getElementById("stat-agents"),
    statGroups: document.getElementById("stat-groups"),
    statEvaluations: document.getElementById("stat-evaluations"),
    statRounds: document.getElementById("stat-rounds"),
    statusStack: document.getElementById("status-stack"),
    debateJourney: document.getElementById("debate-journey"),
    agentResponses: document.getElementById("agent-responses"),
    groupFormation: document.getElementById("group-formation"),
    groupDebate: document.getElementById("group-debate"),
    evaluationResults: document.getElementById("evaluation-results"),
    winningGroup: document.getElementById("winning-group"),
    leaderSynthesis: document.getElementById("leader-synthesis"),
    finalAnswer: document.getElementById("final-answer"),
    finalRuntime: document.getElementById("final-runtime"),
};

const state = {
    running: false,
    startedAt: 0,
    timerId: null,
    finalElapsedSeconds: 0,
    completedAgents: 0,
    completedEvaluations: 0,
    totalGroups: 0,
    totalRounds: 0,
    currentStage: "Waiting",
    activeStageIndex: -1,
    stageSet: new Set(),
    groups: [],
    rounds: new Map(),
    latestDecisionText: "",
};

function initTimeline() {
    elements.timeline.innerHTML = "";
    stageOrder.forEach((stage, index) => {
        const item = document.createElement("div");
        item.className = "timeline-item";
        item.dataset.stage = stage;
        item.innerHTML = `
            <div class="timeline-index">${index + 1}</div>
            <div>
                <strong>${stage}</strong>
            </div>
            <div class="timeline-status">Pending</div>
        `;
        elements.timeline.appendChild(item);
    });
}

function updateReasoningFlow(stage) {
    const mapping = {
        "Question Received": 0,
        "Initializing Agents": 1,
        "Generating Independent Agent Reasoning": 1,
        "Group Formation": 2,
        "Group Debate": 2,
        "Evaluation": 2,
        "Winner Selection": 3,
        "Leader Synthesis": 3,
        "Final Answer": 3,
    };
    const activeIndex = mapping[stage] ?? -1;
    const steps = elements.reasoningFlow.querySelectorAll(".flow-step");
    steps.forEach((step, index) => {
        step.classList.remove("active", "complete");
        if (index < activeIndex) {
            step.classList.add("complete");
        } else if (index === activeIndex) {
            step.classList.add("active");
        }
    });
}

function setStage(stage, statusText) {
    state.currentStage = stage;
    elements.currentStage.textContent = stage;
    elements.statStage.textContent = stage;
    if (statusText) {
        elements.statusLine.textContent = statusText;
    }

    const stageIndex = stageOrder.indexOf(stage);
    if (stageIndex >= 0) {
        state.activeStageIndex = Math.max(state.activeStageIndex, stageIndex);
        state.stageSet.add(stage);
    }

    document.querySelectorAll(".timeline-item").forEach((item, index) => {
        const label = item.dataset.stage;
        const status = item.querySelector(".timeline-status");
        item.classList.remove("active", "complete");

        if (label === stage) {
            item.classList.add("active");
            status.textContent = "Running";
        } else if (state.stageSet.has(label) || index < stageIndex) {
            item.classList.add("complete");
            status.textContent = "Completed";
        } else {
            status.textContent = "Pending";
        }
    });

    updateReasoningFlow(stage);
    updateProgress();
}

function pushStatus(text) {
    const pill = document.createElement("div");
    pill.className = "status-pill";
    pill.textContent = text;
    elements.statusStack.prepend(pill);
}

function updateProgress() {
    const baseStageProgress = state.stageSet.size / stageOrder.length;
    const totalAgentSteps = state.totalGroups && state.totalRounds ? state.totalGroups * 3 * state.totalRounds : 0;
    const totalEvalSteps = state.totalRounds || 0;
    const agentProgress = totalAgentSteps ? state.completedAgents / totalAgentSteps : 0;
    const evalProgress = totalEvalSteps ? state.completedEvaluations / totalEvalSteps : 0;
    const composite = Math.min(1, (baseStageProgress * 0.55) + (agentProgress * 0.3) + (evalProgress * 0.15));
    const percent = Math.round(composite * 100);

    elements.progressValue.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
}

function formatElapsed(seconds) {
    return `${Number(seconds).toFixed(1)}s`;
}

function updateTimer() {
    if (!state.startedAt) {
        elements.statTime.textContent = "0.0s";
        elements.finalRuntime.textContent = "0.0s";
        return;
    }
    const elapsed = state.finalElapsedSeconds || ((Date.now() - state.startedAt) / 1000);
    const formatted = formatElapsed(elapsed);
    elements.statTime.textContent = formatted;
    elements.finalRuntime.textContent = formatted;
}

function setActiveProcess(title, detail) {
    elements.activeProcess.textContent = title;
    elements.activeProcessDetail.textContent = detail;
}

function setLatestDecision(title, detail) {
    state.latestDecisionText = title;
    elements.latestDecision.textContent = title;
    elements.latestDecisionDetail.textContent = detail;
}

function ensureRound(roundNumber) {
    if (!state.rounds.has(roundNumber)) {
        state.rounds.set(roundNumber, {
            groups: new Map(),
            evaluations: [],
            winnerIndex: null,
            leaderAnswer: "",
        });
    }
    return state.rounds.get(roundNumber);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function summarizeText(text, limit = 180) {
    if (!text) {
        return "No content available.";
    }
    const normalized = String(text).replace(/\s+/g, " ").trim();
    return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function resetState(clearQuestion = false) {
    state.running = false;
    state.startedAt = 0;
    state.finalElapsedSeconds = 0;
    state.completedAgents = 0;
    state.completedEvaluations = 0;
    state.totalGroups = 0;
    state.totalRounds = 0;
    state.currentStage = "Waiting";
    state.activeStageIndex = -1;
    state.stageSet = new Set();
    state.groups = [];
    state.rounds = new Map();
    state.latestDecisionText = "";

    clearInterval(state.timerId);
    state.timerId = null;

    if (clearQuestion) {
        elements.questionInput.value = "";
    }

    elements.runBtn.disabled = false;
    elements.clearBtn.disabled = false;
    elements.spinnerWrap.hidden = true;
    elements.runState.textContent = "Idle";
    elements.currentStage.textContent = "Waiting";
    elements.progressValue.textContent = "0%";
    elements.progressFill.style.width = "0%";
    elements.statusLine.textContent = "Initializing...";
    elements.activeProcess.textContent = "Waiting for a question";
    elements.activeProcessDetail.textContent = "The dashboard will show which agent or stage is currently working.";
    elements.latestDecision.textContent = "No decision yet";
    elements.latestDecisionDetail.textContent = "Agent outputs, winning groups, and leader synthesis decisions will appear here.";
    elements.statTime.textContent = "0.0s";
    elements.statStage.textContent = "Idle";
    elements.statAgents.textContent = "0";
    elements.statGroups.textContent = "0";
    elements.statEvaluations.textContent = "0";
    elements.statRounds.textContent = "0";
    elements.statusStack.innerHTML = "";

    elements.debateJourney.className = "journey-grid empty-state";
    elements.debateJourney.textContent = "The question-to-conclusion path will appear here while the debate runs.";
    elements.agentResponses.className = "content-grid empty-state";
    elements.agentResponses.textContent = "Run a debate to view agent reasoning.";
    elements.groupFormation.className = "content-grid empty-state";
    elements.groupFormation.textContent = "Configured groups will appear here.";
    elements.groupDebate.className = "content-grid empty-state";
    elements.groupDebate.textContent = "Group debate synthesis will appear here.";
    elements.evaluationResults.className = "content-grid empty-state";
    elements.evaluationResults.textContent = "Evaluation metrics will appear here.";
    elements.winningGroup.className = "content-grid empty-state";
    elements.winningGroup.textContent = "Winning groups by round will be highlighted here.";
    elements.leaderSynthesis.className = "content-grid empty-state";
    elements.leaderSynthesis.textContent = "Leader synthesis will appear here.";
    elements.finalAnswer.className = "final-answer empty-state";
    elements.finalAnswer.textContent = "The final answer will appear here.";
    elements.finalRuntime.textContent = "0.0s";

    initTimeline();
    updateReasoningFlow("Waiting");
}

function beginRun() {
    state.running = true;
    state.startedAt = Date.now();
    state.finalElapsedSeconds = 0;
    elements.runBtn.disabled = true;
    elements.spinnerWrap.hidden = false;
    elements.runState.textContent = "Running";
    setStage("Question Received", "Question received. Starting G-DMAD execution.");
    setActiveProcess("Question received", "The pipeline has accepted the problem and is preparing the multi-agent reasoning process.");
    pushStatus("Initializing...");
    state.timerId = window.setInterval(updateTimer, 100);
}

function renderGroups() {
    if (!state.groups.length) {
        return;
    }

    elements.groupFormation.className = "content-grid";
    elements.groupFormation.innerHTML = state.groups.map((group) => `
        <div class="content-card">
            <h4>Group ${group.group_index}</h4>
            <span class="decision-chip">Debate team</span>
            <ul>
                ${group.agents.map((agent) => `<li>${agent}</li>`).join("")}
            </ul>
        </div>
    `).join("");
}

function renderAgentResponses() {
    const cards = [];
    Array.from(state.rounds.entries()).sort((a, b) => a[0] - b[0]).forEach(([roundNumber, round]) => {
        Array.from(round.groups.entries()).sort((a, b) => a[0] - b[0]).forEach(([groupIndex, group]) => {
            Object.entries(group.agents || {}).forEach(([agentName, answer]) => {
                cards.push(`
                    <div class="content-card">
                        <h4>Round ${roundNumber} | Group ${groupIndex} | ${agentName}</h4>
                        <span class="decision-chip">Independent reasoning</span>
                        <pre>${escapeHtml(answer)}</pre>
                    </div>
                `);
            });
        });
    });

    elements.agentResponses.className = cards.length ? "content-grid" : "content-grid empty-state";
    elements.agentResponses.innerHTML = cards.length ? cards.join("") : "Run a debate to view agent reasoning.";
}

function renderGroupDebates() {
    const cards = [];
    Array.from(state.rounds.entries()).sort((a, b) => a[0] - b[0]).forEach(([roundNumber, round]) => {
        Array.from(round.groups.entries()).sort((a, b) => a[0] - b[0]).forEach(([groupIndex, group]) => {
            if (!group.groupAnswer) {
                return;
            }
            cards.push(`
                <div class="content-card">
                    <h4>Round ${roundNumber} | Group ${groupIndex}</h4>
                    <span class="decision-chip">Group debate synthesis</span>
                    <pre>${escapeHtml(group.groupAnswer)}</pre>
                </div>
            `);
        });
    });

    elements.groupDebate.className = cards.length ? "content-grid" : "content-grid empty-state";
    elements.groupDebate.innerHTML = cards.length ? cards.join("") : "Group debate synthesis will appear here.";
}

function renderEvaluations() {
    const cards = [];
    Array.from(state.rounds.entries()).sort((a, b) => a[0] - b[0]).forEach(([roundNumber, round]) => {
        round.evaluations.forEach((evaluation) => {
            cards.push(`
                <div class="content-card">
                    <h4>Round ${roundNumber} | Group ${evaluation.Group_Index || "?"}</h4>
                    <div class="metric-grid">
                        <div class="metric"><span>Evidence Grounding</span><strong>${evaluation.Evidence_Grounding ?? "-"}</strong></div>
                        <div class="metric"><span>Logical Coherence</span><strong>${evaluation.Logical_Coherence ?? "-"}</strong></div>
                        <div class="metric"><span>Hallucination Detection</span><strong>${evaluation.Hallucination_Detection ?? "-"}</strong></div>
                        <div class="metric"><span>Depth of Thought</span><strong>${evaluation.Depth_of_Thought ?? "-"}</strong></div>
                        <div class="metric"><span>Total Score</span><strong>${evaluation.Total_Score ?? "-"}</strong></div>
                        <div class="metric"><span>Detailed Reasoning</span><strong>${escapeHtml(evaluation.Detailed_Reasoning ?? "-")}</strong></div>
                    </div>
                </div>
            `);
        });
    });

    elements.evaluationResults.className = cards.length ? "content-grid" : "content-grid empty-state";
    elements.evaluationResults.innerHTML = cards.length ? cards.join("") : "Evaluation metrics will appear here.";
}

function renderWinners() {
    const cards = [];
    Array.from(state.rounds.entries()).sort((a, b) => a[0] - b[0]).forEach(([roundNumber, round]) => {
        if (!round.winnerIndex) {
            return;
        }
        cards.push(`
            <div class="content-card highlight">
                <h4>Round ${roundNumber}</h4>
                <span class="decision-chip">Winner selected</span>
                <p>Winning Group: Group ${round.winnerIndex}</p>
            </div>
        `);
    });

    elements.winningGroup.className = cards.length ? "content-grid" : "content-grid empty-state";
    elements.winningGroup.innerHTML = cards.length ? cards.join("") : "Winning groups by round will be highlighted here.";
}

function renderLeaderSynthesis() {
    const cards = [];
    Array.from(state.rounds.entries()).sort((a, b) => a[0] - b[0]).forEach(([roundNumber, round]) => {
        if (!round.leaderAnswer) {
            return;
        }
        cards.push(`
            <div class="content-card">
                <h4>Round ${roundNumber} Leader Synthesis</h4>
                <span class="decision-chip">Conclusion carrier</span>
                <pre>${escapeHtml(round.leaderAnswer)}</pre>
            </div>
        `);
    });

    elements.leaderSynthesis.className = cards.length ? "content-grid" : "content-grid empty-state";
    elements.leaderSynthesis.innerHTML = cards.length ? cards.join("") : "Leader synthesis will appear here.";
}

function renderFinalAnswer(answer) {
    elements.finalAnswer.className = "final-answer";
    elements.finalAnswer.textContent = answer || "No final answer returned.";
}

function finalizeElapsed(elapsedSeconds) {
    if (typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
        state.finalElapsedSeconds = elapsedSeconds;
    } else if (state.startedAt) {
        state.finalElapsedSeconds = (Date.now() - state.startedAt) / 1000;
    }
    updateTimer();
}

function renderJourney() {
    const sortedRounds = Array.from(state.rounds.entries()).sort((a, b) => a[0] - b[0]);
    if (!sortedRounds.length) {
        elements.debateJourney.className = "journey-grid empty-state";
        elements.debateJourney.textContent = "The question-to-conclusion path will appear here while the debate runs.";
        return;
    }

    const [latestRoundNumber, latestRound] = sortedRounds[sortedRounds.length - 1];
    const firstGroupEntry = Array.from(latestRound.groups.entries()).sort((a, b) => a[0] - b[0])[0];
    const debateSummary = firstGroupEntry ? summarizeText(firstGroupEntry[1].groupAnswer || "", 220) : "Waiting for group synthesis.";
    const winnerText = latestRound.winnerIndex ? `Group ${latestRound.winnerIndex} selected as the strongest reasoning path.` : "Winner not selected yet.";
    const leaderSummary = latestRound.leaderAnswer ? summarizeText(latestRound.leaderAnswer, 220) : "Leader synthesis pending.";

    elements.debateJourney.className = "journey-grid";
    elements.debateJourney.innerHTML = `
        <article class="journey-card">
            <h4>1. Problem Intake</h4>
            <p>${escapeHtml(summarizeText(elements.questionInput.value || "No question entered.", 220))}</p>
            <strong>The question becomes the shared target for all reasoning agents.</strong>
        </article>
        <article class="journey-card">
            <h4>2. Agent Thinking</h4>
            <p>${escapeHtml(state.latestDecisionText || "Agents are forming their own viewpoints.")}</p>
            <strong>Round ${latestRoundNumber} shows parallel independent reasoning before debate.</strong>
        </article>
        <article class="journey-card">
            <h4>3. Debate and Decision</h4>
            <p>${escapeHtml(debateSummary)}</p>
            <strong>${escapeHtml(winnerText)}</strong>
        </article>
        <article class="journey-card">
            <h4>4. Conclusion</h4>
            <p>${escapeHtml(leaderSummary)}</p>
            <strong>The selected leader synthesis becomes the answer trajectory.</strong>
        </article>
    `;
}

function renderAll() {
    renderGroups();
    renderAgentResponses();
    renderGroupDebates();
    renderEvaluations();
    renderWinners();
    renderLeaderSynthesis();
    renderJourney();
}

function handleEvent(event) {
    switch (event.type) {
        case "question_received":
            setStage("Question Received", "Question received by the debate pipeline.");
            setActiveProcess("Question intake", "The system is registering the problem statement and preparing the execution path.");
            pushStatus("Loading Configuration...");
            break;
        case "stage_update":
            setStage(event.stage, `${event.stage}...`);
            setActiveProcess(event.stage, `${event.stage} is currently in progress.`);
            pushStatus(`${event.stage}...`);
            break;
        case "agents_initialized":
            state.groups = event.groups || [];
            state.totalGroups = event.total_groups || 0;
            state.totalRounds = event.total_rounds || 0;
            elements.statGroups.textContent = String(state.totalGroups);
            elements.statRounds.textContent = String(state.totalRounds);
            renderGroups();
            setStage("Initializing Agents", "Creating agents and preparing group execution.");
            setActiveProcess("Agents initialized", `${state.totalGroups} groups are ready, each with IO, CCoT, and DDCoT agents.`);
            pushStatus("Creating Agents...");
            renderJourney();
            updateProgress();
            break;
        case "round_started":
            setStage("Generating Independent Agent Reasoning", `Round ${event.round_number} agent reasoning in progress.`);
            setActiveProcess(`Round ${event.round_number} reasoning`, "Agents are thinking independently before group debate begins.");
            pushStatus(`Running Round ${event.round_number}...`);
            break;
        case "leader_context_applied":
            setLatestDecision(`Leader context applied to Group ${event.group_index}`, `Round ${event.round_number} uses the previous leader output as context for continued reasoning.`);
            pushStatus(`Applying prior leader context to Group ${event.group_index} for Round ${event.round_number}.`);
            renderJourney();
            break;
        case "agent_started":
            setStage("Generating Independent Agent Reasoning", `Running ${event.agent_name} in Group ${event.group_index}, Round ${event.round_number}.`);
            setActiveProcess(`${event.agent_name} is reasoning`, `Group ${event.group_index}, Round ${event.round_number} is generating an independent viewpoint.`);
            pushStatus(`Running ${event.agent_name}...`);
            break;
        case "agent_completed": {
            const round = ensureRound(event.round_number);
            const group = round.groups.get(event.group_index) || { agents: {}, groupAnswer: "" };
            group.agents[event.agent_name] = event.answer;
            round.groups.set(event.group_index, group);
            state.completedAgents += 1;
            elements.statAgents.textContent = String(state.completedAgents);
            setLatestDecision(`${event.agent_name} finished for Group ${event.group_index}`, summarizeText(event.answer, 220));
            renderAgentResponses();
            renderJourney();
            updateProgress();
            break;
        }
        case "group_round_completed": {
            const round = ensureRound(event.round_number);
            round.groups.set(event.group_index, {
                agents: event.agent_answers || {},
                groupAnswer: event.group_answer || "",
            });
            setStage("Group Debate", `Group ${event.group_index} completed debate synthesis for Round ${event.round_number}.`);
            setActiveProcess("Group debate running", `Group ${event.group_index} has merged agent viewpoints into a synthesized group position.`);
            setLatestDecision(`Group ${event.group_index} formed its debate answer`, summarizeText(event.group_answer, 220));
            pushStatus("Running Group Debate...");
            renderAll();
            break;
        }
        case "evaluation_completed": {
            const round = ensureRound(event.round_number);
            round.evaluations = event.evaluations || [];
            state.completedEvaluations += 1;
            elements.statEvaluations.textContent = `${state.completedEvaluations}/${state.totalRounds || 0}`;
            setStage("Evaluation", `Evaluating groups for Round ${event.round_number}.`);
            setActiveProcess("Evaluation in progress", `Round ${event.round_number} outputs are being scored for evidence, coherence, hallucination control, and depth.`);
            setLatestDecision(`Evaluation completed for Round ${event.round_number}`, `Scored ${round.evaluations.length} group responses against the research evaluation criteria.`);
            pushStatus("Evaluating Groups...");
            renderEvaluations();
            renderJourney();
            updateProgress();
            break;
        }
        case "winner_selected": {
            const round = ensureRound(event.round_number);
            round.winnerIndex = event.winner_index;
            round.leaderAnswer = event.leader_synthesis || event.leader_answer || "";
            setStage("Winner Selection", `Winner selected for Round ${event.round_number}: Group ${event.winner_index}.`);
            setActiveProcess("Winner selected", `Group ${event.winner_index} has been chosen as the strongest debate output for Round ${event.round_number}.`);
            setLatestDecision(`Group ${event.winner_index} won Round ${event.round_number}`, summarizeText(event.final_answer || event.leader_answer, 220));
            pushStatus("Selecting Winner...");
            renderWinners();
            renderLeaderSynthesis();
            renderJourney();
            break;
        }
        case "leader_synthesis_completed": {
            const round = ensureRound(event.round_number);
            round.leaderAnswer = event.leader_synthesis || event.leader_answer || "";
            setStage("Leader Synthesis", `Leader synthesis completed for Round ${event.round_number}.`);
            setActiveProcess("Leader synthesis", "The winning group's reasoning is now being carried forward as the round leader answer.");
            setLatestDecision(`Leader synthesized Round ${event.round_number}`, summarizeText(event.final_answer || event.leader_answer, 220));
            pushStatus("Leader Synthesis...");
            renderLeaderSynthesis();
            renderJourney();
            break;
        }
        case "final_answer":
            setStage("Final Answer", "Generating final answer...");
            setActiveProcess("Final answer generation", "The last selected leader reasoning is being presented as the conclusion.");
            setLatestDecision("Conclusion ready", summarizeText(event.leader_answer, 220));
            pushStatus("Generating Final Answer...");
            renderFinalAnswer(event.leader_answer);
            renderJourney();
            break;
        case "complete":
            setStage("Final Answer", "Completed.");
            state.stageSet = new Set(stageOrder);
            updateProgress();
            elements.progressValue.textContent = "100%";
            elements.progressFill.style.width = "100%";
            elements.runState.textContent = "Completed";
            elements.statusLine.textContent = "Completed.";
            elements.runBtn.disabled = false;
            elements.spinnerWrap.hidden = true;
            setActiveProcess("Execution complete", "All agent reasoning, debates, evaluations, and synthesis steps have finished.");
            pushStatus("Completed.");
            clearInterval(state.timerId);
            state.timerId = null;
            finalizeElapsed(event.elapsed_seconds);
            if (event.result) {
                renderFinalAnswer(event.result.leader_answer);
            }
            renderJourney();
            break;
        case "error":
            elements.runState.textContent = "Error";
            elements.statusLine.textContent = event.message || "An unexpected error occurred.";
            elements.spinnerWrap.hidden = true;
            elements.runBtn.disabled = false;
            setActiveProcess("Execution error", "The pipeline stopped before completing the debate.");
            clearInterval(state.timerId);
            state.timerId = null;
            finalizeElapsed(event.elapsed_seconds);
            pushStatus(`Error: ${event.message || "Unknown error"}`);
            break;
        default:
            break;
    }
}

async function streamDebate(question) {
    const response = await fetch("/debate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/x-ndjson",
        },
        body: JSON.stringify({ question }),
    });

    if (!response.ok) {
        const message = (await response.text()) || "Failed to start the debate pipeline.";
        throw new Error(message);
    }

    if (!response.body) {
        throw new Error("The server did not return a readable event stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }
            handleEvent(JSON.parse(trimmed));
        });
    }

    if (buffer.trim()) {
        handleEvent(JSON.parse(buffer.trim()));
    }
}

async function runDebate() {
    const question = elements.questionInput.value.trim();
    if (!question || state.running) {
        return;
    }

    resetState(false);
    beginRun();

    try {
        await streamDebate(question);
    } catch (error) {
        handleEvent({ type: "error", message: error.message });
    } finally {
        state.running = false;
    }
}

elements.runBtn.addEventListener("click", runDebate);
elements.clearBtn.addEventListener("click", () => resetState(true));

initTimeline();
updateReasoningFlow("Waiting");
