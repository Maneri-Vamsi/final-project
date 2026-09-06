# G-DMAD: Multi-Agent System Architecture & Inter-Agent Connections

## Executive Summary

The **G-DMAD (Group-Based Diverse Multi-Agent Debate)** system is an advanced multi-agent consensus and reasoning framework designed for complex problem-solving. It eliminates single-agent hallucinations and cognitive bias through **intra-group cognitive diversity**, **inter-group adversarial debate**, and **multi-dimensional meta-evaluation** across multiple rounds.

---

## 1. System Topology & Connection Architecture

The system operates across two structural tiers:
1. **Intra-Group Tier (Agent Level)**: Diverse cognitive agents reason together in sequential dependency to formulate a unified group answer.
2. **Inter-Group Tier (Group Level)**: Groups with contrasting analytical perspectives run simultaneously in parallel threads, whose outputs are evaluated and cross-pollinated across rounds.

```mermaid
graph TD
    subgraph User Input
        Q[User Question]
    end

    subgraph Parallel Group Execution (Thread Pool)
        subgraph Group 1 [Analytical / Constructive]
            G1_IO[IO Agent: Direct Baseline] --> G1_CCoT[CCoT Agent: Scene Graph]
            G1_CCoT --> G1_DDCoT[DDCoT Agent: Sub-question Decomposition]
            G1_DDCoT --> G1_Agg[Group 1 Synthesis]
        end

        subgraph Group 2 [Critical / Dialectical]
            G2_IO[IO Agent: Direct Baseline] --> G2_CCoT[CCoT Agent: Scene Graph]
            G2_CCoT --> G2_DDCoT[DDCoT Agent: Sub-question Decomposition]
            G2_DDCoT --> G2_Agg[Group 2 Synthesis]
        end
    end

    subgraph Evaluation & Consensus
        G1_Agg --> ME[Meta-Evaluator: 4D Scoring]
        G2_Agg --> ME
        ME --> LS[Leader Selector: Tie-Break & Selection]
        LS --> LA[Winning Leader Answer]
    end

    subgraph Cross-Round Propagation
        LA -->|Injected into Context for Round R+1| G1_IO
        LA -->|Injected into Context for Round R+1| G2_IO
    end

    subgraph Final Output
        LA -->|Round 3 Complete| Final[Final Extracted Answer]
    end

    Q --> G1_IO
    Q --> G2_IO
```

---

## 2. Agent Catalog & Functional Specifications

### 2.1 IO Agent (Input-Output Agent)
* **File**: `agents/io_agent.py`
* **Prompt**: `prompts/io_prompt.txt`
* **Cognitive Role**: Direct Baseline Reasoning.

#### How It Works:
- Serves as the first responder in every group round.
- Provides a direct, plain-text response to the question without intermediate chain-of-thought overhead.
- In **Round 1**: Generates a foundational answer based on the group's analytical stance and user prompt.
- In **Round > 1**: Receives the previous round's **Leader Answer** in its context to adjust its direct answer.

#### Input & Output:
* **Inputs**:
  - `question`: The user prompt.
  - `round_number`: Integer (1, 2, or 3).
  - `context_text`: Rendered group memory (including previous leader answers and group perspective).
* **Output**: Plain-text direct answer.

---

### 2.2 CCoT Agent (Canonical Chain-of-Thought / Scene-Graph Agent)
* **File**: `agents/ccot_agent.py`
* **Prompt**: `prompts/ccot_prompt.txt`
* **Cognitive Role**: Structural & Relational Modeling.

#### How It Works:
- Builds a structured mental model of the problem using an explicit **Scene Graph**.
- Maps out key entities, attributes, relationships, and constraints in JSON representation.
- Conducts step-by-step deduction directly grounded on this scene graph.
- Reads the preceding `IO_Agent` answer to build upon or correct naive assumptions.

#### Input & Output:
* **Inputs**:
  - `question`: User prompt.
  - `round_number`: Current round.
  - `context_text`: Group history and debate context.
  - `extra_info`: Preceding `IO_Agent` answer.
* **Output**: JSON Scene Graph + derived step-by-step reasoning.

---

### 2.3 DDCoT Agent (Dynamic Decomposition Chain-of-Thought Agent)
* **File**: `agents/ddcot_agent.py`
* **Prompt**: `prompts/ddcot_prompt.txt`
* **Cognitive Role**: Divide-and-Conquer Problem Decomposition.

#### How It Works:
- Deconstructs complex inquiries into granular, independent sub-questions.
- Solves each sub-question individually.
- Synthesizes the sub-answers into an integrated final resolution.
- Receives answers from both `IO_Agent` and `CCoT_Agent` to resolve potential contradictions before finalizing the group's stance.

#### Input & Output:
* **Inputs**:
  - `question`: User prompt.
  - `round_number`: Current round.
  - `context_text`: Group memory.
  - `extra_info`: Combined `IO Answer` + `CCoT Answer`.
* **Output**: Ordered sub-questions, answers, and integrated group resolution.

---

### 2.4 Group Manager
* **File**: `group/group_manager.py`
* **Cognitive Role**: Intra-Group Coordinator & Memory Manager.

