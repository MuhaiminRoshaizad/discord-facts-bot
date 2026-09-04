# Mooji

A turn-based RPG that lives inside Discord. Summon an Echo, strike an enemy's
elemental weakness to knock it down and act again, then finish the round with
everyone at once.

Runs entirely on Cloudflare's free tier. There is no server, no gateway
connection, and no bill.

---

## Playing

**[Add Mooji to your server](https://discord.com/oauth2/authorize?client_id=1467015114032152586&permissions=277025508352&integration_type=0&scope=bot%20applications.commands)**,
then run `/awaken`. Mooji hands you one Echo and gets out of the way.

### The one rule that matters

Your summoned Echo lends you its **skills** and its **weaknesses** both.

Swapping to Ember to exploit something's Ember weakness also hands that thing
your new Frost weakness. Swapping is free and does not cost your turn - but it
is never without cost, and that is the whole game.

### Commands

| Command | What it does |
|---|---|
| `/awaken` | Become a Wanderer and receive your first Echo. Once only. |
| `/descend` | Enter a Rift, or pick up the one you left. |
| `/echoes` | Summon, inspect, or release an Echo. |
| `/weave` | Consume two Echoes to make a stronger one. |
| `/party` | Choose which Allies come along, and how they fight. |
| `/codex` | Husks, Echoes and skills - and what you have learned about them. |
| `/profile` | Level, Resolve, gold, standing. |
| `/leaderboard` | How the server is doing. |
| `/setchannel` | *(admin)* Where the daily digest posts. Run again to stop it. |

**[docs/PLAYING.md](docs/PLAYING.md)** covers the rest: Second Wind and how
chains terminate, Onslaught and The Draw, binding odds, Wardens and the Veil,
Resolve, weaving, Allies, the codex, the XP curve, and some actual advice.

The bot will always show as **offline** in Discord. Presence requires a gateway
connection, which is exactly the always-on process this design does without. It
answers commands instantly regardless.

### Documentation

| | |
|---|---|
| **[docs/PLAYING.md](docs/PLAYING.md)** | Every rule, and why it is that way. |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Infrastructure, layering, data model, and the reasoning behind each awkward-looking decision. |
| The compendium | Every Echo, Husk and skill, served from the Worker's own URL. |

## Where the ideas come from

The mechanics here are modelled on Atlus' *Persona*, deliberately and with
respect. Game **systems** — exploiting weaknesses, extra turns, fusing entities,
elemental affinities — are not protected by copyright; Malaysia's Copyright Act
1987 s.7(2A) puts "any idea, procedure, method of operation or mathematical
concept as such" outside its scope, and the same idea/expression split applies
everywhere else.

**Expression** is protected, so none of it is borrowed. Every name, every line
of text and every stat here is original:

| *Persona* | Mooji |
|---|---|
| Persona | **Echo** |
| Shadow | **Husk** |
| Velvet Room | **The Threshold** |
| Fusion | **Weaving** |
| One More | **Second Wind** |
| All-Out Attack | **Onslaught** |
| Arcana | **Suit** |
| SP | **Focus** |
| Wild Card | **Unbound** |
| Shuffle Time | **The Draw** |
| Agi / Bufu / Zio … | **Cinder / Rime / Jolt …** |

Keep it that way. If you contribute content, invent it — do not port it.

---

## For developers

### Stack

TypeScript on **Cloudflare Workers**, with **D1** for storage. Discord reaches
the bot through an **HTTP Interactions endpoint** rather than a gateway
WebSocket, which is why no process stays alive and why the free tier is enough.

Two constraints follow, and anything you add has to live inside them: **3
seconds** to answer Discord, **10 ms of CPU** per request, and no state between
requests - a whole descent lives in one `runs.state_json` column.

**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** has the request lifecycle, the
layering, the data model, and the reasoning behind each decision that looks odd
until you know why.

```
src/
  index.ts          Worker entry: fetch() and scheduled()
  discord/          signature verification, response helpers, REST
  commands/         slash command handlers and their definitions
  components/       button and select-menu handlers
  game/             PURE game logic - no I/O, no Discord types
    content/        the catalogues: echoes, husks, skills, suits, allies
  db/queries.ts     every SQL statement in the project
  render/embeds.ts  everything the player sees
wiki/build.ts       generates the compendium from game/content
docs/               PLAYING.md and ARCHITECTURE.md
migrations/         D1 schema
```

**`src/game/` must stay free of I/O and Discord types.** Combat, affinity,
weaving and progression are pure functions, which is why they can be tested
properly - and that is where the real bugs live.

### Running it

```bash
npm install

# 1. Create the database and paste the id into wrangler.toml
npx wrangler d1 create mooji
npm run db:local          # apply the schema locally
npm run db:remote         # ...and remotely, when you are ready

# 2. Secrets. Never put these in wrangler.toml.
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_APPLICATION_ID
npx wrangler secret put DISCORD_BOT_TOKEN

# 3. Local credentials, then register the commands. Add DISCORD_TEST_GUILD_ID
#    while developing - guild commands appear instantly, global ones take up
#    to an hour.
cp .env.example .env      # then fill it in
npm run register

# 4. Go
npm run dev               # local, needs a tunnel for Discord to reach it
npm run deploy            # builds the wiki, then deploys
```

`.env` is read by both `wrangler dev` and `npm run register`. It is gitignored;
`.env.example` is the committed template and documents where each value comes
from. Do not also create a `.dev.vars` - wrangler ignores `.env` when one
exists, which is a quiet way to run as one application and register against
another.

Finally, set the **Interactions Endpoint URL** in the Discord developer portal
to your Worker's URL **with `/interactions` on the end**:

```
https://<your-worker>.workers.dev/interactions
```

Not the bare root. The static compendium is served from `/` by Cloudflare's
asset layer, which answers before the Worker and returns `405` to a POST —
Discord would never reach the handler.

Discord validates the URL by sending a deliberately invalid signature and
requiring a `401`. If it refuses to save, the cause is almost always
`DISCORD_PUBLIC_KEY`.

### Checks

```bash
npm run sim       # balance sweep - win rates, fight length, whole descents
npm test          # 232 tests, mostly over src/game
npm run typecheck # strict, plus a second pass for the Node scripts
```

Tests cover the affinity matrix, Second Wind and its terminator, the damage
formula's bounds, bind probability, weaving determinism, XP curves, lazy
Resolve regeneration, and the integrity of every catalogue. Adding content
without adding it to the catalogue tests is how a dangling skill id reaches a
player.

### Contributing

- Conventional Commits, no emoji, no `Co-Authored-By` trailers.
- Keep `src/game/` pure.
- New Echoes, Husks and skills are data in `src/game/content/`. The catalogue
  tests catch a dangling skill id or a creature with no weakness before a
  player does - see *Adding content* in
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Every number in the game is a starting value for tuning. Balance comes from
  play, not from argument.

---

## Licence

MIT.
