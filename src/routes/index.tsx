import { createFileRoute, Link } from "@tanstack/react-router";
import { AmbientBackground } from "@/components/AmbientBackground";

import islandImg from "@/assets/lavender-island.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lavender Adventure — A dreamy treasure hunt" },
      { name: "description", content: "Embark on a soft, sparkling treasure hunt across a lavender-hued island. Ten mini games await." },
      { property: "og:title", content: "Lavender Adventure" },
      { property: "og:description", content: "A dreamy interactive treasure hunt across a lavender island." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <AmbientBackground />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <section className="relative z-10 max-w-3xl text-center animate-[fade-up_0.8s_ease-out]">
        <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-violet-deep">
          <span className="size-1.5 rounded-full bg-blossom animate-pulse-glow" />
          A dreamy treasure hunt
        </span>

        <h1 className="mt-6 text-5xl sm:text-7xl font-bold leading-[1.05] text-gradient">
          Welcome to the<br />Lavender Adventure
        </h1>

        <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
          Set sail across a sparkling lilac sea. Visit ten enchanted spots,
          play soft little games, and uncover the moonlit treasure at the peak.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            to="/map"
            className="group relative inline-flex items-center gap-2 rounded-full bg-button-grad px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105 active:scale-95"
          >
            Begin the journey
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        <Link
          to="/map"
          className="block mt-14 mx-auto group"
          aria-label="Open the island map"
        >
          <div className="relative mx-auto w-[min(560px,90vw)] aspect-[16/10] rounded-3xl overflow-hidden glass shadow-glow transition-transform duration-500 group-hover:scale-[1.03]">
            <img
              src={islandImg}
              alt="Preview of the lavender island map"
              className="absolute inset-0 size-full object-cover"
              width={1536}
              height={1024}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-violet-deep/40 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full glass px-5 py-2 text-sm font-semibold text-violet-deep">
              Tap to explore the island
            </div>
            <div className="absolute inset-0 ring-1 ring-inset ring-white/40" />
          </div>
        </Link>

        <p className="mt-8 text-xs text-muted-foreground/80">
          Crafted with 💜 — your progress is saved on this device.
        </p>
      </section>
    </main>
  );
}
