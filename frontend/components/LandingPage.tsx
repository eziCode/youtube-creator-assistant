import React from 'react';
import { RobotIcon, ChartBarIcon, MessageCircleIcon, FilmIcon, SettingsIcon, InboxIcon } from './icons';

interface LandingPageProps {
  onLogin: () => void;
  // REMOVE-LATER: Prop for temporary dev button.
  onGoToDashboard: () => void;
}

const features = [
  {
    title: 'Predictive AI Insights',
    description:
      'Crystal-clear dashboards powered by Gemini help you understand what works, what flops, and what to publish next.',
    accent: 'from-indigo-500/30 to-fuchsia-500/30',
    icon: <ChartBarIcon />,
  },
  {
    title: 'Human-Level Comment Replies',
    description:
      'Effortlessly nurture your community with suggested responses, sentiment filters, and brand-safe tones.',
    accent: 'from-fuchsia-500/30 to-rose-500/30',
    icon: <MessageCircleIcon />,
  },
  {
    title: 'Shorts in Minutes',
    description:
      'AI trims your long-form videos into scroll-stopping Shorts, complete with captions and punchy hooks.',
    accent: 'from-purple-500/30 to-blue-500/30',
    icon: <FilmIcon />,
  },
  {
    title: 'Automated Publishing Flow',
    description:
      'Schedule uploads, auto-generate thumbnails, and keep your content pipeline moving while you sleep.',
    accent: 'from-blue-500/30 to-emerald-500/30',
    icon: <SettingsIcon />,
  },
];

const workflowSteps = [
  {
    title: 'Connect your channel',
    description: 'Secure OAuth keeps your data safe while unlocking analytics and comment automation.',
  },
  {
    title: 'Pick your growth play',
    description: 'Choose between analytics, community, and Shorts workflows—or automate all three.',
  },
  {
    title: 'Launch in autopilot',
    description: 'Notifications keep you in the loop while AI handles the day-to-day heavy lifting.',
  },
];

const testimonials = [
  {
    quote:
      'We doubled our weekly uploads without burning out. The automated comments alone save me hours every night.',
    name: 'Maya Chen',
    role: 'Creator, 450K Subs',
  },
  {
    quote:
      'The Shorts repurposing is wild. It found moments I missed completely and turned them into 1M+ view clips.',
    name: 'Samir Patel',
    role: 'Podcast Producer',
  },
  {
    quote:
      'This is the first time analytics actually told me what to do next. It feels like a strategist on my team.',
    name: 'Jules Rivera',
    role: 'Tech Reviewer',
  },
];

