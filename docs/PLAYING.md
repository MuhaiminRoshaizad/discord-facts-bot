# Playing Mooji

Everything the game does, and why. If you only read one section, read
[The one rule](#the-one-rule).

- [Getting started](#getting-started)
- [The one rule](#the-one-rule)
- [Elements and affinity](#elements-and-affinity)
- [A fight, turn by turn](#a-fight-turn-by-turn)
- [Wardens and the Veil](#wardens-and-the-veil)
- [Descending a Rift](#descending-a-rift)
- [Getting Echoes](#getting-echoes)
- [Weaving](#weaving)
- [Allies](#allies)
- [The codex](#the-codex)
- [Levelling](#levelling)
- [Command reference](#command-reference)
- [Advice](#advice)

---

## Getting started

Run `/awaken`. It works once, hands you a single Echo, and never runs again.
Which Echo you get is decided by your Discord account, so it is the same one
however many times you try.

Then `/descend`. That is the game.

---

## The one rule

**Your summoned Echo lends you its skills *and* its weaknesses.**

An Echo is not a weapon you hold. It is the shape you take. When Emberkin is
summoned you can cast Cinder — and you are also weak to Frost, because Emberkin
is. Swap to Brinemote and Frost stops hurting you, but Arc starts.

So exploiting an enemy's weakness is never free. Every swap is a trade: you gain
an answer to one thing and hand over an opening on another. That is the whole
game, and everything below is detail.

Swapping is **free** and does **not** cost your turn, but you may only do it
once per turn. It does not heal you or restore Focus — those belong to you, not
to the Echo.

---

## Elements and affinity

Seven elements: **Ember, Frost, Arc, Gale, Radiance, Blight, Force.**

Force is what a plain Strike uses, which is why nothing nulls it away entirely.

Every creature answers each element in one of six ways:

| Affinity | Damage | What happens |
|---|---|---|
| **Weak** | ×1.75 | Target is **Downed**, attacker gets a **Second Wind** |
| Neutral | ×1.0 | — |
| Resist | ×0.5 | — |
| Null | ×0 | Nothing at all. No knockdown. |
| Repel | ×1.0 | Sent back at the attacker, who may down *themselves* |
| Drain | — | **Heals** the target for what it would have dealt |

Drain and Repel are the ones that will catch you out. Hitting a Tidewrack with
Frost heals it, and you will have spent Focus to do so.

---

## A fight, turn by turn

You bring yourself and up to two Allies against one to three Husks. Turn order
is decided by Speed each round and re-sorted every round, so a Speed buff
genuinely moves you up the queue.

On your turn you may:

- **Act** — pick a skill from the dropdown. Strike is always there and always
  free, which matters when Focus runs out.
- **Swap** — summon a different Echo. Free, once per turn, turn continues.
- **Target** — buttons appear when there is more than one enemy. Your choice
  sticks until you change it.
- **Retreat** — leave, keeping everything.

### Second Wind

Hit a weakness, or land a critical, and two things happen: the target is
**Downed** — it loses its next turn — and you **act again immediately**.

The rule that stops this running forever: **a target that is already down grants
nothing.** Hitting a downed Husk with its weakness again is just damage. So
chains end on their own, and there is no arbitrary cap.

Hitting something that is at 1 HP and killing it grants nothing either. A corpse
cannot be knocked down.

### Onslaught

When **every** living Husk is down at once, an **Onslaught** button appears. The
whole party attacks together for roughly 2.5× the party's combined Attack. It
ignores Resist — but not Null, so an element they are immune to is still the
wrong answer even here.

It also stands them all back up, so it is a finisher, not an opener.

**Winning by Onslaught is the only way to reach The Draw.** That is deliberate:
the reward is for playing the system, not for turning up.

### Bind

With every Husk down you may instead **Bind** one — take it home rather than
kill it. The chance is:

```
35%  +  40% × (how hurt it is)  −  8% per level it has on you
```

clamped between 5% and 90%. So a nearly-dead Husk at or below your level is
close to certain, and a healthy one well above you is close to hopeless.

**Failing costs the opening.** Everything stands back up and the fight
continues. Choosing to bind instead of finishing is a real gamble.

---

## Wardens and the Veil

Depth 10 is always a **Warden**. It has weaknesses, and you cannot use them:
the **Veil** suppresses every one of them until you land three attacks that
actually *connect*.

Resisted, nulled, repelled and drained hits do not count. Only neutral and
(suppressed) weak hits break it. So the opening of a Warden fight is about
finding something it does not shrug off, not about finding its weak point —
that comes after.

Once the Veil breaks, it fights like anything else, and everything you learned
about it applies.

---

## Descending a Rift

A Rift is **ten steps deep**. Each step rolls an encounter, weighted by how deep
you are — trash thins out, elites and rare things thicken:

| What | Roughly |
|---|---|
| A pack of Lesser Husks (1–3) | common, less so deeper |
| A Greater Husk | uncommon, more so deeper |
| A Cache — gold, no fight | occasional |
| A Wanderer's Rest — Focus back | occasional |
| A negotiation — an Echo for gold, no fight | rare |
| A Rare Husk — rich, and **flees after 3 rounds** | rare |
| The Warden | depth 10, always |

**HP and Focus do not restore between steps.** This is the point of the whole
structure. Going deeper is a decision made with what you have left, not a
formality.

### Resolve

A descent costs **1 Resolve** of a maximum of **5**. One returns every three
hours, so a full bar takes fifteen. It regenerates whether or not you are
playing, and whether or not anything is running — the clock is worked out from
when you last spent, not tracked by a background job.

### Leaving

- **Retreat** — ends the run, and you keep everything: gold, XP, anything bound.
- **Falling** — ends the run, and you lose only the **unbanked gold**. XP and
  anything already bound are still yours.

That asymmetry is intentional. A bad run should still move you forward; it just
should not pay.

---

## Getting Echoes

Four routes, and they are not equal.

**Bind** — mid-fight, as above. The everyday method, and the only one that lets
you choose what you get.

**The Draw** — win by Onslaught and three face-down cards appear. Pick one: an
Echo, gold, XP, or Focus. The Echo's rarity is capped by how deep you are, so
a first-floor Onslaught will not hand you anything remarkable.

**Negotiation** — a Rift step where something offers to come along for gold. It
spends your unbanked run gold first, then your purse. Only plainer Echoes turn
up this way.

**Weaving** — see below. This is where anything genuinely strong comes from.

### Capacity

| Your level | 1 | 2 | 4 | 6 | 10 | 16+ |
|---|---|---|---|---|---|---|
| Echo slots | 4 | 5 | 6 | 7 | 9 | 12 |

Twelve is the hard ceiling, reached at level 16. At capacity, anything new is
**turned away** — the run tells you how many — until you release or weave
something.

The tightness is deliberate. A collection with no limit has no decisions in it.

---

## Weaving

`/weave` consumes two Echoes and returns one. It is **deterministic**: what the
preview shows is exactly what you get. Since it destroys two things
irreversibly, a preview that lied would be indefensible.

- The **suit** comes from a fixed table, and is symmetric — the order you pick
  them in makes no difference.
- The **level** is the average of the parents, plus one.
- Up to **two skills** are inherited from the parents, chosen from those the
  result would not learn on its own.
- **The result can never exceed your own level.** Weaving cannot outpace its
  weaver, which is what stops you assembling something absurd at level three.

Same suit woven together stays in that suit. The full grid is on the compendium
page.

---

## Allies

Up to two come with you, chosen with `/party`. They are found as you level: Rell
at 3, Ives at 5, Quill at 7.

Each Ally is bound to **exactly one Echo, permanently**. Only you are *Unbound*
and able to swap. That asymmetry is what makes you the protagonist rather than
one more member of the party.

They act on their own — three characters to drive by hand would be three network
round trips per round, which is tedium in a chat window. Their stance decides
how:

- **Assault** — hunt weaknesses, hit the best target available.
- **Support** — heal anyone below half, otherwise buff, otherwise attack.
- **Conserve** — Strike only, spending no Focus.

Their roles shape what they can do at all: **Striker** damage, **Mender**
healing, **Breaker** buffs and debuffs.

---

## The codex

`/codex` has three pages, and buttons to move between them.

**Husks** — every Husk in the game is listed. One you have never met reads
`???`. One you have met shows only the affinities you have actually **tested**;
an element you have never tried against it shows `?`.

There is no way to look a weakness up. You find it by hitting the thing and
watching what happens — and a nulled or resisted attempt teaches you exactly as
much as a clean hit, because knowing what does *not* work is knowledge too.

**Echoes** — the same, revealed as you bind them.

**Skills** — everything, always. What a skill costs and does is reference, not a
secret, and withholding it would only make the game harder to read.

The public compendium page carries the same information, with Husk affinities
blurred behind a toggle for the same reason.

---

## Levelling

Experience needed for the next level is `round(80 × level^1.5)`:

| Level | 1 | 2 | 3 | 5 | 10 |
|---|---|---|---|---|---|
| To next | 80 | 226 | 416 | 894 | 2,530 |

Every level gives +8 max HP, +4 max Focus, better base stats, and a new Echo
slot every second level.

Echoes level from the same fights — the summoned one takes the full share,
carried ones a quarter. **An Echo can never exceed your level.** Once it reaches
your level it gains nothing at all rather than banking it, so a shelved Echo
will not suddenly leap four levels the moment you advance.

Defeating things pays experience by rank: a Lesser Husk `12 × its level`, a
Greater `40 ×`, a Warden `150 ×`, and a Rare `200 ×` — which is why a Rare
fleeing after three rounds is genuinely worth chasing.

---

## Command reference

| Command | Does |
|---|---|
| `/awaken` | Create your Wanderer and receive your first Echo. Once only. |
| `/descend` | Enter a Rift, or pick up the one you left. |
| `/echoes` | Summon, inspect, or release an Echo. |
| `/weave` | Consume two Echoes to make a stronger one. |
| `/party` | Choose which Allies come along, and how they fight. |
| `/codex` | Husks, Echoes and skills. |
| `/profile` | Level, Resolve, gold, standing. |
| `/leaderboard` | How the server is doing. |
| `/setchannel` | *(admin)* Where the daily digest posts. Run again to stop it. |

A descent you walk away from is **resumed**, not lost. `/descend` picks it back
up where it stands, so a closed tab costs you nothing.

---

## Advice

**Carry a spread, not a favourite.** Four slots with four different weaknesses
beats four strong Echoes that all fold to Frost.

**Swap before you attack, not after.** The swap is free and the information is
free — read what the Husk is before choosing the shape you meet it in.

**Test elements deliberately on something harmless.** A Lesser Husk you can
already beat is a cheap place to fill in a codex entry you will want later
against its Greater cousin.

**Retreat is not losing.** Banking a good run at depth six beats dying at depth
eight and forfeiting all of it. The gold is the only thing death actually takes,
but it takes all of it.

**Weave the ordinary, keep the odd.** Rarity-1 Echoes are raw material. An Echo
with an unusual affinity table — something that *drains* an element — is worth
keeping even at low level, because it answers a fight nothing else does.

**Hunt Onslaughts, not kills.** Downing everything and finishing with an
Onslaught is the only route to The Draw, and it is the difference between a run
that pays and a run that merely ends.
