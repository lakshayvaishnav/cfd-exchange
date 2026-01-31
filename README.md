# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended)
turbo build

# Without [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation), use your package manager
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended)
turbo build --filter=docs

# Without [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation), use your package manager
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev

# Without [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev --filter=web

# Without [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
# With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)

--------- what is needed to improve ---------------

| Feature         | Status         |
| --------------- | -------------- |
| Price feed      | ✅ External    |
| Execution       | ✅ Instant     |
| Liquidation     | ✅ Implemented |
| Spread          | ✅ Implemented |
| Risk management | ❌ Missing     |
| Hedging         | ❌ Missing     |
| Exposure caps   | ❌ Missing     |

# Tradeoffs

⚠️ 1. Engine must manage risk

Because your engine is the counterparty to every trade.

What this means

If users win money → engine loses money

Example:

100 users go LONG BTC
BTC pumps +10%

Each user profits.

💥 Who pays them?
→ Your engine’s balance.

In real exchanges:

Exchange is neutral

One trader’s loss = another trader’s profit

In your engine:

User profit = engine loss

Why this is dangerous

If price moves strongly one direction:

All users can win together

Engine gets wiped

This is called directional exposure.

⚠️ 2. Engine is the market maker

Market maker = entity that always takes the opposite side.

In your engine:

User Engine
Long Short
Short Long

This is fine only if:

Positions are balanced

Or hedged externally

Your engine does neither yet.

Example failure scenario
BTC price = 50,000
Everyone believes BTC will pump

100 users:

Long 10x leverage

Large size

BTC goes to 55,000.

Users:

Massive profit

Engine:

Massive loss

Possibly bankrupt

⚠️ 3. Engine must cap exposure

Since engine carries risk, it must limit it.

Common exposure caps (used in real systems)
Control Purpose
Max leverage Limit blowups
Max position size Prevent whales
Max total open interest Cap total risk
Asset-wise limits Prevent BTC-only risk
What happens if you don’t cap?

Single whale could:

Go 100x long

On illiquid price feed

Drain entire system

Your engine currently has:
❌ No max leverage check
❌ No max open interest
❌ No per-user cap
❌ No global exposure limit

This is fine for learning, not for production.

⚠️ 4. How real exchanges avoid this (hedging)

Real exchanges do NOT want directional risk.

They do one of these:

A) Order-book futures (Binance Futures)

Traders trade against each other

Exchange earns fees only

No directional exposure

Hard to build.

B) Internalized but hedged (CFD brokers)

Your engine model + extra step:

User opens LONG BTC

Engine opens real SHORT BTC on Binance

Price moves

Engine profits externally → pays user

This is called delta hedging.

C) AMM-based (like Perp DEXs)

Price shifts automatically based on imbalance.

Your engine does not do this either.
