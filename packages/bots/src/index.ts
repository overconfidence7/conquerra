export { makeRecruitBot, recruitBot, type Bot, type RecruitOptions } from "./recruit";
export { CAPTAIN_CHAIN_MARGIN, captainBot, makeCaptainBot, type CaptainFeature, type CaptainOptions } from "./captain";
export { generalAt, generalsOf, launchesFrom, mergeGeneralOrders, planGeneral } from "./generals";
export { chooseInstruction, makeGeneralSeat, type GeneralSeatKind } from "./generalSeat";
export { fallenBot, planFallen } from "./fallen";
export {
  agreedIn,
  answerOrder,
  captainBreaks,
  judgeBy,
  judgeOffer,
  negotiate,
  proposeOffers,
  respectDeals,
  trustIn,
  withAgreed,
  withoutDeals,
  type Answer,
  type Diplomat,
  type DiplomatLevel,
  type Talk,
} from "./diplomacy";
export { captainSpoils, missionPull, missionSpend, MISSION_PULL, recruitSpoils, spoilsOrder, type SpoilsChoice } from "./cards";
export { captainSpies } from "./spies";
export { landEstimates, runawayLeader } from "./board";
export {
  dealPersonalities,
  estimateLand,
  freshMemory,
  makeMarshalBot,
  marshalBoard,
  marshalJudge,
  marshalPropose,
  personality,
  PERSONALITY_IDS,
  planMarshal,
  readRunaway,
  think,
  type Insight,
  type MarshalBot,
  type MarshalMemory,
  type MarshalPlan,
  type MarshalRequest,
  type MarshalScope,
  claimArmies,
  expandCorridor,
  mergeLeaderOrders,
  planLeaders,
  planSteward,
  type Claims,
  type LeaderNote,
  type LeadersPlan,
  type LeadersRequest,
  type Steer,
} from "./marshal";
export { makeDelegateSeat, makeLeaderPathSeat, makeStewardSeat } from "./delegateSeat";
