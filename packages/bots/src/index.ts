export { makeRecruitBot, recruitBot, type Bot, type RecruitOptions } from "./recruit";
export { CAPTAIN_CHAIN_MARGIN, captainBot, makeCaptainBot, type CaptainFeature, type CaptainOptions } from "./captain";
export { generalAt, generalsOf, launchesFrom, mergeGeneralOrders, planGeneral } from "./generals";
export { chooseInstruction, makeGeneralSeat } from "./generalSeat";
export { fallenBot, planFallen } from "./fallen";
export {
  agreedIn,
  answerOrder,
  captainBreaks,
  judgeOffer,
  negotiate,
  proposeOffers,
  respectDeals,
  trustIn,
  withAgreed,
  withoutDeals,
  type Answer,
  type DiplomatLevel,
  type Talk,
} from "./diplomacy";
export { captainSpoils, missionPull, missionSpend, MISSION_PULL, recruitSpoils, spoilsOrder, type SpoilsChoice } from "./cards";
export { captainSpies } from "./spies";
