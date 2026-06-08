#!/usr/bin/env python3
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "red-bird-portfolio.pdf"

PAGE_W = 595
PAGE_H = 842
MARGIN_X = 42
TOP = 52
BOTTOM = 42
CONTENT_W = PAGE_W - 2 * MARGIN_X


def esc(text):
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text_width_approx(text, size):
    wide = sum(1 for c in text if c in "MW@#%&")
    narrow = sum(1 for c in text if c in "il.,:;|'! ")
    normal = len(text) - wide - narrow
    return size * (wide * 0.75 + normal * 0.52 + narrow * 0.28)


class Page:
    def __init__(self, number, title, kicker=None):
        self.ops = []
        self.y = PAGE_H - TOP
        self.number = number
        self.title = title
        self.kicker = kicker
        self.header()

    def raw(self, op):
        self.ops.append(op)

    def line(self, x1, y1, x2, y2, width=0.8):
        self.raw(f"{width} w {x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S")

    def rect(self, x, y, w, h, stroke=True, fill=False, gray=None):
        if gray is not None:
            self.raw(f"{gray:.3f} g")
        style = "B" if stroke and fill else "S" if stroke else "f"
        self.raw(f"{x:.1f} {y:.1f} {w:.1f} {h:.1f} re {style}")
        if gray is not None:
            self.raw("0 g")

    def text(self, x, y, text, size=10, font="F1", leading=None):
        leading = leading or size * 1.25
        self.raw(f"BT /{font} {size:.1f} Tf {leading:.1f} TL {x:.1f} {y:.1f} Td ({esc(text)}) Tj ET")

    def wrapped(self, text, x=None, size=10.2, font="F1", max_w=CONTENT_W, leading=None, gap=4):
        x = MARGIN_X if x is None else x
        leading = leading or size * 1.34
        words = text.split()
        lines = []
        cur = ""
        for word in words:
            test = word if not cur else cur + " " + word
            if text_width_approx(test, size) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                if text_width_approx(word, size) > max_w:
                    chars = max(12, int(max_w / (size * 0.52)))
                    chunks = textwrap.wrap(word, chars)
                    lines.extend(chunks[:-1])
                    cur = chunks[-1]
                else:
                    cur = word
        if cur:
            lines.append(cur)
        for line in lines:
            self.text(x, self.y, line, size=size, font=font, leading=leading)
            self.y -= leading
        self.y -= gap

    def h(self, text, size=21):
        self.text(MARGIN_X, self.y, text, size=size, font="F2")
        self.y -= size * 1.35

    def sub(self, text):
        self.text(MARGIN_X, self.y, text.upper(), size=8.5, font="F3")
        self.y -= 16

    def bullet(self, text, size=9.8):
        bullet_x = MARGIN_X + 8
        text_x = MARGIN_X + 22
        self.text(bullet_x, self.y, "-", size=size, font="F2")
        old_y = self.y
        self.wrapped(text, x=text_x, size=size, max_w=CONTENT_W - 24, gap=1)
        if self.y == old_y:
            self.y -= 13

    def codebox(self, text):
        lines = text.splitlines()
        h = 17 * len(lines) + 15
        self.rect(MARGIN_X, self.y - h + 8, CONTENT_W, h, stroke=True, fill=True, gray=0.955)
        y = self.y - 11
        for line in lines:
            self.text(MARGIN_X + 12, y, line, size=9.3, font="F4")
            y -= 17
        self.y -= h + 8

    def callout(self, text):
        h = 54
        self.rect(MARGIN_X, self.y - h + 8, CONTENT_W, h, stroke=True, fill=True, gray=0.975)
        self.text(MARGIN_X + 14, self.y - 14, "Working question", size=8.5, font="F3")
        self.text(MARGIN_X + 14, self.y - 34, text, size=11.5, font="F2")
        self.y -= h + 8

    def header(self):
        self.text(MARGIN_X, PAGE_H - 28, "Zhengyan Chen / Red Bird MPhil Portfolio", size=8.5, font="F3")
        self.text(PAGE_W - MARGIN_X - 34, PAGE_H - 28, f"{self.number}/6", size=8.5, font="F3")
        self.line(MARGIN_X, PAGE_H - 36, PAGE_W - MARGIN_X, PAGE_H - 36, 0.6)
        if self.kicker:
            self.sub(self.kicker)
        self.h(self.title)

    def footer(self):
        self.line(MARGIN_X, BOTTOM - 8, PAGE_W - MARGIN_X, BOTTOM - 8, 0.5)
        self.text(MARGIN_X, BOTTOM - 24, "AI Agents + EdTech / Tool use, human approval, reliable systems", size=8, font="F3")

    def stream(self):
        self.footer()
        return "\n".join(self.ops).encode("latin-1", errors="replace")


