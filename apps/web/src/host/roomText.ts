/**
 * Session 27: the room's sentences about the table, in a file of their own so the table screen can use them without
 * loading the room's code.
 */

/** The table screen's sentences (the voice guide applies). */
export const TABLE_TEXT = {
  started: "This game has started. Games can't be joined once they're under way, so ask the host to make a new table for the next one.",
  cancelled: "The host cancelled this table.",
  removed: "The host took you off this table.",
  full: "Every seat is taken.",
  /** Session 34: a table seats up to 20, people up to 10 (`MAX_PEOPLE`); the rest are bots. */
  peopleFull: "Ten people are already sitting here. The other seats go to bots.",
  colourTaken: "Someone just took that colour. Pick another.",
  notHost: "Only the host can do that.",
  hostLeaves: "You're the host. Cancel the table instead.",
  notSeated: "Take a seat first.",
  noFriend: "Wait for a friend to sit down, or start with bots.",
  noSeat: "You don't have a seat in this game.",
  notYet: "The game hasn't started yet.",
  /** Session 33b: while a random map is being built (the room's copy when the table is made, then each page's). */
  building: "Building the map…",
  buildingBig: "Building the map… A big map takes a while, longer on a phone.",
  starting: "Starting the game…",
} as const;
