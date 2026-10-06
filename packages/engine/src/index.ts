export * from "./types";
export { createGame, type NewGameOptions } from "./setup";
export { resolveTurn, type TurnObserver } from "./resolve";
export { viewFor, trueDetail, seesPolitically, type PlayerView, type TerritoryView, type TerritoryDetail } from "./view";
export { playWorldEvents, worldEventEffect, fallenEndOfTurn, borderKey, type WorldEventHost } from "./fallen";
export { recordSighting, updateIntel, type Intel, type LastSeen } from "./intel";
export { visionFor, visibleTerritories, type Vision, type VisionSource } from "./vision";
export { replayFor, type ReplayEvent, type SurfaceEvent, type VisionEvent, type SeenTerritory } from "./replay";
export { TurnVision, recordTurnSightings, sightingOf, applyLand, type VisionDelta } from "./sightings";
export { SPOILS_MARKS, setsIn, withoutSet, homeOf, laurelLand, autoSpoils, turnInSpoils, spoilsEndOfTurn, type SpoilsHost } from "./spoils";
export { PRESETS, expandPreset, type PresetInfo } from "./presets";
export { expectBattle, rollLosses, healerReduction, cultureDefense, type BattleExpectation, type BattleInput } from "./combat";
export { SHARES, amountLabel, fewestToTake, isShare, recruitCount, recruitLabel, troopsFor, type RecruitAmount, type Share, type TroopAmount } from "./amounts";
export { previewAttack, recruitSitesIn, isRecruitSiteIn, type AttackPlan } from "./preview";
export { explainFizzle, explainHold, describeFizzledOrder, fizzleIsQuiet, type PlaceNames, type ExplainOptions } from "./explain";
export {
  incomeFor,
  upkeepFor,
  scoreFor,
  investCost,
  cultureProtection,
  provinceCulture,
  specialistUnlocked,
  holdsWholeProvince,
  canRecruitAt,
  type IncomeBreakdown,
} from "./economy";
export { seedCommitment, verifySeed } from "./fairness";
export {
  makeSave,
  readSave,
  replaySavedGame,
  saveSummary,
  stateFingerprint,
  SAVE_FORMAT,
  SAVE_PROBLEMS,
  SAVE_VERSION,
  STATE_MIGRATIONS,
  STATE_VERSION,
  type ReadSave,
  type SaveFile,
  type SavedGameV1,
  type SaveSummary,
} from "./saved";
export { indexMap, distancesFrom, type MapIndex } from "./mapIndex";
export { Rng, seedRng, type RngState } from "./rng";