pages = []

p = Page(1, "AI Agents for Education and Reliable Workflows", "Personal theme")
p.wrapped("I am interested in building AI agents that do more than answer questions. The agents I want to build should understand real workflows, call tools, ask for human approval when needed, and help people make better decisions with less repetitive work.")
p.wrapped("My background connects physics, software engineering, machine learning systems, and education technology. In research, I studied LLM inference and compiler systems, where backend choices, floating-point precision, and evaluation pipelines can affect model behavior. In education, I saw a different problem: teachers already have digital platforms, but still spend too much time switching pages, checking student progress, assigning practice, and following up manually.")
p.callout("How can AI agents become reliable workflow partners for education?")
p.wrapped("I also actively use AI coding tools such as Codex and Claude Code in my engineering workflow. I use them to read codebases, draft implementation plans, debug, compare alternatives, and write documentation. Using these tools every day shaped how I think about agents: a useful agent needs context, tools, memory, constraints, and human control.")
p.codebox("Human workflow -> Agent -> Tools -> Data -> Human decision")
pages.append(p)

p = Page(2, "From Traditional OJ to Agent-Assisted Teaching", "New Oriental")
p.wrapped("During my Teaching Fellow (Management Trainee) experience at Suzhou New Oriental Training School, I coached students for informatics learning, including DFS/BFS, dynamic programming, arrays, and linked lists.")
p.wrapped("Working close to daily teaching operations helped me notice a limitation of traditional OJ systems. They are good at judging submissions, but weak at supporting what teachers need after judging.")
p.bullet("Who is falling behind?")
p.bullet("Which problems are blocking the class?")
p.bullet("Which student needs easier practice before moving on?")
p.bullet("Which plan should be adjusted this week?")
p.wrapped("I started thinking about the OJ platform not only as a judge, but as a teaching workflow system. My approach was to wrap core CRUD services into MCP tools, including problem management, learning plans, submissions, student progress, and recommendation-related data.")
p.wrapped("Once these services become tools, an agent can help teachers query progress, compare students, adjust plans, and generate personalized practice suggestions through natural language. The value is not in replacing teachers; it is in reducing operational friction so teachers can spend more time on judgment, guidance, and communication.")
p.codebox("Teacher -> Natural language request -> MCP tools -> Agent summary -> Teacher confirmation")
pages.append(p)

p = Page(3, "GESP Intelligent Practice Platform", "Live EdTech system")
p.wrapped("Live platform: https://gesp.growplan.top/", font="F3")
p.wrapped("I built and developed the GESP practice platform, an online programming practice and growth plan system used by about 1,000 students and teachers. The platform supports OJ programming practice, learning plans, student progress tracking, and teacher-side management.")
p.wrapped("The first version solved the basic infrastructure problem: students need a place to practice, submit code, and track progress; teachers need a way to assign plans and see completion. The more interesting problem is what comes next. A fixed plan is often too rigid. Different students fail for different reasons, and teachers cannot manually inspect every submission history all the time.")
p.wrapped("The direction I explored is to upgrade the platform into an adaptive learning loop:")
p.codebox("Practice -> Judge -> Track Progress\nIdentify Weakness -> Recommend Next Task -> Teacher Follow-up")
p.wrapped("In this design, OJ submissions and learning-plan progress become signals for an agent. The agent can analyze verdicts, unfinished tasks, repeated wrong attempts, weak topics, and practice duration, then recommend the next set of tasks. Teachers still keep control, but the system gives them better context and faster follow-up options.")
p.bullet("Full-stack education platform with real student and teacher usage")
p.bullet("A path from CRUD services to agent-driven learning support")
pages.append(p)

p = Page(4, "A Controllable WeCom Agent", "Human-in-the-loop automation")
p.wrapped("GitHub: https://github.com/Notborntodie/wecom-agent/", font="F3")
p.wrapped("At New Oriental, I built a WeCom agent used internally. The goal was not to create a fully autonomous bot. In a teaching and management environment, uncontrolled automation is risky. A wrong message can affect students, parents, teachers, or internal operations.")
p.wrapped("So I designed the agent around a controllable workflow:")
p.codebox("Message sensing -> LLM reply planning -> Human approval -> Safe execution")
p.wrapped("The agent turns a closed desktop communication environment into a semi-automated workflow. It reads relevant message context, drafts possible replies or actions with an LLM, asks for confirmation, and only executes after approval. This project strengthened my belief that safety is not an extra feature for applied agents; it is part of the architecture.")
p.wrapped("This also mirrors how I work with Codex and Claude Code. I use them to inspect code, propose diffs, find edge cases, and document decisions, while keeping the final responsibility and system judgment human-led.")
p.bullet("Practical agent engineering in an internal work environment")
p.bullet("Human approval and safe execution as first-class design choices")
pages.append(p)