#### How It Works:
1. **Perspective Differentiation**:
   - **Group 1**: Configured with an **Analytical & Constructive** perspective (emphasizes direct empirical evidence, core formulas, and affirmative proofs).
   - **Group 2**: Configured with a **Critical & Dialectical** perspective (scrutinizes assumptions, tests boundary conditions, and explores counter-arguments).
2. **Sequential Agent Execution**:
   - Executes `IO_Agent` -> feeds result into `CCoT_Agent` -> feeds both into `DDCoT_Agent`.
3. **Synthesis Aggregation**:
   - Aggregates all three outputs into a structured `Group Answer`.
4. **Context Logging**:
   - Stores every agent output and round leader answer into `GroupContext` (`memory/context.py`).

---

### 2.5 Meta-Evaluator
* **File**: `leader/meta_evaluator.py`
* **Prompt**: `prompts/meta_prompt.txt`
* **Cognitive Role**: Objective Multi-Dimensional Arbiter.

#### How It Works:
- Receives the synthesized outputs from all participating groups simultaneously.
- Scores each group from 0 to 10 across four orthogonal dimensions:
  1. **Evidence Grounding (EG)**: Factual/mathematical backing without speculative leaps.
  2. **Logical Coherence (LC)**: Consistency of deductive steps and absence of contradictions.
  3. **Hallucination Detection (HD)**: Freedom from fabricated assertions or computational mistakes.
  4. **Depth of Thought (DT)**: Nuance, handling of edge cases, and thoroughness.
- Computes `Total_Score` (0 to 40) and produces concise critical commentary (`Detailed_Reasoning`).
- Features a resilient JSON parser capable of extracting data from raw JSON, markdown code blocks, or unstructured LLM output.

---

### 2.6 Leader Selector
* **File**: `leader/leader_selector.py`
* **Cognitive Role**: Deterministic Decision-Maker & Fair Tie-Breaker.

#### How It Works:
- Compares evaluations produced by the Meta-Evaluator to choose the round winner.
- Implements a hierarchical 6-stage tie-breaking mechanism:
  Total Score -> Depth of Thought -> Evidence Grounding -> Logical Coherence -> Detailed Reasoning Length -> Round Rotation.
- Eliminates bias toward Group 1, ensuring the winner is chosen strictly on merit.

---

### 2.7 Debate Engine (Orchestration Tier)
* **File**: `debate/debate_engine.py`
* **Cognitive Role**: System Orchestrator & SSE Event Streamer.

#### How It Works:
1. Spawns Group 1 and Group 2 concurrently using Python's `ThreadPoolExecutor`.
2. Emits thread-safe Server-Sent Events (SSE) to stream live progress to the frontend.
3. Passes both completed group syntheses to the `MetaEvaluator`.
4. Invokes `LeaderSelector` to determine the round leader.
5. Injects the winning answer into each group's memory context for the next round.
6. Upon completing all rounds (default: 3), extracts and formats the final consensus answer.

---

## 3. Inter-Agent Data Flow (Step-by-Step)

| Step | Initiator | Receiver | Data Transferred | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1** | User | Debate Engine | `question` string | Starts debate session. |
| **2** | Debate Engine | Group 1 & Group 2 | `question`, `round_number=1`, `leader_answer=None` | Initiates parallel group execution in threads. |
| **3** | Group Manager | IO Agent | `question`, `context_text` | Generates initial direct answer. |
| **4** | IO Agent | CCoT Agent | `IO_Answer` | Provides baseline for scene-graph generation. |
| **5** | CCoT Agent | DDCoT Agent | `IO_Answer` + `CCoT_Answer` | Provides relational structure for decomposition. |
| **6** | DDCoT Agent | Group Manager | `DDCoT_Answer` | Finalizes intra-group reasoning. |
| **7** | Group Manager | Debate Engine | `Group_Answer` (aggregated) | Completes round execution for this group. |
| **8** | Debate Engine | Meta-Evaluator | `[Group 1 Answer, Group 2 Answer]` | Solicits independent grading on 4 metrics. |
| **9** | Meta-Evaluator | Leader Selector | `evaluations` JSON array | Passes scores (EG, LC, HD, DT, Total). |
| **10** | Leader Selector | Debate Engine | `winner_index` (1 or 2) | Declares the round winner. |
| **11** | Debate Engine | Group Contexts | `winner_answer` as `leader_answer` | Updates memory for Round 2 & Round 3 debate. |
| **12** | Debate Engine | UI (Client) | SSE Event Stream | Updates live timer, tokens, panels, and scores. |

---

## 4. Why This Architecture Delivers Superior Accuracy

1. **Elimination of Monolithic Blind Spots**: Rather than relying on a single prompt, three complementary agent types (`IO`, `CCoT`, `DDCoT`) test the problem from intuitive, structural, and deductive angles.
2. **Adversarial Scrutiny**: Group 1 and Group 2 operate with opposing perspectives (affirmative construction vs. critical skepticism), ensuring edge cases and false assumptions are detected.
3. **Convergence Through Rounds**: By feeding the winning leader answer into the next round, groups iteratively correct mistakes until reaching an optimal consensus.
