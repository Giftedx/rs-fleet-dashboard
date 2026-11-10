# The data format

The page reads `public.json`. [scripts/make-demo.ts](../scripts/make-demo.ts) builds a full example. Run `bun scripts/make-demo.ts` and read `demo/public.json` beside this page.

Send every key. If you have no data for a list, send an empty list. A time is a number of milliseconds since 1970 (`Date.now()`), unless the text says a different format.

A value that you do not know can be `null` where the tables say "or null". [scripts/publish.ts](../scripts/publish.ts) is an example: it knows no inventory, quest or goal, so it sends empty lists and `null`.

The page refuses a file that has no `bots` list or no numeric `now`. The page also refuses a file that is older than the file it has.

## Top level

| Key | Type | Meaning |
|---|---|---|
| `now` | time | When the publisher made the file |
| `hosted` | object | `{ at, kind }`. `at` is the time of the file. `kind` is `"public"`. The page shows a red bar when `at` is more than 15 minutes old |
| `snapshotAt` | ISO date text | When the publisher last read the hiscores |
| `pageVersion` | number | A number that changes when you deploy a new page |
| `world` | object | `{ players, tick, tickAt, tickMs, connected, rev }`: the player count, the game tick, its time, the tick length in ms, the state of the feed and the cache revision |
| `worldPlayers` | number | The count of players in the world |
| `roster` | list | One row for each player in the world: `[name, x, z, level, combat]` |
| `bots` | list | One object for each bot. See below |
| `boards` | list | One object for each hiscore board. See below |
| `rivals` | list | For a board, the top rows: `{ board, at, ours, rows }`. A row is `{ rank, name, level, ticks, fleet, online, x, z }` |
| `lookups` | object | Player lookups that the page can answer, keyed by the lower-case name: `{ name, at, rows, online, x, z, plane, combat, lastSeen, worn, wornAt }`. A row is `{ board, rank, level, time }` |
| `liveTops`, `liveTopsAt` | number, time | The count of boards with a fresh top row, and the time of that read |
| `contention` | list | Places where other players use the resource of a bot: `{ side, resource, kind, x, z, others, ours }` |
| `farms` | list | Groups of other players with a series of names: `{ key, label, count, names, range, tiles, atSpots }` |
| `icons` | object | Item name to item id (as text), for each item that a bot holds |
| `results` | list | Finished jobs, newest first: `{ at, name, ok, text }` |
| `events`, `alerts` | list | Messages for the chat box and the alert panel. Empty lists are valid |
| `economy` | object | `{ farmers, goldPerTick, itemExamine, itemValues, pricesAt, supplies, trend }`. `itemValues` is item name to price. `itemExamine` is item name to examine text. A supply is `{ id, name, ask, bid, stock, vwap, base }` |
| `coordination` | object | The job queue: `{ agents, available, counts, fresh, paused, tasks }`. `counts` is `{ running, pending, succeeded, failed }`. Send `available: false` when you have no queue |
| `fleetSides` | object | `{ at, sides }`. A side is one machine that runs bots: `{ side, at, late, accounts }`. An account is `{ name, at, total }` |
| `map` | object | `{ x0, z0, w, h, scale, ready }`. Send `ready: false` unless you also publish `map.bin` |

`map.bin` is optional. It is `w * h` bytes, one for each map cell, and the page draws it under the dots of the world map when `map.ready` is true.

## A bot

| Key | Type | Meaning |
|---|---|---|
| `name` | text | The account name |
| `server`, `side` | text | The game server and the machine that runs the bot |
| `practice`, `reserved` | boolean | A bot on a practice server. A bot that a job holds |
| `at`, `started`, `lastSeen` | time | The last state, the login and the last sight of the bot |
| `uptime` | ms | The time since the login |
| `fresh`, `inWorld`, `seenInFeed` | boolean | The state is current. The bot is logged in. The world feed shows the bot |
| `operation` | text | The state of the bot. `"observed"` is a bot that plays now. `"offline"` is a bot that is logged out. The page also knows `"paused"`, `"blocked"`, `"failed"`, `"died"`, `"ended"`, `"reserved"`, `"unobserved"` and `"active-stale"` |
| `pos` | object or null | `{ x, z, level }` in game tiles. `null` for a bot that the publisher never saw |
| `live` | object or null | The row of the bot in the world feed: `{ name, x, z, level, combat, seen }` |
| `hp` | object | `{ now, max }` |
| `combat` | number | The combat level |
| `skills` | list | 21 rows in the order of the server: `{ name, level, currentLevel, xp }` |
| `quests`, `questsAt` | list, time | `{ id, name, state }` for each quest. `state` is `"not started"`, `"started"` or `"complete"` |
| `equipment`, `equipmentObserved` | list, boolean | The worn items. `equipmentObserved` is false until the publisher has read them |
| `inventory` | list | `{ id, baseId, name, count }` for each stack |
| `ranks`, `ranksAt` | list, time | The hiscore rows of the bot: `{ board, rank, level, time, delta, since, hist }`. `hist` is a list of earlier ranks, oldest first |
| `role` | text | The job type, such as `"mining"` |
| `goal`, `currentGoal` | text | What the bot does, in words |
| `goalSkill`, `goalLevel`, `goalNow`, `goalXp` | text, numbers, or null | The skill of the goal, the level to reach, the level now and the XP now |
| `xpPerTick`, `xpPerHour`, `xpLeft`, `eta`, `rateSkill` | numbers, text | The XP rate, the XP to the goal, the time to the goal as text and the skill that the rate measures |
| `spark` | list of numbers | Recent XP for each tick, oldest first, for the small chart |
| `action` | text | The current action, or `"idle"` |
| `training` | boolean | The bot gains XP now |
| `death`, `outcome` | object or null | The last death and the last job result. `null` is valid |

## A board

`{ board, kind, top, best, gap }`

- `board` is the board name, such as `"Overall"` or `"Mining"`.
- `kind` is `"skill"` or `"value"`.
- `top` is rank 1: `{ name, level, time, ticks, live, at }`.
- `best` is your best bot on the board, or `null`: a rank row with `name`.
- `gap` is the distance from `best` to `top`, or `null`: `{ kind, ahead, text, close }`. `close` is a number from 0 to 1.

## The control file and commands

After the owner signs in, the page reads `control.json` from the branch `data` in place of `public.json`. It has the same keys. It can also have these keys:

- `control`: `{ requests }`. A request is the receipt of a command: `{ id, action, at, taskId, status }`.
- `revealName`: the real name of an account that the public file masks as `⟦MAIN⟧`.

The page writes a command as the file `commands/<id>.json` on `main`:

```json
{ "id": "<uuid>", "action": "account-pause", "account": "DemoMiner", "at": 1800000000000, "by": "control-page" }
```

Your publisher applies each command once and puts a receipt with the same `id` in `control.requests`. Before it applies a command, it must check these things:

1. The GitHub API names the repository owner as the committer of the file.
2. The `id` is a UUID that has no receipt.
3. The command is less than 15 minutes old.
