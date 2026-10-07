export * from "./types";
export { createGame, type NewGameOptions } from "./setup";
export { resolveTurn, type TurnObserver } from "./resolve";
export { viewFor, trueDetail, copyDetail, seesPolitically, dealView, type PlayerView, type TerritoryView, type TerritoryDetail, type DealView, type SpyView } from "./view";
export { spreadTroops, buildingSpot, type SpreadLand } from "./spoils";
export { emptyStats, landHeld } from "./history";
export { spiesOn, wholeHolder, forgedDetails, spyReports, spiesEndOfTurn } from "./spies";
export { spyLine, type SpyNames } from "./spyText";
export {
  anyDealAcross,
  attackAcross,
  between,
  bindingCost,
  breakDeal,
  coveredBorders,
  covers,
  dealAcross,
  dealProblem,
  dealSize,
  dealTurns,
  defaultTerms,
  desert,
  diplomacyEndOfTurn,
  diplomacyStart,
  isParty,
  landProblem,
  oathPenalty,
  otherSide,
  pairKey,
  partnersOf,
  passageFor,
  scopeHas,
  termsProblem,
  tradeTotals,
  type DealBoard,
  type DiplomacyHost,
  type OwnerOf,
} from "./diplomacy";
export { DEAL_NAME, dealLine, dealProblemWords, describeTerms, type DealNames } from "./dealText";
export { playWorldEvents, worldEventEffect, fallenEndOfTurn, borderKey, type WorldEventHost } from "./fallen";
export { recordSighting, updateIntel, type Intel, type LastSeen } from "./intel";
export { visionFor, visibleTerritories, type Vision, type VisionSource } from "./vision";
export { replayFor, type ReplayEvent, type SurfaceEvent, type VisionEvent, type SeenTerritory } from "./replay";
export { TurnVision, recordTurnSightings, sightingOf, applyLand, type VisionDelta } from "./sightings";
export { checkMissions, drawFate, type FateHost } from "./fate";
export { SPOILS_MARKS, setsIn, withoutSet, homeOf, laurelLand, autoSpoils, turnInSpoils, spoilsEndOfTurn, type SpoilsHost } from "./spoils";
export { PRESETS, expandPreset, type PresetInfo } from "./presets";
export { expectBattle, rollLosses, healerReduction, cultureDefense, terrainDefense, bannerBonus, type BattleExpectation, type BattleInput } from "./combat";
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
  spyUpkeep,
  cultureKept,
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
export { goalLine, governLine, type GovernNames } from "./govern";
export {
  authorOf,
  budgetAmount,
  cleanBudget,
  cleanName,
  commandFits,
  dealLeaderNames,
  findLeader,
  isMilitaryCommand,
  isShareBudget,
  isStewardCommand,
  leaderAt,
  leaderKey,
  NO_BUDGET,
  pursesTotal,
  refOf,
  sameLeader,
  startingLeaders,
  suggestLeaderName,
} from "./leaders";
