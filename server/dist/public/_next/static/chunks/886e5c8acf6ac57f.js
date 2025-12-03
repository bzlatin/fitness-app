(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  20292,
  (e) => {
    "use strict";
    var t = e.i(70776);
    function a() {
      return (0, t.jsxs)("div", {
        className: "min-h-screen w-full overflow-x-hidden",
        children: [
          (0, t.jsxs)("div", {
            className: "fixed inset-0 overflow-hidden pointer-events-none",
            children: [
              (0, t.jsx)("div", {
                className:
                  "absolute w-96 h-96 -top-48 -left-48 bg-primary rounded-full blur-[120px] opacity-40 animate-float",
              }),
              (0, t.jsx)("div", {
                className:
                  "absolute w-[500px] h-[500px] -bottom-60 -right-60 bg-secondary rounded-full blur-[120px] opacity-40 animate-float-delayed",
              }),
              (0, t.jsx)("div", {
                className:
                  "absolute w-72 h-72 top-1/2 left-1/2 bg-primary rounded-full blur-[120px] opacity-40 animate-float-slow",
              }),
            ],
          }),
          (0, t.jsxs)("main", {
            className:
              "relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16",
            children: [
              (0, t.jsx)("div", {
                className: "text-center mb-8 animate-fade-in-up",
                children: (0, t.jsx)("h1", {
                  className:
                    "text-5xl sm:text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent uppercase tracking-tight",
                  children: "Push/Pull",
                }),
              }),
              (0, t.jsx)("div", {
                className:
                  "flex justify-center mb-8 animate-fade-in-up animation-delay-200",
                children: (0, t.jsxs)("div", {
                  className:
                    "inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full",
                  children: [
                    (0, t.jsx)("span", {
                      className:
                        "w-2 h-2 bg-primary rounded-full animate-pulse",
                    }),
                    (0, t.jsx)("span", {
                      className: "text-primary font-semibold",
                      children: "In Development",
                    }),
                  ],
                }),
              }),
              (0, t.jsxs)("div", {
                className:
                  "text-center mb-12 animate-fade-in-up animation-delay-400",
                children: [
                  (0, t.jsx)("h2", {
                    className:
                      "text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight",
                    children: "Your Fitness Journey, Reimagined",
                  }),
                  (0, t.jsx)("p", {
                    className:
                      "text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed",
                    children:
                      "The social-first fitness app combining intelligent workout programming with community motivation. Coming soon to iOS and Android.",
                  }),
                ],
              }),
              (0, t.jsxs)("div", {
                className:
                  "grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in-up animation-delay-600",
                children: [
                  (0, t.jsx)(i, {
                    emoji: "💪",
                    title: "Smart Workouts",
                    description:
                      "AI-powered workout generation with 800+ exercises and progressive overload tracking",
                  }),
                  (0, t.jsx)(i, {
                    emoji: "👥",
                    title: "Squad System",
                    description:
                      "Connect with friends, share progress, and stay motivated together",
                  }),
                  (0, t.jsx)(i, {
                    emoji: "📊",
                    title: "Recovery Intelligence",
                    description:
                      "Track fatigue and muscle group recovery to optimize your training",
                  }),
                ],
              }),
              (0, t.jsxs)("div", {
                className:
                  "flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-up animation-delay-800",
                children: [
                  (0, t.jsx)(s, { emoji: "🍎", text: "iOS App Coming Soon" }),
                  (0, t.jsx)(s, {
                    emoji: "🤖",
                    text: "Android App Coming Soon",
                  }),
                ],
              }),
              (0, t.jsxs)("div", {
                className: "space-y-8 animate-fade-in-up animation-delay-1000",
                children: [
                  (0, t.jsx)(r, {
                    title: "Terms of Service",
                    description:
                      "Last updated: November 2025 — By using Push/Pull you agree to the subscription and usage rules below. Keep your login secure, cancel subscriptions through the platform that billed you (Apple or Stripe), and be honest in shared workouts so the squad experience stays welcoming.",
                    items: [
                      "Subscriptions auto-renew until canceled; Apple subscriptions are managed through your device settings.",
                      "The free tier is capped at three templates, limited analytics, and AI paywalled under the Pro plan.",
                      "We may suspend accounts for abuse, but will try to warn before suspension.",
                      "Training advice is educational—train at your own risk and consult a medical professional before starting a program.",
                    ],
                  }),
                  (0, t.jsx)(r, {
                    title: "Privacy Policy",
                    description:
                      "Last updated: November 2025 — We collect workout logs, profile information, device metadata, and billing data to deliver your AI workouts, squad activity, and analytics. Service partners (Auth0, Stripe, Apple) process data under strict contracts.",
                    items: [
                      "Data supports personalized AI programming, recovery insights, and customer support.",
                      "We keep account data until you delete it; request deletion or exports via help@push-pull.app.",
                      "Security controls and encryption protect data at rest and in transit.",
                      "We do not sell user data and only use cookies or tracking for essential analytics.",
                    ],
                  }),
                ],
              }),
              (0, t.jsxs)("footer", {
                className:
                  "text-center mt-12 pt-8 border-t border-white/10 text-zinc-500 animate-fade-in-up animation-delay-1200",
                children: [
                  (0, t.jsx)("p", {
                    children: "© 2025 Push/Pull. All rights reserved.",
                  }),
                  (0, t.jsx)("p", {
                    className: "mt-2 opacity-70",
                    children: "Building something amazing...",
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    }
    function i({ emoji: e, title: a, description: i }) {
      return (0, t.jsxs)("div", {
        className:
          "p-6 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-sm hover:border-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1",
        children: [
          (0, t.jsx)("div", { className: "text-4xl mb-4", children: e }),
          (0, t.jsx)("h3", {
            className: "text-xl font-semibold text-primary mb-2",
            children: a,
          }),
          (0, t.jsx)("p", {
            className: "text-zinc-400 text-sm leading-relaxed",
            children: i,
          }),
        ],
      });
    }
    function s({ emoji: e, text: a }) {
      return (0, t.jsxs)("div", {
        className:
          "flex items-center gap-3 px-6 py-3 bg-white/[0.05] border border-white/10 rounded-xl hover:border-secondary hover:text-secondary transition-all duration-300 hover:scale-105 cursor-default w-full sm:w-auto justify-center",
        children: [
          (0, t.jsx)("span", { className: "text-2xl", children: e }),
          (0, t.jsx)("span", { className: "font-medium", children: a }),
        ],
      });
    }
    function r({ title: e, description: a, items: i }) {
      return (0, t.jsxs)("div", {
        className:
          "p-6 sm:p-8 bg-[#0f172a]/80 border border-white/[0.08] rounded-2xl",
        children: [
          (0, t.jsx)("h2", {
            className: "text-xl sm:text-2xl font-semibold text-primary mb-3",
            children: e,
          }),
          (0, t.jsx)("p", {
            className: "text-zinc-300 leading-relaxed mb-4",
            children: a,
          }),
          (0, t.jsx)("ul", {
            className: "space-y-2 text-zinc-300 text-sm sm:text-base",
            children: i.map((e, a) =>
              (0, t.jsx)(
                "li",
                {
                  className:
                    "pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary",
                  children: e,
                },
                a
              )
            ),
          }),
        ],
      });
    }
    e.s(["default", () => a]);
  },
]);
