import os
from fpdf import FPDF

class GDMADReportPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return  # Skip header on title page
        self.set_text_color(74, 85, 104)  # Slate Gray
        self.set_font("helvetica", "I", 8)
        self.cell(0, 10, "G-DMAD: Group-Based Diverse Multi-Agent Debate", border=0, ln=0, align="L")
        self.cell(0, 10, "Project Report", border=0, ln=1, align="R")
        self.set_draw_color(226, 232, 240)  # Light border
        self.line(20, 18, 190, 18)
        self.ln(5)

    def footer(self):
        if self.page_no() == 1:
            return  # Skip footer on title page
        self.set_y(-15)
        self.set_text_color(113, 128, 150)
        self.set_font("helvetica", "I", 8)
        self.set_draw_color(226, 232, 240)
        self.line(20, self.get_y() - 2, 190, self.get_y() - 2)
        self.cell(0, 10, f"Page {self.page_no()} of {{nb}}", border=0, ln=0, align="C")

    def title_page(self):
        self.add_page()
        # Ambient decoration - draw some colored rectangles
        self.set_fill_color(26, 54, 93)  # Deep Blue
        self.rect(0, 0, 15, 297, "F")  # Sidebar accent

        # Top Margin space
        self.set_y(40)
        self.set_x(25)
        self.set_text_color(113, 128, 150)  # Secondary text color
        self.set_font("helvetica", "B", 12)
        self.cell(0, 10, "FINAL YEAR PROJECT REPORT", ln=1)
        self.ln(5)

        # Title
        self.set_x(25)
        self.set_text_color(26, 54, 93)  # Primary Deep Blue
        self.set_font("helvetica", "B", 26)
        self.multi_cell(165, 12, "G-DMAD: Group-Based\nDiverse Multi-Agent Debate\nfor Robust Reasoning")
        self.ln(10)

        # Decorative line
        self.set_draw_color(43, 108, 176)  # Bright Blue
        self.set_line_width(1.5)
        self.line(25, self.get_y(), 95, self.get_y())
        self.ln(15)

        # Subtitle
        self.set_x(25)
        self.set_text_color(74, 85, 104)
        self.set_font("helvetica", "", 14)
        self.multi_cell(165, 7, "A collaborative framework implementing group hierarchy, agent diversity, multi-round debates, and meta-evaluation for robust reasoning tasks.")
        self.ln(50)

        # Meta-info
        self.set_x(25)
        self.set_text_color(45, 55, 72)
        self.set_font("helvetica", "B", 10)
        self.cell(0, 6, "Subject Area:", ln=1)
        self.set_x(25)
        self.set_font("helvetica", "", 10)
        self.cell(0, 6, "Artificial Intelligence, Large Language Models (LLMs), Multi-Agent Systems", ln=1)
        self.ln(5)

        self.set_x(25)
        self.set_font("helvetica", "B", 10)
        self.cell(0, 6, "Runtime Implementation:", ln=1)
        self.set_x(25)
        self.set_font("helvetica", "", 10)
        self.cell(0, 6, "FastAPI, LangChain, Vanilla JS & CSS Glassmorphic Telemetry Console", ln=1)
        self.ln(25)

        # Footer-style details
        self.set_x(25)
        self.set_text_color(113, 128, 150)
        self.set_font("helvetica", "I", 10)
        self.cell(0, 6, "Prepared for Evaluation - Academic Year 2025-2026", ln=1)

    def chapter_title(self, num, title):
        self.set_font("helvetica", "B", 16)
        self.set_text_color(26, 54, 93)  # Primary Deep Blue
        self.ln(8)
        self.cell(0, 10, f"{num}. {title}", border=0, ln=1, align="L")
        self.ln(4)

    def section_title(self, num_str, title):
        self.set_font("helvetica", "B", 12)
        self.set_text_color(43, 108, 176)  # Bright Blue
        self.ln(4)
        self.cell(0, 8, f"{num_str} {title}", border=0, ln=1, align="L")
        self.ln(2)

    def body_text(self, text):
        self.set_font("helvetica", "", 10)
        self.set_text_color(45, 55, 72)  # Charcoal
        self.multi_cell(0, 6.5, text)
        self.ln(3)

    def bullet_item(self, bold_prefix, text):
        self.set_font("helvetica", "B", 10)
        self.set_text_color(45, 55, 72)
        self.write(6.5, f" - {bold_prefix}: ")
        self.set_font("helvetica", "", 10)
        self.write(6.5, f"{text}\n")
        self.ln(1)

    def callout_box(self, text):
        self.set_fill_color(247, 250, 252)  # Light Slate
        self.set_draw_color(226, 232, 240)
        self.set_line_width(0.5)
        self.set_font("helvetica", "I", 9.5)
        self.set_text_color(74, 85, 104)
        # Add page break check manually or use multi_cell
        self.multi_cell(0, 6, text, border=1, fill=True)
        self.ln(4)

