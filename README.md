# Mooji

A turn-based RPG that lives inside Discord. Summon an Echo, strike an enemy's
elemental weakness to knock it down and act again, then finish the round with
everyone at once.

Runs entirely on Cloudflare's free tier. There is no server, no gateway
connection, and no bill.

---

## Playing

**[Add Mooji to your server](https://discord.com/oauth2/authorize?client_id=1467015114032152586&permissions=277025508352&integration_type=0&scope=bot%20applications.commands)**

Then run `/awaken`. Mooji hands you one Echo and gets out of the way.

### The one rule that matters

Your summoned Echo lends you its **skills** and its **weaknesses** both.

Swapping to Ember to exploit something's Ember weakness also hands that thing
your new Frost weakness. Swapping is free and does not cost your turn — but it
is never without cost, and that is the whole game.

### How a fight works

- Hit a **weakness** (or land a critical) and the target is **Downed** and you
  get a **Second Wind** — another turn, immediately.
- A target that is *already* down grants nothing, so chains end on their own.
- Down **every** Husk at once and you may spend the turn on an **Onslaught**,
  the whole party at once — or on a **Bind**, taking one home instead of
  killing it.
- Win by Onslaught and you get **The Draw**: three face-down cards, pick one.

### Commands

| Command | What it does |
|---|---|
| `/awaken` | Become a Wanderer and receive your first Echo. Once only. |
| `/descend` | Enter a Rift, or pick up the one you left. |
| `/echoes` | Summon, inspect, or release an Echo. |
| `/weave` | Consume two Echoes to make a stronger one. |
| `/party` | Choose which Allies come along, and how they fight. |
| `/codex` | Everything you have met, and what you learned about it. |
| `/profile` | Level, Resolve, gold, standing. |
| `/leaderboard` | How the server is doing. |
| `/setchannel` | *(admin)* Where the daily digest posts. Run again to stop it. |

### Descending

A Rift is ten steps deep. Each step rolls: packs of Husks, an elite, a cache, a
place to rest, something willing to negotiate, or — rarely — something gilded
that will not stay to fight. Depth ten is always a **Warden**, whose weaknesses
are sealed behind a **Veil** until enough attacks connect.

**HP and Focus do not restore between steps.** Going deeper is a decision.

- `/retreat` (the button) banks everything you are carrying.
- Falling costs you the unbanked **gold** only. XP and anything already bound
  are yours.
- A descent costs **1 Resolve**, of 5. One returns every three hours.

### Echoes

You may carry `4 + floor(level / 2)`, to a hard cap of twelve. At capacity you
must release or weave before binding anything new — the pressure is deliberate.

Four ways to get them: **Bind** one mid-fight, **The Draw**, a **negotiation**
in a Rift, or **weaving** two together. Binding and drawing supply the raw
material; weaving is how anything genuinely strong is made.

### The codex

`/codex` is the reference and the collection log at once, in three pages:

- **Husks** — every Husk in the game is listed, but one you have never met
  reads `???`, and one you have met shows only the affinities you have
  actually **tested**. An element you have not tried against it is a `?`. There
  is no way to look a weakness up: you find it by hitting the thing and seeing
  what happens. A resisted or nulled attempt teaches you just as much as a
  clean hit.
- **Echoes** — the same, revealed as you bind them.
- **Skills** — everything, always. What Cinder costs and what it does is
  reference, not a spoiler, and hiding it would only make the game harder to
  read.

The Worker also serves a **public compendium** at its own URL, generated from
the same files the bot runs on so it can never fall out of date. Husk
affinities there are blurred behind a deliberate spoiler toggle, for the same
reason.

---

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
WebSocket, which is why no process needs to stay alive and why the free tier is
enough.

That imposes two constraints worth knowing before you change anything:

- **3 seconds** to answer Discord, and **10 ms of CPU** per request on the free
  plan. I/O does not count toward CPU time; heavy computation does.
- No state between requests. A whole descent lives in one `runs.state_json`
  column and every button press is a read-modify-write.

### Layout

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
migrations/         D1 schema
```

**`src/game/` must stay free of I/O and Discord types.** Combat, affinity,
weaving and progression are pure functions, which is why they can be tested
properly — and that is where the real bugs live.

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

# 3. Put the same three values in .dev.vars (gitignored) for local use, then
#    register the commands. Add DISCORD_TEST_GUILD_ID while developing -
#    guild commands appear instantly, global ones take up to an hour.
npm run register

# 4. Go
npm run dev               # local, needs a tunnel for Discord to reach it
npm run deploy            # builds the wiki, then deploys
```

`.dev.vars` is a plain `KEY=value` file in the project root, read by both
`wrangler dev` and `npm run register`. It is gitignored; never commit it.

Finally, set the **Interactions Endpoint URL** in the Discord developer portal
to your Worker's URL. Discord validates it by sending a deliberately invalid
signature and requiring a `401` — so if it refuses the URL, the problem is
almost always `DISCORD_PUBLIC_KEY`.

### Checks

```bash
npm test          # 204 tests, mostly over src/game
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
- Every number in the game is a starting value for tuning. Balance comes from
  play, not from argument.

---

## Licence

MIT.