const LandingPage: React.FC<LandingPageProps> = ({
  onLogin,
  // REMOVE-LATER: Prop for temporary dev button.
  onGoToDashboard,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <header className="fixed top-0 left-0 w-full z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-indigo-300 shadow-lg shadow-indigo-500/20 backdrop-blur animate-glow">
              <RobotIcon />
            </span>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-white/50">Creator OS</p>
              <p className="text-lg font-semibold text-white">YouTube AI Assistant</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm font-semibold text-white/70">
            <button
              onClick={onLogin}
              className="relative overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(79,70,229,0.45)] transition-transform duration-200 hover:scale-105"
            >
              <span className="relative z-10">Login</span>
              <span className="absolute inset-0 scale-150 bg-white/30 opacity-0 blur transition-opacity duration-300 hover:opacity-30" />
            </button>
          </nav>
        </div>
      </header>

      <main className="relative pt-36 pb-20 md:pt-44 md:pb-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.2),_transparent_55%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.8)_40%,rgba(30,58,138,0.35)_100%)] backdrop-blur" />
        <div className="absolute inset-x-0 top-32 -z-10 mx-auto h-[600px] w-[600px] rounded-full bg-indigo-500/30 blur-3xl md:h-[720px] md:w-[720px]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-16 px-5 md:flex-row md:items-center md:gap-20 md:px-8">
          <div className="max-w-2xl space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 backdrop-blur-sm">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-300 opacity-70" />
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" />
              </span>
              New Release
            </span>
            <h1 className="text-4xl font-semibold leading-tight text-white drop-shadow md:text-6xl">
              Turn your channel into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400 animate-gradient-fade">24/7 AI growth engine</span>.
            </h1>
            <p className="text-lg text-white/70 md:text-xl">
              Imagine having an executive producer, data scientist, and community manager in one. We automate the grind so you can stay obsessed with creating.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                onClick={onLogin}
                className="group relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-8 py-3 text-base font-semibold text-white shadow-[0_20px_45px_rgba(99,102,241,0.45)] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
              >
                <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 blur group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
                  Sign in with Google
                </span>
              </button>
              {/* START: Temporary dev button. Delete this button later. */}
              <button
                onClick={onGoToDashboard}
                className="rounded-2xl border border-white/10 bg-white/5 px-8 py-3 text-base font-semibold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:text-white"
              >
                Explore the Dashboard
              </button>
              {/* END: Temporary dev button. */}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { value: '3x', label: 'Faster content planning' },
                { value: '92%', label: 'Replies automated overnight' },
                { value: '8 hrs', label: 'Average time saved / week' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg shadow-indigo-500/10 backdrop-blur animate-fadeIn"
                >
                  <p className="text-3xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.2em] text-white/50">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center">
            <div className="pointer-events-none absolute -left-12 top-12 h-44 w-44 rounded-full bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-sky-500/40 blur-3xl" />
            <div className="pointer-events-none absolute -right-6 bottom-10 h-56 w-56 rounded-full bg-gradient-to-r from-rose-500/40 via-fuchsia-500/30 to-orange-400/30 blur-3xl" />
            <div className="relative w-full max-w-md rounded-[2.5rem] border border-white/10 bg-white/10 p-6 shadow-[0_25px_80px_rgba(59,130,246,0.35)] backdrop-blur-xl animate-float">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">This week</p>
                  <p className="text-2xl font-semibold text-white">+128% growth</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
                  Trending
                </span>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>Retention spikes</span>
                    <span className="text-emerald-300">+24%</span>
                  </div>
                  <div className="mt-3 h-20 rounded-xl bg-gradient-to-r from-indigo-500/30 to-indigo-300/10" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 shadow-inner shadow-emerald-400/20">
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-100/80">Comments</p>
                    <p className="mt-2 text-2xl font-semibold text-white">183</p>
                    <p className="mt-1 text-xs text-emerald-200/70">78 handled by AI</p>
                  </div>
                  <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 shadow-inner shadow-sky-500/20">
                    <p className="text-xs uppercase tracking-[0.25em] text-sky-100/80">Shorts</p>
                    <p className="mt-2 text-2xl font-semibold text-white">12 drafts</p>
                    <p className="mt-1 text-xs text-sky-100/60">3 ready to publish</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">Inbox Zero</p>
                  <p className="text-xs text-white/60">AI has cleared the queue</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200 shadow-inner shadow-emerald-500/20">
                  <InboxIcon />
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section id="features" className="relative border-t border-white/5 bg-slate-950/80 py-24 backdrop-blur">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.15),_transparent_55%)]" />
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">Everything dialed-in for creators</h2>
            <p className="mt-4 text-white/60">
              Automations built specifically for video teams. No generic dashboards, no duct-taped spreadsheets.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className={`absolute -right-16 -top-16 h-36 w-36 rounded-full bg-gradient-to-br ${feature.accent} opacity-60 blur-3xl`} />
                <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                  {feature.icon}
                </div>
                <h3 className="relative mt-6 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="relative mt-3 text-sm text-white/70">{feature.description}</p>
                <div className="relative mt-6 h-[2px] w-full rounded-full bg-gradient-to-r from-white/10 to-white/0 opacity-0 transition duration-300 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative border-t border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-indigo-500/15 to-transparent blur-3xl" />
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-5 md:px-8 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              Launch a creator-grade command center in one afternoon.
            </h2>
            <p className="mt-4 text-white/60">
              We integrate directly with YouTube, so you get instant insights, auto replies, and Shorts suggestions with nothing to maintain.
            </p>
          </div>
          <ol className="relative flex-1 space-y-10 border-l border-dashed border-white/10 pl-8">
            <span className="absolute left-1 top-0 h-full w-[3px] rounded-full bg-gradient-to-b from-indigo-500/60 via-purple-500/40 to-transparent" />
            {workflowSteps.map((step, index) => (
              <li key={step.title} className="relative pl-6">
                <span className="absolute -left-[31px] top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/20 text-xs font-semibold text-indigo-200/80 shadow-[0_0_15px_rgba(99,102,241,0.35)]">
                  {index + 1}
                </span>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-white/65">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="testimonials" className="relative border-t border-white/5 bg-slate-950 py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.3),_transparent_70%)]" />
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-rose-200/70">Creator love</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">The secret weapon for growing channels</h2>
            <p className="mt-4 text-white/60">
              Trusted by storytellers, educators, and studios who want AI copilots—not AI replacements.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <figure
                key={testimonial.name}
                className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 text-left backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
                style={{ animationDelay: `${index * 140}ms` }}
              >
                <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-rose-500/20 to-purple-500/20 blur-3xl" />
                <blockquote className="relative text-sm text-white/70">
                  “{testimonial.quote}”
                </blockquote>
                <figcaption className="relative mt-6">
                  <p className="text-base font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">{testimonial.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="relative border-t border-white/5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 py-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.35),_transparent_45%)] blur-3xl" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 text-center md:px-8">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Your next 1M views are a workflow away.
          </h2>
          <p className="max-w-2xl text-base text-white/80">
            Join creators who made the leap from guessing to growing. Launch the AI assistant built exclusively for YouTube.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              onClick={onLogin}
              className="rounded-2xl bg-white px-7 py-3 text-base font-semibold text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.35)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.45)]"
            >
              Get started free
            </button>
            <button
              onClick={onGoToDashboard}
              className="rounded-2xl border border-white/40 px-7 py-3 text-base font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200 hover:bg-white/15"
            >
              See it in action
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/90 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 text-center text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p>&copy; {new Date().getFullYear()} YouTube AI Assistant. Built for creators who never slow down.</p>
          <div className="flex justify-center gap-6">
            <a href="#features" className="transition hover:text-white/80">
              Features
            </a>
            <a href="#workflow" className="transition hover:text-white/80">
              Workflow
            </a>
            <a href="#cta" className="transition hover:text-white/80">
              Get Started
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;