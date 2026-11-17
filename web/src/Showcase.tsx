import { ExternalLink, Mail } from "lucide-react";

import { ContestHero } from "@/components/contest-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// The public demo site (GitHub Pages). It shows the product; it does not run contests.
const REPO = "https://github.com/sreedeepghosh2005/contest-here";
const REQUEST = `${REPO}/issues/new?template=permission-request.yml`;
const shot = (name: string) => `${import.meta.env.BASE_URL}shots/${name}.png`;

const tour = [
  {
    id: "join",
    title: "Join with a code",
    text: "Contestants enter the event code, a name and a PIN. The same name and PIN log them back in on any device.",
    img: "questions",
    alt: "Question list with solved and in-progress status and a running timer",
  },
  {
    id: "solve",
    title: "The clock starts on Start",
    text: "The question stays hidden until Start. Write in C, C++, Java or Python. Submit runs every test case. Hidden tests show only pass or fail.",
    img: "solve",
    alt: "Solve page: statement and samples on the left, C++ editor and an Accepted verdict on the right",
  },
  {
    id: "run",
    title: "Try it before you submit",
    text: "Run checks the code on custom input. It is not graded, and it does not count as a wrong attempt.",
    img: "run",
    alt: "Python code run on custom input with its output shown",
  },
  {
    id: "leaderboard",
    title: "One live board",
    text: "Most questions solved ranks first. Ties go to the least total time from Start to the accepted submit. It refreshes every 5 seconds. Put it on the projector.",
    img: "leaderboard",
    alt: "Leaderboard with ranks, solved counts, total time and per-question times",
  },
  {
    id: "admin",
    title: "Run the event from one panel",
    text: "Create an event, open or close it, see every submission and its code, and reset between rounds.",
    img: "admin",
    alt: "Admin panel with the event, its join code and its questions",
  },
  {
    id: "questions",
    title: "Your questions, your tests",
    text: "Write the statement, set the time limit and add test cases. Mark some as samples. Check the expected outputs with your own reference solution.",
    img: "admin-question",
    alt: "Question editor with title, time limit, statement and test cases",
  },
];

export default function Showcase() {
  const toTour = () => document.getElementById("tour")?.scrollIntoView({ behavior: "smooth" });
  const toAccess = () => document.getElementById("access")?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <ContestHero
        ctaLabel="See how it works"
        onCta={toTour}
        headerLabel="Use it for your event"
        onHeader={toAccess}
        leaderboardHref="#leaderboard"
        tagline="Timed coding contests for your event. Press Start. Solve it. The fastest correct answer tops the board."
      />

      <main id="tour" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20">
        <p className="mx-auto mb-16 max-w-xl rounded-full border border-foreground/20 bg-white/50 px-5 py-2 text-center text-sm text-muted-foreground">
          This is a demo site with screenshots. Real contests run on the organiser's own machine or server.
        </p>

        <div className="grid gap-24">
          {tour.map((step, i) => (
            <section
              key={step.id}
              id={step.id}
              aria-labelledby={`${step.id}-title`}
              className={`grid scroll-mt-8 items-center gap-8 ${i % 2 ? "lg:grid-cols-[1.7fr_1fr]" : "lg:grid-cols-[1fr_1.7fr]"}`}
            >
              <div className={i % 2 ? "lg:order-2" : undefined}>
                <span className="font-mono text-sm text-accent">0{i + 1}</span>
                <h2 id={`${step.id}-title`} className="mt-2 font-display text-3xl font-semibold tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">{step.text}</p>
              </div>
              <img
                src={shot(step.img)}
                alt={step.alt}
                width={1360}
                height={820}
                loading="lazy"
                className="h-auto w-full rounded-xl border border-foreground/15 shadow-[0_20px_60px_-25px_rgba(38,51,44,0.35)]"
              />
            </section>
          ))}
        </div>

        <section id="access" aria-labelledby="access-title" className="mx-auto mt-32 max-w-xl scroll-mt-8">
          <Card className="backdrop-blur">
            <CardHeader>
              <CardTitle id="access-title" className="font-display text-2xl">
                Use it for your contest
              </CardTitle>
              <CardDescription className="text-base">
                Contest Here is not open source. You can read the code, but you need written permission before you
                use it to run a contest. Tell me about your event and I will reply on GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <a
                href={REQUEST}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 font-medium text-accent-foreground hover:bg-accent/90"
              >
                <Mail className="size-4" aria-hidden="true" /> Request permission
              </a>
              <a
                href={REPO}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-foreground/35 px-7 hover:border-foreground"
              >
                View the code <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © 2026 sreedeepghosh2005 · All rights reserved ·{" "}
        <button type="button" onClick={toAccess} className="underline-offset-4 hover:text-foreground hover:underline">
          Licence
        </button>
      </footer>
    </>
  );
}