def generate_pdf(output_path):
    pdf = GDMADReportPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_margins(20, 20, 20)

    # Title Page
    pdf.title_page()

    # Content Page 2
    pdf.add_page()
    pdf.chapter_title("1", "Executive Summary & Introduction")
    pdf.section_title("1.1", "Abstract")
    pdf.callout_box(
        "G-DMAD (Group-Based Diverse Multi-Agent Debate) is an advanced reasoning framework "
        "designed to address the core limitations of single Large Language Model (LLM) agents, "
        "such as hallucination, confirmation bias, and reasoning fragility. By organizing specialized "
        "agents (IO, CCoT, DDCoT) into distinct hierarchical groups, the system parallelizes reasoning, "
        "facilitates consensus through structured multi-round debate, and utilizes a central Meta Evaluator "
        "to synthesize and propagate the highest quality reasoning output. This report documents the "
        "architectural design, component specifications, and local runtime environment."
    )

    pdf.section_title("1.2", "Introduction & Motivation")
    pdf.body_text(
        "Large Language Models (LLMs) have demonstrated exceptional capabilities in general language tasks. "
        "However, complex reasoning (mathematical, logical, and commonsense) remains a challenge. A single "
        "reasoning chain is highly susceptible to logical fallacies. Once an LLM starts reasoning down an "
        "incorrect path, it rarely self-corrects without outside intervention.\n\n"
        "To mitigate this, Multi-Agent Debate (MAD) frameworks have emerged, allowing agents to critique and "
        "refine each other's outputs. However, standard MAD approaches often suffer from "
        "consensus collapse (where agents prematurely agree on an incorrect answer) or lack cognitive diversity. "
        "G-DMAD introduces cognitive diversity by employing multiple specialized agent reasoning strategies "
        "and organizes them into hierarchical groups to resolve debate scale issues."
    )

    pdf.section_title("1.3", "Key Design Objectives")
    pdf.bullet_item("Cognitive Diversity", "Avoid consensus collapse by utilizing three unique reasoning methodologies for agents.")
    pdf.bullet_item("Hierarchical Scaling", "Organize debate in groups, preventing token overhead and 'noise' from too many parallel voices.")
    pdf.bullet_item("Independent Evaluation", "Introduce a central Meta Evaluator that objectively selects the winning group's consensus based on logical criteria rather than simple voting.")

    # Content Page 3
    pdf.add_page()
    pdf.chapter_title("2", "Architecture & Methodology")
    pdf.body_text(
        "The G-DMAD framework is structured around three core concepts: Agent Diversity, Group Managers, "
        "and Meta-Evaluation/Leader Selection. The logical flow is managed across multiple rounds to ensure "
        "progressive refinement."
    )

    pdf.section_title("2.1", "Specialized Agent Roles")
    pdf.body_text(
        "Within each group, three agents operate in parallel. Each agent utilizes a unique prompt structure "
        "tailored for a specific style of reasoning:"
    )
    pdf.bullet_item(
        "IO (Input-Output) Agent",
        "Acts as the baseline. It responds directly and clearly to the question in plain text, "
        "focusing on immediate answer generation without explicit decomposition or graph mapping."
    )
    pdf.bullet_item(
        "CCoT (Context/Scene-Graph Chain of Thought) Agent",
        "Generates a JSON-formatted scene graph containing objects, attributes, and relationships "
        "extracted from the problem context, then performs logical reasoning on top of the structured graph."
    )
    pdf.bullet_item(
        "DDCoT (Decomposed/Diverse Chain of Thought) Agent",
        "Decomposes the core problem into discrete, smaller sub-questions, answers each sub-question "
        "independently, and integrates the results into a final coherent answer."
    )

    pdf.section_title("2.2", "Group Managers & Consensus")
    pdf.body_text(
        "A Group Manager orchestrates the execution of these three diverse agents. In each round, the "
        "Group Manager triggers the agents with the current problem context and any information inherited "
        "from the previous round. Once individual outputs are collected, the Group Manager synthesizes "
        "them into a unified Group Consensus Answer. This reduces the cognitive footprint of the debate "
        "to a single voice per group, avoiding token bloat."
    )

    # Content Page 4
    pdf.add_page()
    pdf.chapter_title("3", "Evaluation and Leader Propagation")
    pdf.body_text(
        "To decide which group's consensus contains the most accurate and logical reasoning, the framework "
        "implements a meta-evaluation step."
    )

    pdf.section_title("3.1", "The Meta Evaluator")
    pdf.body_text(
        "The Meta Evaluator is a dedicated LLM instance tasked with critiquing the consensus answers of "
        "all groups. Instead of simple voting, it evaluates each answer based on structured dimensions:\n"
        "  1. Completeness: Does it fully answer the original question?\n"
        "  2. Logical Consistency: Are there logical fallacies or contradictions in the reasoning?\n"
        "  3. Step-by-Step Correctness: Are the intermediate reasoning steps sound?\n"
        "The evaluator assigns scores and outputs a detailed critique for each group."
    )

    pdf.section_title("3.2", "Leader Selector and Propagation")
    pdf.body_text(
        "The Leader Selector analyzes the evaluation scores. The group with the highest score is selected "
        "as the Leader for that round. Its consensus is chosen as the 'Leader Answer'.\n\n"
        "In the subsequent round, this Leader Answer is propagated back to all agents across all groups "
        "as 'Additional Context'. This creates a feedback loop, forcing lower-performing groups and "
        "agents to refine their thinking based on the leader's superior logic, prompting convergence "
        "towards the correct answer by the final round."
    )

    # Decorative Process Flow
    pdf.ln(5)
    pdf.section_title("3.3", "Summary of the G-DMAD Execution Loop")
    pdf.callout_box(
        "Question Intake -> Agent Independent Reasoning (IO, CCoT, DDCoT) -> Group Consensus Synthesis -> "
        "Meta Evaluation of Group Consensus -> Leader Selection -> Propagation of Leader Answer to Round N+1 -> "
        "Final Round Aggregation and Answer Extraction."
    )

    # Content Page 5
    pdf.add_page()
    pdf.chapter_title("4", "Runtime Implementation & User Interface")
    pdf.body_text(
        "The implementation provides a production-grade FastAPI backend API and a modern web dashboard "
        "built to help researchers visualize the multi-agent reasoning trace in real time."
    )

    pdf.section_title("4.1", "Backend Tech Stack")
    pdf.bullet_item("FastAPI", "Serves the endpoints, handles CORS, and exposes streaming connections.")
    pdf.bullet_item("LangChain", "Used for standardizing prompt templates and orchestrating LLM calls.")
    pdf.bullet_item("Streaming Responses", "Utilizes Server-Sent Events (application/x-ndjson) to stream live reasoning steps to the client as they occur, avoiding HTTP timeout issues during long multi-round executions.")

    pdf.section_title("4.2", "Research Dashboard")
    pdf.body_text(
        "The web interface is designed using modern CSS design principles, featuring a dark-themed glassmorphism "
        "aesthetic, vibrant neon telemetry signals, and responsive grid layouts.\n\n"
        "Features of the dashboard:\n"
        "  - Real-Time Progress Bar: Tracks the active reasoning stage (Intake, Reasoning, Debate, Evaluation).\n"
        "  - Telemetry Console: Shows raw debug lines and token metrics streamed directly from the LLM client.\n"
        "  - Dynamic Cards: Renders the individual outputs of IO, CCoT, and DDCoT agents side-by-side.\n"
        "  - Selection Highlights: Clearly highlights the winning group of each round and shows the Meta Evaluator's critique.\n"
        "  - Final Answer Card: Cleanly displays the final extracted, verified answer at the bottom."
    )

    pdf.section_title("5", "Conclusion")
    pdf.body_text(
        "G-DMAD successfully scales multi-agent reasoning by introducing group-level hierarchies and "
        "cognitive diversity. The local web interface and API ensure that developers can trace and analyze "
        "exactly how agents reach a conclusion. This framework offers a highly robust alternative to "
        "traditional single-prompt LLM tasks, providing reliable outputs for complex problem-solving."
    )

    # Output to File
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf.output(output_path)
    print(f"PDF successfully generated at {output_path}")

if __name__ == "__main__":
    generate_pdf(r"c:\Users\vamsi\OneDrive\Documents\final year project\G-DMAD_Project_Report.pdf")
