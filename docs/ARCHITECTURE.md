# Architecture

How Mooji is put together, where it runs, and why each awkward-looking decision
is the way it is.

- [The one idea](#the-one-idea)
- [Infrastructure](#infrastructure)
- [Constraints](#constraints)
- [The life of one command](#the-life-of-one-command)
- [Layering](#layering)
- [Data model](#data-model)
- [Decisions and their reasons](#decisions-and-their-reasons)
- [Security](#security)
- [The scheduled job](#the-scheduled-job)
- [The compendium](#the-compendium)
- [Adding content](#adding-content)
- [Testing](#testing)
- [Deploying](#deploying)
- [If it outgrows this](#if-it-outgrows-this)

---

## The one idea

**Nothing of this project is running right now.**

A conventional Discord bot is a process that starts and never stops, holding a
WebSocket to Discord's gateway and listening. That needs a machine that never
sleeps, and machines that never sleep cost money — which is what the previous
version was paying Railway for, and why it was switched off.

Mooji uses Discord's **HTTP Interactions** transport instead. Discord holds the
connection. When somebody runs a command, Discord makes an ordinary signed HTTPS
request to a URL. Cloudflare starts the code, it runs for a few milliseconds,
answers, and ceases to exist. Between commands there is no process, no memory,
and no cost.

Everything below follows from that. The bot is a function, not a server.

The visible price is that Discord will never show the bot with a green Online
dot — presence requires the gateway connection we deliberately do not hold. It
answers commands instantly regardless.

---

## Infrastructure

One Cloudflare account. Three products, all on the free plan.

| Piece | What it is | What it holds |
|---|---|---|
| **Workers** | Runs the code on request | the Worker `mooji` |
| **D1** | Managed SQLite | players, Echoes, runs, codex, ladder |
| **Static assets** | CDN-served files | the compendium page |

There is no VPS, container, queue, cache or load balancer, because at this size
none of them would earn their keep. The whole deployment is one `wrangler
deploy`.

---

## Constraints

These are not trivia; they shaped the code, and anything you add has to live
inside them.

**Three seconds to answer Discord.** Miss it and the interaction token is
invalidated — the user sees a failure. Everything answers synchronously; nothing
currently needs the deferred path.

**10 ms of CPU per request** on the free plan. Time spent waiting on I/O does
not count, so database round trips and Discord calls are effectively free. Time
spent *computing* does. This is why combat is small integer arithmetic over a
handful of objects and why nothing renders images.

**50 subrequests per request.** Generous, but the reason the daily digest posts
per guild in a loop with a failure path rather than fanning out unbounded.

**100,000 requests a day.** One command or button press is one request.

**No state between requests.** The most invasive of them. Your code cannot
remember anything, so everything that must survive lives in D1.

---

## The life of one command

```
  player types /descend
          │
          ▼
  ┌───────────────────┐
  │  Discord          │  owns the chat, the users, the UI
  └─────────┬─────────┘
            │  HTTPS POST, Ed25519-signed
            │  → https://<worker>.workers.dev/interactions
            ▼
  ┌───────────────────┐
  │  Worker           │  1. verify signature, else 401
  │  src/index.ts     │  2. PING → PONG
  │                   │  3. route to a command or component handler
  └─────────┬─────────┘
            │
            ├──► src/commands/  or  src/components/   the handler
            │            │
            │            ├──► src/game/       pure rules, no I/O
            │            ├──► src/db/         SQL
            │            └──► src/render/     embeds and buttons
            ▼
  ┌───────────────────┐
  │  D1               │  read state → apply one action → write it back
  └─────────┬─────────┘
            │
            ▼
      JSON response, within 3 seconds
            │
            ▼
      Discord draws it
```

Note the direction: your code never contacts a player. It only ever answers
Discord, and Discord renders the result. There is no front end in this
repository because Discord *is* the front end.

---

## Layering

Unidirectional, and the same shape as the Flutter projects — only the words
differ.

```
component / command handler   →   game (rules)   →   db (persistence)
              │
              └──────────────►   render (what the player sees)
```

| Directory | Responsibility | Flutter equivalent |
|---|---|---|
| `src/index.ts` | Entry, signature check, routing | `main.dart` |
| `src/discord/` | Transport: verify, respond, REST | configured `dio` client |
| `src/commands/` | Slash command handlers | controllers / notifiers |
| `src/components/` | Button and select handlers | controllers / notifiers |
| `src/game/` | **Pure rules.** No I/O, no Discord | domain layer |
| `src/game/content/` | The catalogues, as data | seed data / constants |
| `src/db/queries.ts` | Every SQL statement | repository |
| `src/render/embeds.ts` | Every embed and component | widgets |

### The rule worth enforcing

**`src/game/` must never import from `discord/`, `db/`, or `render/`, and must
never perform I/O.**

Combat, affinity, weaving, encounters and progression are pure functions taking
data and returning data. That is why there are two hundred tests over them
running in under a second, and it is where the real bugs live. The same reason
business logic stays out of widgets.

`src/db/queries.ts` holds every statement in the project so the SQL is auditable
in one pass and no handler ever assembles a query string.

---

## Data model

Seven tables. All timestamps are unix seconds; all Discord ids are `TEXT`,
because snowflakes exceed 2^53 and would be silently corrupted as integers.

| Table | Holds |
|---|---|
| `players` | one row per user: level, xp, gold, Resolve, active Echo |
| `echoes` | one row per bound Echo, owned by a player |
| `allies` | which Allies are recruited, in the party, and their stance |
| `runs` | descents, live and finished — including the whole game state |
| `discoveries` | codex entries and the affinity-reveal bitmask |
| `guild_config` | per-server digest channel |
| `ladder` | per-server score |

Two details are load-bearing:

**`runs.state_json`** holds an entire descent — HP, Focus, depth, the live
encounter, unbanked spoils — as one JSON blob. Because a Worker remembers
nothing, every button press loads this, applies exactly one action, and writes
it back. It is the single mechanism that makes a multi-turn game possible
without a server.

**`discoveries.flags`** is a bitmask over the element list. Bit *n* set means
the player has struck that Husk with element *n* and may therefore see that
affinity. It is what makes the codex a record of what you have learned rather
than a spoiler table.

---

## Decisions and their reasons

**One active run per player, enforced in SQL.** A partial unique index on
`runs(user_id) WHERE status = 'active'` rather than a check in every call site.
The database is the only place that cannot be forgotten.

**Buttons carry a turn number.** Discord leaves old components live forever, so
a `custom_id` encodes `runId:turn` and a press whose turn does not match the
stored run is refused. Without it, double-clicking buys two actions. Presses are
also checked against the run's owner, so a copied `custom_id` cannot drive
somebody else's game.

**Resolve regenerates lazily.** Rather than a job that tops everyone up,
`projectResolve` computes the current value from when it was last spent. It
cannot drift, cannot double-award, and does not care whether the cron fired. The
stamp advances only by whole intervals consumed — advancing it to *now* on every
read would restart the timer each time somebody opened their profile, and
Resolve would never refill.

**The RNG is seeded and resumable.** `mulberry32`'s 32-bit cursor is persisted
with the run and fed back on the next press. A descent is therefore reproducible
from its seed, which matters the first time somebody insists the bot cheated
them.

**Weaving is deterministic, not rolled.** The player confirms a destructive act
against a preview. Rolling the result at commit time would make that preview a
lie.

**A run settles in one batch.** XP, gold, new Echoes, codex entries and the
ladder all move together or not at all, so a run cannot half-pay.

**Only a fresh knockdown grants Second Wind.** Persona's own rule, and it
terminates weakness chains without needing a separate cap.

**The interactions endpoint is `/interactions`, not `/`.** Cloudflare's asset
layer answers before the Worker and returns `405` to a POST at `/`, where the
compendium lives — Discord's endpoint validation POSTs and requires `401`, so it
would refuse the URL outright. `not_found_handling` is left at its default for
the same reason: the single-page-application setting would serve the compendium
for `/interactions` too, and no command would ever arrive.

**Ed25519 verification uses WebCrypto directly.** Cloudflare implements it
natively, so there is no library. Imported keys are cached per isolate because
key import is elliptic-curve work and the CPU budget is 10 ms.

**Allies act automatically.** Driving three characters by hand is three network
round trips per round. One press per turn is the difference between a game and a
chore.

---

## Security

**Secrets never enter the repository.** `DISCORD_PUBLIC_KEY`,
`DISCORD_APPLICATION_ID` and `DISCORD_BOT_TOKEN` are Cloudflare secrets in
production and live in a gitignored `.env` locally. `.env.example` is the
committed template. `wrangler.toml` is committed and contains no secret — the
D1 `database_id` is an identifier, not a credential.

**Every request is verified.** An unsigned or badly signed request gets `401`
before anything else happens. This is not merely defensive: Discord validates a
candidate endpoint by sending a deliberately invalid signature and requiring
exactly that status.

**Ownership is checked, not assumed.** Run presses verify the run's owner;
Echo deletes are scoped by `owner_id` as well as id, so a forged identifier
cannot reach another player's data.

**No stack traces reach players.** A thrown error is logged and answered with an
ephemeral apology.

**No personal data is stored.** Only Discord user and guild ids — no names, no
emails, nothing that would engage PDPA obligations.

**The Message Content intent is not used.** Slash commands need no visibility of
ordinary messages, so the bot cannot read chat at all.

---

## The scheduled job

One cron trigger, `0 16 * * *` — 16:00 UTC, which is midnight in Malaysia. It
posts the day's Rift suit and the server standing to whichever channel
`/setchannel` named.

It is the only thing Mooji says unprompted, and it is optional. A guild whose
channel has gone — bot removed, channel deleted — is switched off after a single
failure rather than retried nightly forever.

Nothing else depends on it firing.

---

## The compendium

`wiki/build.ts` generates `public/index.html` from `src/game/content/`, and
Cloudflare serves it from `/`. `npm run deploy` rebuilds it first, so a deploy
cannot ship yesterday's numbers.

Generating it is the point: a hand-maintained wiki goes stale the first time an
affinity is tuned. Change a weakness in the catalogue and the page changes on
the next build, because both read the same module. One fact, one place.

Husk affinities are blurred behind a deliberate toggle — printing them openly
would make the in-game discovery mechanic pointless.

---

## Adding content

Almost everything you will want to change is data, in `src/game/content/`:

| File | Holds |
|---|---|
| `skills.ts` | every skill, its element, cost and effect |
| `echoes.ts` | Echo species, affinities, stats, learnsets, starters |
| `husks.ts` | Husk species by rank, and what each yields when bound |
| `suits.ts` | suit labels, blurbs, and the weaving rule |
| `allies.ts` | Allies, their bound Echo and unlock level |

To add an Echo: append to the list in `echoes.ts`, give it a suit, a rarity 1–5,
stats, an affinity table, and a learnset naming skills that exist. Then run
`npm test`. The catalogue tests will tell you if you have referenced a skill
that does not exist, given something no weakness, left a Warden without a Veil,
or broken the weaving grid — before a player finds it for you.

`npm run deploy` rebuilds the compendium and ships it.

Two rules for content: every creature needs at least one weakness, or the swap
decision evaporates; and every name must be original — see the terminology table
in the README for why.

---

## Testing

`npm test` runs roughly two hundred tests, almost all over `src/game/`, in under
a second. They exist because that is where behaviour lives.

The ones worth knowing about: the affinity matrix and its multipliers; Second
Wind firing on a fresh knockdown and *not* on an already-downed target; the
damage formula's bounds; bind probability clamping; weaving determinism and its
level gate; the XP curve; lazy Resolve regeneration preserving partial
intervals; and the integrity of every catalogue.

`npm run typecheck` runs twice — once for the Worker under Cloudflare's types,
once for the Node scripts under Node's. They are deliberately separate so Worker
code cannot reach for `Buffer` and still compile.

---

## Deploying

```bash
npm run deploy        # builds the compendium, then deploys the Worker
npm run register      # only after changing src/commands/definitions.ts
```

Schema changes go in a new file under `migrations/` and are applied with
`wrangler d1 execute mooji --remote --file=...`. The full first-time setup is in
the README.

---

## If it outgrows this

It will not soon — the free plan covers roughly a hundred thousand commands a
day — but the honest answer to what breaks first:

**The 10 ms CPU budget**, if combat grows much more elaborate. The paid plan
raises it enormously; nothing needs restructuring.

**D1 write volume**, if there were thousands of concurrent players. Runs are
written on every button press, which is the cost of statelessness.

**Anything real-time.** PvP with a shared timer, or a live raid, cannot be built
on cron alone — a minute is the finest granularity available. Durable Objects
are the answer, and the design deliberately avoids depending on their alarms
because Cloudflare's documentation and changelog disagreed about whether they
work on SQLite-backed objects. Verify that before relying on it.

None of these is close. The point of the architecture is that the bill stays at
zero until somebody actually plays it a great deal.