p = Page(5, "LLM Systems, Compiler Backends, and Reliability", "Confidential UGA research")
p.wrapped("Role: Research Assistant, The University of Georgia, Jun 2024 - Jan 2025", font="F3")
p.wrapped("Note: confidential research experience; project details and data are not public.", font="F3")
p.wrapped("At the University of Georgia, I worked on confidential research related to deep learning compiler systems and LLM inference. Although I cannot disclose project details, this experience gave me a systems-level view of AI.")
p.wrapped("I worked with LLM inference and compilation frameworks such as llama.cpp and MLC-LLM. I explored backend support, including Vulkan, and enabled evaluation workflows with lm_eval, a widely used framework for measuring LLM accuracy across tasks.")
p.wrapped("The most valuable part was learning to think about AI reliability below the application layer. In LLM systems, a model output is not only determined by a prompt. It can also be affected by inference kernels, compiler optimizations, backend differences, floating-point precision, and evaluation setup.")
p.wrapped("Small numerical differences in logits may accumulate and eventually lead to different generated outputs, especially in autoregressive decoding. This experience made me more careful about agent systems: useful agents need reliable inference, careful evaluation, transparent tool use, and reproducible behavior where possible.")
p.codebox("Model -> Inference runtime -> Compiler/backend -> Hardware -> Evaluation")
pages.append(p)

p = Page(6, "Learning from Real Failures, Then Building Better Agents", "Production debugging + future direction")
p.wrapped("Publication: Demystifying Developers' Fight Against Complexity: A Comprehensive Study of Live Debugging Activities in Production Cloud Systems. SoCC 2024.", font="F3")
p.wrapped("In my remote research experience with Purdue University, I worked on a project studying how developers debug complex production cloud systems. My main contribution was collecting and organizing public real-world debugging cases from distributed systems and databases. This supported the analysis behind the SoCC 2024 publication.")
p.wrapped("This project taught me how engineers reason under uncertainty. In production debugging, people rarely know the answer at the beginning. They collect evidence, form hypotheses, inspect logs and traces, test assumptions, and gradually narrow down the problem.")
p.wrapped("A useful agent should behave more like a careful engineer than a text generator. It should gather context, call tools, verify assumptions, expose uncertainty, and keep humans in control when decisions matter.")
p.wrapped("This is why the Red Bird MPhil is attractive to me. I want to work in an environment where project-based research is connected with real systems and real users. My goal is to build AI agents for education that are practical, controllable, and technically reliable.")
p.bullet("GitHub: https://github.com/Notborntodie")
p.bullet("GESP: https://gesp.growplan.top/")
p.bullet("WeCom Agent: https://github.com/Notborntodie/wecom-agent/")
p.bullet("SoCC 2024 Paper: https://yonglezh-purdue.github.io/files/socc24-live-debugging.pdf")
pages.append(p)


class PDF:
    def __init__(self):
        self.objects = []

    def add(self, data):
        if isinstance(data, str):
            data = data.encode("latin-1", errors="replace")
        self.objects.append(data)
        return len(self.objects)

    def build(self, pages):
        self.objects = []
        catalog_id = self.add(b"")
        pages_id = self.add(b"")
        font_regular = self.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        font_bold = self.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
        font_oblique = self.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>")
        font_mono = self.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")
        page_ids = []
        for page in pages:
            stream = page.stream()
            content = b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
            content_id = self.add(content)
            page_obj = (
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
                f"/Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R /F3 {font_oblique} 0 R /F4 {font_mono} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            )
            page_ids.append(self.add(page_obj))
        kids = " ".join(f"{pid} 0 R" for pid in page_ids)
        self.objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
        self.objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for i, obj in enumerate(self.objects, start=1):
            offsets.append(len(out))
            out.extend(f"{i} 0 obj\n".encode())
            out.extend(obj)
            out.extend(b"\nendobj\n")
        xref = len(out)
        out.extend(f"xref\n0 {len(self.objects) + 1}\n".encode())
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode())
        out.extend(
            f"trailer\n<< /Size {len(self.objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
        )
        return bytes(out)


OUT.write_bytes(PDF().build(pages))
print(OUT)
