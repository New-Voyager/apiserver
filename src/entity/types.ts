export enum GameType {
  UNKNOWN,
  HOLDEM,
  OMAHA,
  OMAHA_HILO,
  FIVECARD_OMAHA,
}

export enum GameStatus {
  UNKNOWN,
  CONFIGURED,
  PREPARING,
  WAITING_FOR_PLAYERS,
  WAITNG_TO_BE_STARTED,
  RUNNING,
  PAUSED,
  ENDED,
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
  BREAK,
  STANDING_UP,
  LEFT,
  KICKED_OUT,
  BLOCKED,
  WAIT_FOR_SITTING_APPROVAL,
  LOST_CONNECTION,
  WAIT_FOR_BUYIN_APPROVAL,
}

export enum PromotionType {
  HIGH_HAND,
  BAD_BEAT,
  SPECIFIC_CARDS,
}

export enum ClubStatus {
  UNKNOWN,
  ACTIVE,
  DEFUNCT,
}
