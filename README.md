# Tolerance Stack-Up Analysis

A web-based statistical tolerance analysis tool for mechanical engineers. Perform worst-case and RSS (Root Sum Square) stack-up calculations with real-time DPPM and yield estimates.

## Features

- **Interactive tolerance table** — add features/parts with name, manufacturing process, and ± tolerances
- **Manufacturing process presets** — CNC Milling, CNC Lathe, Injection Molding, Elastomer Overmold, Metal Extrusion, Metal Casting, Casting + Post CNC
- **Worst-case & RSS analysis** — real-time calculation of both stack-up methods
- **DPPM & yield** — statistical quality metrics when a target tolerance is specified
- **Direction control** — mark features as additive (+) or subtractive (−) in the stack-up loop
- **Asymmetric tolerance support** — independent + and − tolerance fields per feature

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

Or connect the GitHub repo to [vercel.com](https://vercel.com) for automatic deployments.

## Tech Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
