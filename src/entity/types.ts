export enum GameType {
  UNKNOWN,
  HOLDEM,
  OMAHA,
  OMAHA_HILO,
  FIVECARD_OMAHA,
}

// Game status track the host actions on a game
// This information is updated by the host/manager
export enum GameStatus {
  UNKNOWN,
  CONFIGURED,
  ACTIVE,
  PAUSED,
  ENDED,
}

// Table status track the current status of the table
// This information is updated by the game server
export enum TableStatus {
  UNKNOWN,
  WAITING_TO_BE_STARTED,
  NOT_ENOUGH_PLAYERS,
  GAME_RUNNING,
}

export enum NextHandUpdate {
  UNKNOWN,
  SWITCH_SEAT,
  TAKE_BREAK,
  RELOAD_CHIPS,
  BACK_FROM_BREAK,
  LEAVE,
  PAUSE_GAME,
  END_GAME,
  KICKOUT,
  JOIN_GAME,
}

export enum WonAtStatus {
  PREFLOP,
  FLOP,
  TURN,
  RIVER,
  SHOW_DOWN,
}

export enum GameServerStatus {
  UNKNOWNN,
  ACTIVE,
  DOWN,
}

export enum ClubMessageType {
  TEXT,
  HAND,
  GIPHY,
}

export enum ClubMemberStatus {
  UNKNOWN,
  INVITED,
  PENDING,
  DENIED,
  ACTIVE,
  LEFT,
  KICKEDOUT,
}

export enum PlayerStatus {
  NOT_PLAYING,
  PLAYING,
  IN_QUEUE,
  IN_BREAK,
  STANDING_UP,
  LEFT,
  KICKED_OUT,
  BLOCKED,
  LOST_CONNECTION,
  WAIT_FOR_BUYIN,
  LEAVING_GAME,
  TAKING_BREAK,
  JOINING,
  WAITLIST_SEATING,
}

export enum PromotionType {
  HIGH_HAND,
  BAD_BEAT,
  SPECIFIC_CARDS,
}

export enum BuyInApprovalStatus {
  WAITING_FOR_APPROVAL,
  APPROVED,
  DENIED,
}

export enum ClubStatus {
  UNKNOWN,
  ACTIVE,
  DEFUNCT,
}
