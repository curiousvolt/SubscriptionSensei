# SubscriptionSensei

Subscription Sensei helps users avoid overspending on streaming subscriptions by generating an optimal, month-by-month subscription plan based on what they want to watch, their priorities, and a fixed monthly budget.

Instead of subscribing to everything at once, users get a calendar-accurate plan that intelligently rotates subscriptions while respecting real watch-time constraints.

> Hackathon prototype focused on algorithmic correctness and constraint handling.

---
# Workflow

- Accepts a watchlist of movies and TV series
- Supports priority levels (High / Medium / Low)
- Assumes realistic watch time (≈ 2 hours/day)
- Enforces **integer subscription months** only
- Treats **monthly budget as a hard constraint**
- Prevents overlapping watch timelines
- Automatically rotates subscriptions to reduce waste
- Generates a clear multi-month viewing plan

---

# Algorithm Principles

- **Priority affects order, not duration**  (real watch time is never inflated)
- **Budget is non-negotiable**  (monthly spend never exceeds the user limit)
- **Fair scheduling**   (items with the same priority progress together)
- **Human-realistic timelines**  (one person, one schedule, no overlaps)
- **No unnecessary splitting**  (a series is completed within a month if it fits)

The goal is correctness and trustworthiness, not feature bloat.

---

# Demo

![Demo GIF](public/Animation.gif)

URL:   https://subscriptionsensei.lovable.app/

---
# Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TMDB API (content metadata)

---

# Development

### Prerequisites
- Node.js
- npm

### Run locally

```
git clone https://github.com/curiousvolt/SubscriptionSensei.git

cd SubscriptionSensei

npm install

npm run dev
```

## Built with Lovable

This project was vibe-coded using **Lovable** for rapid prototyping and iteration, with a strong focus on manual reasoning around algorithms, constraints, and edge cases.
