# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/baburousaburo-a11y/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/baburousaburo-a11y/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: every pre-token protocol in the sealed DefiLlama snapshot, ranked by an implied
launch value and handed a concrete farm plan. Built for make.fun's "Build the best token
launch radar" bounty.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot, scores every
pre-token protocol, and writes the ranked board, the dashboard data, the static dashboard
and the dossier:

- **The model (`radar-2`)** prices each protocol against its own kind: the peer multiple is
  the median market-cap-to-TVL ratio of the live-token protocols in the same category
  (at least 3 peers, otherwise the global median), clamped to 0.02x–1.5x. Implied value is
  `TVL × peer × growth × maturity`, where growth follows the 7-day TVL change (clamped
  −60%…+120%) and maturity follows how long the protocol has run with no token on record.
  No protocol name is special-cased.
- **The board** covers all 40 watchlist protocols plus every other rankable pre-token
  protocol in the snapshot (198 rows), each with its peer multiple, a plain-words
  rationale and a 6-step farm plan with costs and times.
- **The dashboard** (`dashboard/`, static, no network) is a sortable, filterable table
  (search, category, chain, watchlist-only, pre-token / live-token tabs), a detail drawer
  per protocol that recomputes the row's implied value from its own figures, and a model
  panel that prints the peer-multiple table the ranking is priced from.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and
`out/dossier.json`. Open `out/dashboard/index.html` in a browser (it reads `out/data.js`
beside it) to use the radar.

## Layout

- `main.ts` — entrypoint: reads the snapshot, writes the outputs, builds the dossier.
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — the make.fun dossier library, vendored from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol detail view and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=baburou-saburo&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
