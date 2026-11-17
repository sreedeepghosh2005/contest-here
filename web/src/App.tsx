import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowRight, Trophy } from "lucide-react";

import { ParticleHero } from "@/components/ui/particle-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Same key that public/contest.html and public/solve.html read.
const TOKEN_KEY = "arena_token";

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

const fieldLabel = "mb-1.5 block text-sm text-muted-foreground";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get("code") ?? "");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasToken] = useState(() => readToken() !== null);
  const joinRef = useRef<HTMLElement>(null);
  const toJoin = () => joinRef.current?.scrollIntoView({ behavior: "smooth" });

  // A join link (/?code=XYZ) skips past the hero, straight to the form.
  useEffect(() => {
    if (params.get("code")) toJoin();
    // Runs once, on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch {
        throw new Error("Your browser blocked storage. Turn off private mode and try again.");
      }
      window.location.href = "/contest.html";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
      setBusy(false);
    }
  }

  const leaderboardHref = code.trim() ? `/leaderboard.html?code=${encodeURIComponent(code.trim())}` : "/leaderboard.html";

  return (
    <>
      <ParticleHero ariaLabel="Contest Here">
        <div className="mx-auto flex size-full max-w-7xl flex-col px-5 py-6 sm:px-10 sm:py-8">
          <header className="pointer-events-auto flex items-center gap-3">
            <span className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-[0.14em] uppercase">
              <span
                aria-hidden="true"
                className="h-3.5 w-[9px] bg-[radial-gradient(circle,var(--foreground)_1.5px,transparent_1.8px)] bg-[length:4.5px_4.7px]"
              />
              Contest Here
            </span>
            <span className="flex-1" />
            <a
              href={leaderboardHref}
              className="hidden rounded-full border border-foreground/35 px-4 py-1.5 text-sm hover:border-foreground sm:inline-flex sm:items-center sm:gap-1.5"
            >
              <Trophy className="size-3.5" aria-hidden="true" /> Leaderboard
            </a>
            <Button size="sm" onClick={toJoin}>
              Join event
            </Button>
          </header>

          <div className="mt-8 hidden justify-between text-xs tracking-[0.12em] text-muted-foreground uppercase sm:flex">
            <span>
              Move to shape.
              <br />
              Press to pulse.
            </span>
            <span className="text-right">
              C · C++ · Java · Python
              <br />
              One clock. One board.
            </span>
          </div>

          <div className="mt-auto max-w-2xl">
            <h1 className="font-display text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.92] font-semibold tracking-tight">
              Contest
              <br />
              Here<span className="text-accent">.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Press Start. Solve it. The fastest correct answer tops the board.
            </p>
            <div className="pointer-events-auto mt-6 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" onClick={toJoin}>
                Join an event <ArrowDown />
              </Button>
              <a
                href={leaderboardHref}
                className="inline-flex h-12 items-center rounded-full border border-foreground/35 px-7 hover:border-foreground sm:hidden"
              >
                Leaderboard
              </a>
            </div>
          </div>
        </div>
      </ParticleHero>

      <main className="mx-auto max-w-md px-4 py-20">
        <section id="join" ref={joinRef} aria-labelledby="join-title" className="scroll-mt-8">
          <Card className="backdrop-blur">
            <CardHeader>
              <CardTitle id="join-title" className="font-display text-2xl">
                Join an event
              </CardTitle>
              <CardDescription>
                Get the event code from the organiser. Pick a PIN. Use the same name and PIN to log in again on
                another device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasToken && (
                <a
                  href="/contest.html"
                  className="mb-6 flex h-10 items-center justify-center gap-2 rounded-full border border-foreground/35 text-sm font-medium hover:border-foreground"
                >
                  Continue to my questions <ArrowRight className="size-4" />
                </a>
              )}
              <form onSubmit={onJoin} className="grid gap-4">
                <div>
                  <label htmlFor="code" className={fieldLabel}>
                    Event code
                  </label>
                  <Input
                    id="code"
                    required
                    autoComplete="off"
                    className="font-mono uppercase"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="name" className={fieldLabel}>
                    Your name or team name
                  </label>
                  <Input id="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="pin" className={fieldLabel}>
                    PIN (4-8 digits)
                  </label>
                  <Input
                    id="pin"
                    required
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4,8}"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy} className="mt-1 w-full">
                  {busy ? "Joining..." : "Join"}
                </Button>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Contest Here ·{" "}
        <a href="/admin.html" className="hover:text-foreground">
          Organiser login
        </a>
      </footer>
    </>
  );
}
