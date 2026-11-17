import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { ContestHero } from "@/components/contest-hero";
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
      <ContestHero ctaLabel="Join an event" onCta={toJoin} leaderboardHref={leaderboardHref} />

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
