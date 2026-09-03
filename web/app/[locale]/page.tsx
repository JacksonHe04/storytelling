import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LanguageSwitch } from "@/components/site/language-switch";
import { getSamples } from "@/lib/samples";

const GITHUB_URL = "https://github.com/JacksonHe04/storytelling";

type Step = {
  num: string;
  skill: string;
  name: string;
  desc: string;
  artifact: string;
  status: string;
};

type Principle = { title: string; body: string };

// Renders the directory tree with trailing `#` comments dimmed, like margin notes
function TreeCard({ tree, caption }: { tree: string; caption: string }) {
  return (
    <div className="border border-rule bg-card">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber/70" />
          <span className="size-2 rounded-full bg-ink-muted/40" />
          <span className="size-2 rounded-full bg-ink-muted/40" />
        </div>
        <span className="font-mono text-[11px] text-ink-muted">{caption}</span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.8] text-ink-soft">
        {tree.split("\n").map((line, i) => {
          const comment = line.match(/^(.*?)(\s{2,}#.*)$/);
          return (
            <span key={i}>
              {comment ? (
                <>
                  {comment[1]}
                  <span className="text-ink-muted">{comment[2].trimStart()}</span>
                </>
              ) : (
                <span className={i === 0 ? "text-ink" : undefined}>{line}</span>
              )}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

// The signature artifact: a real biography section page — YAML frontmatter
// in mono, literary prose set in serif, like a manuscript leaf
function BiographyCard({
  fm,
  prose,
  caption,
}: {
  fm: string;
  prose: string;
  caption: string;
}) {
  return (
    <div className="border border-rule bg-card">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber/70" />
          <span className="size-2 rounded-full bg-ink-muted/40" />
          <span className="size-2 rounded-full bg-ink-muted/40" />
        </div>
        <span className="font-mono text-[11px] text-ink-muted">{caption}</span>
      </div>
      <div className="p-6">
        <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.85] text-ink-muted">
          {`---\n${fm}\n---`}
        </pre>
        <p className="mt-6 border-t border-rule pt-6 font-serif text-[15px] leading-[2.05] text-ink">
          {prose}
        </p>
      </div>
    </div>
  );
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const steps = t.raw("loop.steps") as Step[];
  const principles = t.raw("principles.items") as Principle[];
  const samples = getSamples(locale as Locale);

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
              href={GITHUB_URL}
              className="transition-colors hover:text-ink"
            >
              GitHub
            </a>
            <LanguageSwitch locale={locale as Locale} />
          </nav>
        </div>
      </header>

      {/* Hero — single-column, manuscript prose */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-3xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            {t("hero.eyebrow")}
          </p>

          <h1 className="hero-title display-tight font-serif text-5xl text-ink mt-6 md:text-7xl lg:text-[5.5rem]">
            {t("hero.titleA")} <br className="hidden md:block" />
            {t("hero.titleB")}{" "}
            <span className="display-italic text-amber">{t("hero.titleYou")}</span>
            <span className="text-amber">{t("hero.titlePeriod")}</span>
          </h1>

          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {t("hero.body")}
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-5">
            <a
              href={GITHUB_URL}
              className="group inline-flex items-center gap-2.5 border border-ink bg-ink px-5 py-3 font-mono text-sm text-paper transition-colors hover:bg-amber hover:border-amber hover:text-ink"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="size-4 fill-current"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              {t("hero.ctaGithub")}
              <span className="border-l border-paper/30 pl-2.5 font-mono text-[11px] uppercase tracking-wider opacity-70 group-hover:text-ink">
                {t("hero.ctaStage")}
              </span>
            </a>
            <a
              href={GITHUB_URL}
              className="font-serif text-base italic text-ink-soft underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-amber"
            >
              {t("hero.ctaIdea")}
            </a>
          </div>
        </div>
      </section>

      {/* The loop — four skills in their real pipeline order */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
                {t("loop.eyebrow")}
              </p>
              <h2 className="font-serif text-3xl text-ink mt-4 leading-[1.1] md:text-4xl">
                {t("loop.titleA")} <br />
                <span className="display-italic text-ink-soft">
                  {t("loop.titleB")}
                </span>
              </h2>
              <p className="mt-6 text-ink-soft leading-relaxed">
                {t("loop.body")}
              </p>
            </div>

            <div>
              {steps.map((step, i) => (
                <article
                  key={step.skill}
                  className={`py-8 ${
                    i !== steps.length - 1 ? "border-b border-rule" : ""
                  }`}
                >
                  <div className="grid gap-4 md:grid-cols-[3.5rem_1fr_auto] md:gap-6">
                    <span className="font-mono text-sm text-amber pt-1">
                      {step.num}
                    </span>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                        {step.skill}
                      </p>
                      <h3 className="mt-2 flex flex-wrap items-center gap-3 font-serif text-2xl text-ink">
                        {step.name}
                        {step.status === "next" && (
                          <span className="border border-amber/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber">
                            {t("loop.nextTag")}
                          </span>
                        )}
                      </h3>
                      <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
                        {step.desc}
                      </p>
                    </div>
                    <div className="flex md:justify-end md:pl-4">
                      <span className="h-fit border border-rule bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-muted">
                        {step.artifact}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Signature — the book that files itself: real tree + real section page */}
      <section className="border-b border-rule bg-paper-deep/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-24 md:py-32">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              {t("manuscript.eyebrow")}
            </p>
            <h2 className="font-serif text-3xl text-ink mt-4 leading-[1.1] md:text-4xl">
              {t("manuscript.titleA")}{" "}
              <span className="display-italic text-ink-soft">
                {t("manuscript.titleB")}
              </span>
            </h2>
            <p className="mt-6 text-ink-soft leading-relaxed">
              {t("manuscript.body")}
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <TreeCard tree={samples.tree} caption={t("manuscript.treeCaption")} />
            <BiographyCard
              fm={samples.bioFm}
              prose={samples.bioProse}
              caption={t("manuscript.bioCaption")}
            />
          </div>
        </div>
      </section>

      {/* Principles — quiet hairline list, not numbered (they aren't a sequence) */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-3xl px-6 py-24 md:py-32">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            {t("principles.eyebrow")}
          </p>
          <div className="mt-12">
            {principles.map((p) => (
              <div
                key={p.title}
                className="border-t border-rule py-10 last:border-b"
              >
                <h3 className="font-serif text-2xl text-ink leading-tight">
                  {p.title}
                </h3>
                <p className="mt-3 text-ink-soft leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — quiet GitHub-first CTA */}
      <footer>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-md">
            <p className="font-serif text-2xl text-ink leading-tight md:text-3xl">
              {t("footer.lineA")} <br />
              <span className="display-italic text-ink-soft">
                {t("footer.lineB")}
              </span>
            </p>
            <p className="mt-4 font-mono text-xs text-ink-muted">
              {t("footer.status")}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <a
              href={GITHUB_URL}
              className="font-mono text-sm text-ink underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:decoration-amber"
            >
              github.com/JacksonHe04/storytelling
            </a>
            <a
              href={GITHUB_URL}
              className="font-mono text-sm text-ink-soft underline decoration-rule decoration-1 underline-offset-[6px] transition-colors hover:decoration-amber hover:text-ink"
            >
              {t("footer.ideaLink")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
