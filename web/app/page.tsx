import Link from "next/link";

const questions = [
  {
    day: "Day 003",
    q: "Last night you mentioned a deadline that scared you. What's the smallest version of it you could finish today?",
    excerpt:
      "...I think the real fear isn't missing the date. It's being seen as someone who overcommits and underdelivers...",
    tags: ["work", "fear", "self-image"],
  },
  {
    day: "Day 047",
    q: "You started running again last spring. What did running give back to you that the screen never did?",
    excerpt:
      "...there's a kind of attention you can only borrow from your legs. The screen charges interest on every thought...",
    tags: ["body", "attention", "ritual"],
  },
  {
    day: "Day 112",
    q: "Six months ago you wrote that your father never said 'I love you'. Has that changed, or have you?",
    excerpt:
      "...I called him on Tuesday. I think he said it back, but in Mandarin, so it sounded like weather...",
    tags: ["family", "language", "time"],
  },
];

const markdownSample = `---
id: 2026-04-18-morning-walk
created: 2026-04-18T07:42:09+08:00
duration: 4m12s
tags: [walk, decision, work]
---

# A decision I almost didn't make

The path along the canal was still wet from last night's rain.
I had been circling the same question for three weeks.

When I finally said it out loud — to myself, on a recording, at
seven in the morning — the answer was small and immediate. Not
the dramatic one I had been rehearsing.`;

const principles = [
  {
    label: "Voice in, Markdown out.",
    body: "Every recording becomes a typed, timestamped, tag-annotated Markdown file on your disk. Nothing is locked in a SaaS.",
  },
  {
    label: "Local-first, forever.",
    body: "Your autobiography lives in a folder you control. You can grep it, version it with git, hand it to another AI, or print it into a book.",
  },
  {
    label: "The AI gets better at asking.",
    body: "Today's question is shaped by your last 112 days. Tomorrow's is shaped by today's answer. The loop is the product.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-serif text-xl font-medium tracking-tight text-ink"
          >
            storytelling<span className="text-amber">.</span>
          </Link>
          <nav className="flex items-center gap-7 text-sm text-ink-soft">
            <a
              href="https://github.com/JacksonHe04/storytelling"
              className="transition-colors hover:text-ink"
            >
              GitHub
            </a>
            <a
              href="https://github.com/JacksonHe04/storytelling/blob/main/IDEA.md"
              className="transition-colors hover:text-ink"
            >
              The idea
            </a>
            <a
              href="https://github.com/JacksonHe04/storytelling#readme"
              className="transition-colors hover:text-ink"
            >
              Read the docs
            </a>
          </nav>
        </div>
      </header>

      {/* Hero — single-column, manuscript prose */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-3xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            an open-source long-memory
          </p>

          <h1 className="display-tight font-serif text-5xl text-ink mt-6 md:text-7xl lg:text-[5.5rem]">
            A daily interview that <br className="hidden md:block" />
            slowly turns into{" "}
            <span className="display-italic text-amber">you</span>.
          </h1>

          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            storytelling is a local-first AI that calls you each morning,
            listens to what you say, and quietly files it away as Markdown —
            a biography of you, written one short conversation at a time.
            No cloud lock-in. No terms of service over your memories.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-5">
            <a
              href="https://github.com/JacksonHe04/storytelling"
              className="group inline-flex items-center gap-2.5 border border-ink bg-ink px-5 py-3 font-mono text-sm text-paper transition-colors hover:bg-amber hover:border-amber hover:text-ink"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="size-4 fill-current"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              Read on GitHub
              <span className="border-l border-paper/30 pl-2.5 font-mono text-[11px] uppercase tracking-wider opacity-70 group-hover:text-ink">
                early days
              </span>
            </a>
            <a
              href="https://github.com/JacksonHe04/storytelling/blob/main/IDEA.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-serif text-base italic text-ink-soft underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-amber"
            >
              why I&apos;m building this →
            </a>
          </div>
        </div>
      </section>

      {/* Signature — the daily interview, shown as actual artifacts */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
                What the AI actually does
              </p>
              <h2 className="font-serif text-3xl text-ink mt-4 leading-[1.1] md:text-4xl">
                It asks you one good question a day. <br />
                <span className="display-italic text-ink-soft">
                  Then it listens.
                </span>
              </h2>
              <p className="mt-6 text-ink-soft leading-relaxed">
                Not a chatbot. Not a productivity app. A small,
                persistent interviewer that knows your last three months
                and uses them to ask something only it could ask today.
              </p>
            </div>

            <div className="space-y-0">
              {questions.map((item, i) => (
                <article
                  key={item.day}
                  className={`py-8 ${
                    i !== questions.length - 1 ? "border-b border-rule" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-amber">
                      {item.day}
                    </span>
                    <div className="flex gap-2">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="font-mono text-[10px] uppercase tracking-wider text-ink-muted"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="font-serif text-xl text-ink mt-3 leading-snug md:text-2xl">
                    <span className="display-italic text-ink-soft">Q. </span>
                    {item.q}
                  </p>
                  <p className="mt-4 border-l-2 border-amber pl-4 text-sm italic leading-relaxed text-ink-soft md:text-base">
                    {item.excerpt}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Markdown format — what your memories look like on disk */}
      <section className="border-b border-rule bg-paper-deep/40">
        <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-24 md:grid-cols-[1fr_2fr] md:gap-16 md:py-32">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              The file format
            </p>
            <h2 className="font-serif text-3xl text-ink mt-4 leading-[1.1] md:text-4xl">
              Plain Markdown. <br />
              <span className="display-italic text-ink-soft">
                In a folder you own.
              </span>
            </h2>
            <p className="mt-6 text-ink-soft leading-relaxed">
              Every interview becomes a Markdown file with a YAML
              frontmatter — date, duration, tags. You can grep it, diff
              it, version it with git, or hand it to another AI as
              memory. Nothing about you is ever trapped in a database.
            </p>
          </div>

          <div className="border border-rule bg-card">
            <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber/70" />
                <span className="size-2 rounded-full bg-ink-muted/40" />
                <span className="size-2 rounded-full bg-ink-muted/40" />
              </div>
              <span className="font-mono text-[11px] text-ink-muted">
                journals/2026-04-18-morning-walk.md
              </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-ink">
              <code>{markdownSample}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Principles — quiet, not a feature wall */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-3xl px-6 py-24 md:py-32">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            What this is, in three lines
          </p>
          <ol className="mt-12 space-y-12">
            {principles.map((p, i) => (
              <li key={p.label} className="grid grid-cols-[3rem_1fr] gap-6">
                <span className="font-mono text-sm text-amber pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-serif text-2xl text-ink leading-tight">
                    {p.label}
                  </h3>
                  <p className="mt-3 text-ink-soft leading-relaxed">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Footer — quiet GitHub-first CTA */}
      <footer>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-md">
            <p className="font-serif text-2xl text-ink leading-tight md:text-3xl">
              The first ten days are mine. <br />
              <span className="display-italic text-ink-soft">
                After that, it&apos;s yours.
              </span>
            </p>
            <p className="mt-4 font-mono text-xs text-ink-muted">
              v0.0.1 · cold start · personal research project
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <a
              href="https://github.com/JacksonHe04/storytelling"
              className="font-mono text-sm text-ink underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:decoration-amber"
            >
              github.com/JacksonHe04/storytelling
            </a>
            <a
              href="https://github.com/JacksonHe04/storytelling/blob/main/IDEA.md"
              className="font-mono text-sm text-ink-soft underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:decoration-amber hover:text-ink"
            >
              read the full idea →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
