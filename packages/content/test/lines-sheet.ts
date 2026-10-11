/**
 * Writes Nate's sheet, `docs/voice/lines-for-nate.md`, from the line library (session 23: session 22 wrote it by
 * hand). Every line a bot or a leader can say, grouped by who says it and when, with every version.
 *
 *   npx tsx packages/content/test/lines-sheet.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LEADER_VOICES, lines, VOICES, type BotSituation, type CapturedSituation, type LeaderSituation, type ScreenSituation } from "../src/lines";

const BOT: Record<BotSituation, string> = {
  truceYes: "Truce: yes",
  truceNo: "Truce: no",
  warYes: "Joint war: yes",
  warNo: "Joint war: no",
  tradeYes: "Trade: yes",
  tradeNo: "Trade: no",
  passageYes: "Right of passage: yes",
  passageNo: "Right of passage: no",
  offerTruce: "Offers a truce",
  offerWar: "Offers a joint war",
  breaks: "Breaks a deal for a prize",
  yesTail: "Its turn of phrase after a plain yes",
  noTail: "Its turn of phrase after a plain no",
};
const LEADER: Record<LeaderSituation, string> = {
  opening: "Its first word of the game",
  took: "Took land",
  pushedBack: "Driven back",
  capitalTaken: "Took a rival's capital",
  capitalLost: "Your capital fell",
  finished: "Finished a rival",
  threatened: "A rival army near your capital (it runs your army)",
  threatenedYours: "A rival army near your capital (you run the army)",
  purseEmpty: "Its purse is empty",
  wallBuilt: "A wall finished (the Steward)",
  judgeAttack: "Judging your failed attack (with the army that was next to it)",
  judgeAttackAlone: "Judging your failed attack (nothing next to it)",
  judgeThin: "Judging land you left thin",
  judgeTruce: "Judging a truce you broke",
  judgeGold: "Judging gold left idle",
  judgeCapital: "Judging your capital left light",
  compliment: "A grudging compliment",
  grudgeFort: "A grudge: our fort burned",
  grudgeHome: "A grudge: home land taken",
  grudgeArmy: "A grudge: our army wiped out",
  grudgeRevenge: "The grudge settled",
  grudgeRespect: "The grudge turns to respect",
  handout: "The Steward's handout (nothing worth building)",
};
const CAPTURED: Record<CapturedSituation, string> = {
  firstReport: "Its first report",
  took: "Took land",
  pushedBack: "Driven back",
  capitalTaken: "Took a capital",
  finished: "Finished a rival",
  needle: "Needling its old House",
  purseEmpty: "Its purse is empty",
  wallBuilt: "A wall finished",
};
const SCREEN: Record<ScreenSituation, string> = {
  titleHouseOut: "Subline: a House knocked out",
  titleCapitalFalls: "Subline: a rival's capital falls",
  titleDealBroken: "Subline: a deal broken (not by you)",
  titleComeback: "Subline: your own comeback (\"House Or is back\")",
  overWon: "Game over: you won",
  overLost: "Game over: you lost",
  overDraw: "Game over: a draw",
  awardMilitary: "Award remark: Military",
  awardCulture: "Award remark: Culture",
  awardBuilder: "Award remark: Builder",
  awardSpymaster: "Award remark: Spymaster",
  awardDiplomat: "Award remark: Diplomat",
  awardWall: "Award remark: Wall",
  awardKingslayer: "Award remark: Kingslayer",
  awardFortune: "Award remark: Fortune",
  awardQuartermaster: "Award remark: Quartermaster",
  awardOathbreaker: "Award remark: Oathbreaker",
  awardSurvivor: "Award remark: Survivor",
  waitingBots: "Waiting for the bots",
  waitingOthers: "Waiting for the others",
};
const NAME: Record<string, string> = { conqueror: "The Conqueror", blitzer: "The Blitzer", turtle: "The Turtle", schemer: "The Schemer", opportunist: "The Opportunist", merchant: "The Merchant", neutral: "Neutral (dry and brief)" };

const picked = new Set(lines.picked);
const head = (label: string, path: string) => `**${label}**${picked.has(path) ? " *(your pick)*" : ""}`;
const block = (label: string, path: string, xs: readonly string[] | undefined) => (xs?.length ? [head(label, path), ...xs.map((x) => `- ${x}`), ""] : []);

const out: string[] = [];
const count = (f: (v: string) => number, vs: readonly string[]) => vs.reduce((a, v) => a + f(v), 0);
const sum = (o: Record<string, readonly string[] | undefined> | undefined) => Object.values(o ?? {}).reduce((a, xs) => a + (xs?.length ?? 0), 0);
out.push(
  "# Lines for Nate (the line library)",
  "",
  "*Every line a bot or a leader can say, grouped by who says it and when, with every version. Strike or change anything that doesn't sound like you (edit this file, or mark it up in a copy): the next session applies your marks to `packages/content/data/lines.json`. `{place}` and the like are filled in by the game with the real names and numbers. *(your pick)* marks a situation where you picked the versions (Oct 10, `nate-picks-oct10.md`): those keep only what you kept.*",
  "",
  `*Generated from the line library by \`packages/content/test/lines-sheet.ts\`. Counts: ${count((v) => sum(lines.bots[v as (typeof VOICES)[number]]), VOICES)} bot lines, ${sum(lines.reasons.plain)} plain reasons, ${count((v) => sum(lines.reasons.voiced[v as (typeof VOICES)[number]]), VOICES)} personality reasons, ${count((v) => sum(lines.leaders[v as (typeof LEADER_VOICES)[number]]), LEADER_VOICES)} leader lines, ${sum(lines.captured)} captured-leader lines, ${sum(lines.screens)} screen lines.*`,
  "",
  "## Your picks, applied (Oct 10)",
  "- The lobby's tagline: \"Set your orders, lock in, and watch everyone's plans collide.\"",
  "- The Blitzer's lobby blurb: \"The Blitzer: never stops and never pulls back. Eats lunch on the march.\" (\"Brakes not included.\" is gone.)",
  "- The Merchant's no to a trade has your line: \"The math isn't mathing here.\"",
  "- A captured leader's first report knows the turn it joined: \"I've always admired your House. Since turn {turn}.\"",
  "- Busy buttons keep the dots (\"Sealing…\").",
  "- New in session 23: the comeback card's sublines (below, under the title cards).",
  "",
  "## The six bot personalities",
  "*What each says when its own style decides an answer, its offers, and breaking a deal. The game picks a version from the game, the turn and the bot, so a reload says the same thing.*",
  "",
);
for (const v of VOICES) {
  out.push("", `### ${NAME[v]}`, "");
  for (const k of Object.keys(BOT) as BotSituation[]) out.push(...block(BOT[k], `bots.${v}.${k}`, lines.bots[v][k]));
  const own = Object.entries(lines.reasons.voiced[v]);
  if (own.length) {
    out.push("**Its own versions of the shared reasons**", "");
    for (const [k, xs] of own) out.push(`*${k}*`, ...xs!.map((x) => `- ${x}`), "");
  }
}
out.push("", "## The shared reasons, plain (the Captain and the Recruit, and any personality without its own version)", "");
for (const [k, xs] of Object.entries(lines.reasons.plain)) for (const x of xs) out.push(`- *${k}*: ${x}`);
out.push("", "", "## Your leaders", "*Shown in the turn report under 'Your leaders', in the Chronicle, and (the latest) in the Leaders panel. At most one line per leader a turn and three a report.*", "");
for (const v of LEADER_VOICES) {
  const own = lines.leaders[v];
  if (!own) continue;
  out.push("", `### ${NAME[v]}`, "");
  for (const k of Object.keys(LEADER) as LeaderSituation[]) out.push(...block(LEADER[k], `leaders.${v}.${k}`, own[k]));
}
out.push("", "### Captured leaders (whatever their personality: the loyalty is the voice)", "");
for (const k of Object.keys(CAPTURED) as CapturedSituation[]) out.push(...block(CAPTURED[k], `captured.${k}`, lines.captured[k]));
out.push("", "## Title cards, game over, the awards, waiting", "");
for (const k of Object.keys(SCREEN) as ScreenSituation[]) out.push(...block(SCREEN[k], `screens.${k}`, lines.screens[k]));
out.push(
  "",
  '**Title cards themselves** (plain): "Rookhome falls to House Purpure" (your capital), "Whitemarch is yours" (a capital you took), "Galeholt falls to House Gules" (a rival\'s), "House Azure is no more", "Your House is no more", "Lady Morwen breaks the truce", "You break the truce with Baron Krell", "House Or is back" (your comeback: down to a quarter of your most land, then back above half; once a game, yours only).',
  "",
);

const file = fileURLToPath(new URL("../../../docs/voice/lines-for-nate.md", import.meta.url));
writeFileSync(file, out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n");
console.log(`Wrote ${file}`);
