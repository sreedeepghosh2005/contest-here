import type { ReactNode } from "react";
import { ArrowDown, Trophy } from "lucide-react";

import { ParticleHero } from "@/components/ui/particle-hero";
import { Button } from "@/components/ui/button";

const outlinePill =
  "items-center gap-1.5 rounded-full border border-foreground/35 hover:border-foreground";

export interface ContestHeroProps {
  /** Main call to action, for example "Join an event". */
  ctaLabel: string;
  onCta: () => void;
  /** Header button label. Default: the same action as the CTA. */
  headerLabel?: string;
  /** Header button action. Default: onCta. */
  onHeader?: () => void;
  leaderboardHref: string;
  /** Line under the headline. */
  tagline?: ReactNode;
}

/** The Contest Here hero: particle sculpture, brand, headline and actions. Used by the app and the demo site. */
export function ContestHero({
  ctaLabel,
  onCta,
  headerLabel = "Join event",
  onHeader,
  leaderboardHref,
  tagline = "Press Start. Solve it. The fastest correct answer tops the board.",
}: ContestHeroProps) {
  return (
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
          <a href={leaderboardHref} className={`hidden px-4 py-1.5 text-sm sm:inline-flex ${outlinePill}`}>
            <Trophy className="size-3.5" aria-hidden="true" /> Leaderboard
          </a>
          <Button size="sm" onClick={onHeader ?? onCta}>
            {headerLabel}
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
          <p className="mt-5 max-w-md text-lg text-muted-foreground">{tagline}</p>
          <div className="pointer-events-auto mt-6 flex flex-wrap gap-3">
            <Button variant="accent" size="lg" onClick={onCta}>
              {ctaLabel} <ArrowDown />
            </Button>
            <a href={leaderboardHref} className={`inline-flex h-12 px-7 sm:hidden ${outlinePill}`}>
              Leaderboard
            </a>
          </div>
        </div>
      </div>
    </ParticleHero>
  );
}
