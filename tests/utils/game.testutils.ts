import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';
import {loggers} from 'winston';

export const configureGameQuery = gql`
  mutation($clubCode: String!, $gameInput: GameCreateInput!) {
    configuredGame: configureGame(clubCode: $clubCode, game: $gameInput) {
      title
      gameCode
      gameType
      smallBlind
      bigBlind
      straddleBet
      buyInMin
      buyInMax
      utgStraddleAllowed
      buttonStraddleAllowed
      maxWaitList
      maxPlayers
      minPlayers
      rakePercentage
      rakeCap
      gameLength
      buyInApproval
      breakLength
      autoKickAfterBreak
      waitForBigBlind
      waitlistSupported
      maxWaitList
      sitInApproval
      actionTime
      muckLosingHand
    }
  }
`;

export const configureFriendsGameQuery = gql`
  mutation($gameInput: GameCreateInput!) {
    configuredGame: configureFriendsGame(game: $gameInput) {
      title
      gameCode
      gameType
      smallBlind
      bigBlind
      straddleBet
      buyInMin
      buyInMax
      utgStraddleAllowed
      buttonStraddleAllowed
      maxWaitList
      maxPlayers
      minPlayers
      rakePercentage
      rakeCap
      gameLength
      buyInApproval
      breakLength
      autoKickAfterBreak
      waitForBigBlind
      waitlistSupported
      maxWaitList
      sitInApproval
      actionTime
      muckLosingHand
    }
  }
`;

export const getClubGamesQuery = gql`
  query($clubCode: String!, $page: PageInput) {
    clubGames: clubGames(clubCode: $clubCode, page: $page) {
      pageId
      gameCode
      status
      startedAt
      startedBy
      endedBy
      endedAt
    }
  }
`;

export const gameByIdQuery = gql`
  query($gameCode: String!) {
    game: gameById(gameCode: $gameCode) {
      id
    }
  }
`;

export const gameHistoryByIdQuery = gql`
  query($gameCode: String!) {
    gameHistory: gameHistoryById(gameCode: $gameCode) {
      gameId
      gameCode
      clubId
      hostId
      hostName
      hostUuid
      gameType
      smallBlind
      bigBlind
      handsDealt
      roeGames
      dealerChoiceGames
      startedAt
      endedAt
      endedBy
      endedByName
    }
  }
`;

export const gameDataByIdQuery = gql`
  query($gameCode: String!) {
    game: gameDataById(gameCode: $gameCode) {
      gameId
      gameCode
      clubId
      hostId
      hostName
      hostUuid
      gameType
      smallBlind
      bigBlind
      handsDealt
      roeGames
      dealerChoiceGames
      startedAt
      endedAt
      endedBy
      endedByName
    }
  }
`;

export const playersInGameByIdQuery = gql`
  query($gameCode: String!) {
    playerData: playersInGameById(gameCode: $gameCode) {
      buyIn
      handStack
      leftAt
      noHandsPlayed
      noHandsWon
      noOfBuyins
      playerId
      playerName
      playerUuid
      sessionTime
    }
  }
`;

export const playersGameTrackerByIdQuery = gql`
  query($gameCode: String!) {
    playerGameTrackerData: playersGameTrackerById(gameCode: $gameCode) {
      buyIn
      handStack
      leftAt
      noHandsPlayed
      noHandsWon
      noOfBuyins
      playerId
      playerName
      playerUuid
      sessionTime
    }
  }
`;

export interface GameInput {
  title: string;
  gameType: string;
  smallBlind: number;
  bigBlind: number;
  buyInMin: number;
  buyInMax: number;
  straddleBet: number;
  utgStraddleAllowed?: boolean;
  buttonStraddleAllowed?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  rakePercentage?: number;
  rakeCap?: number;

  // other options
  gameLength?: number;
  buyInApproval?: boolean;
  breakLength?: number;
  autoKickAfterBreak?: boolean;
  waitForBigBlind?: boolean;
  waitlistSupported?: boolean;
  maxWaitList?: number;
  sitInApproval?: boolean;
  actionTime?: number;
  muckLosingHand?: boolean;
}

export const joinGameQuery = gql`
  mutation($gameCode: String!, $seatNo: Int!) {
    status: joinGame(gameCode: $gameCode, seatNo: $seatNo)
  }
`;

export const startGameQuery = gql`
  mutation($gameCode: String!) {
    status: startGame(gameCode: $gameCode)
  }
`;

export const buyinQuery = gql`
  mutation($gameCode: String!, $amount: Float!) {
    status: buyIn(gameCode: $gameCode, amount: $amount) {
      expireSeconds
      approved
    }
  }
`;

export const reloadQuery = gql`
  mutation($gameCode: String!, $amount: Float!) {
    status: reload(gameCode: $gameCode, amount: $amount) {
      expireSeconds
      approved
    }
  }
`;

export const approveQuery = gql`
  mutation(
    $gameCode: String!
    $playerUuid: String!
    $type: ApprovalType!
    $status: ApprovalStatus!
  ) {
    status: approveRequest(
      gameCode: $gameCode
      playerUuid: $playerUuid
      type: $type
      status: $status
    )
  }
`;

export const tableGameStateQuery = gql`
  query($gameCode: String!) {
    game: tableGameState(gameCode: $gameCode) {
      playerUuid
      buyIn
      stack
      status
      buyInStatus
      playingFrom
      waitlistNo
      seatNo
    }
  }
`;

export const myGameStateQuery = gql`
  query($gameCode: String!) {
    game: myGameState(gameCode: $gameCode) {
      playerUuid
      buyIn
      stack
      status
      buyInStatus
      playingFrom
      waitlistNo
      seatNo
    }
  }
`;

export const gameInfoQuery = gql`
  query($gameCode: String!) {
    gameInfo(gameCode: $gameCode) {
      gameCode
      gameID
      audioConfEnabled
      tableStatus
      status
      handNum
      startedAt
      sessionTime
      runningTime
      noHandsWon
      noHandsPlayed
      seatInfo {
        playersInSeats {
          stack
          seatNo
          playerId
        }
      }
    }
  }
`;

export async function configureGame(
  playerId: string,
  clubCode: string,
  gameInput: GameInput
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      gameInput: gameInput,
    },
    mutation: configureGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  const startedGame = resp.data.configuredGame;
  expect(startedGame).not.toBeNull();
  return startedGame;
}

export const takeBreakQuery = gql`
  mutation($gameCode: String!) {
    status: takeBreak(gameCode: $gameCode)
  }
`;

export const sitBackQuery = gql`
  mutation($gameCode: String!) {
    status: sitBack(gameCode: $gameCode)
  }
`;

export const leaveGameQuery = gql`
  mutation($gameCode: String!) {
    status: leaveGame(gameCode: $gameCode)
  }
`;

export const requestSeatChangeQuery = gql`
  mutation($gameCode: String!) {
    date: requestSeatChange(gameCode: $gameCode)
  }
`;

export const seatChangeRequestsQuery = gql`
  query($gameCode: String!) {
    players: seatChangeRequests(gameCode: $gameCode) {
      playerUuid
      name
      status
      seatNo
      sessionTime
      seatChangeRequestedAt
    }
  }
`;

export const confirmSeatChangeQuery = gql`
  mutation($gameCode: String!, $seatNo: Int!) {
    status: confirmSeatChange(gameCode: $gameCode, seatNo: $seatNo)
  }
`;

export const addToWaitingListQuery = gql`
  mutation($gameCode: String!) {
    status: addToWaitingList(gameCode: $gameCode)
  }
`;

export const removeFromWaitingListQuery = gql`
  mutation($gameCode: String!) {
    status: removeFromWaitingList(gameCode: $gameCode)
  }
`;

export const waitingListQuery = gql`
  query($gameCode: String!) {
    status: waitingList(gameCode: $gameCode) {
      playerUuid
      name
      waitingFrom
      status
    }
  }
`;

export const pendingApprovalsForClubQuery = gql`
  query($clubCode: String!) {
    status: pendingApprovalsForClub(clubCode: $clubCode) {
      gameCode
      playerUuid
      name
      approvalType
      amount
      outstandingBalance
    }
  }
`;

export const pendingApprovalsForGameQuery = gql`
  query($gameCode: String!) {
    status: pendingApprovalsForGame(gameCode: $gameCode) {
      gameCode
      playerUuid
      name
      approvalType
      amount
      outstandingBalance
    }
  }
`;

export const endGameQuery = gql`
  mutation($gameCode: String!) {
    status: endGame(gameCode: $gameCode)
  }
`;

export const leaderboardQuery = gql`
  query($clubCode: String!) {
    status: clubLeaderBoard(clubCode: $clubCode) {
      playerName
      playerId
      playerUuid
      gamesPlayed
      handsPlayed
      buyin
      profit
      rakePaid
    }
  }
`;

export async function configureFriendsGame(
  playerId: string,
  gameInput: GameInput
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameInput: gameInput,
    },
    mutation: configureFriendsGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  const startedGame = resp.data.configuredGame;
  expect(startedGame).not.toBeNull();
  return startedGame;
}

export async function getGameById(gameCode: string): Promise<number> {
  const gameClient = getClient(gameCode);
  const resp = await gameClient.query({
    variables: {gameCode: gameCode},
    query: gameByIdQuery,
  });
  return resp.data.game.id;
}

export async function getClubGames(
  playerId: string,
  clubCode: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<Array<any>> {
  const variables: any = {
    clubCode: clubCode,
  };

  if (page) {
    variables.page = {};
    if (page.prev) {
      variables['page']['prev'] = page.prev;
    }
    if (page.next) {
      variables['page']['next'] = page.next;
    }
    if (page.count) {
      variables['page']['count'] = page.count;
    }
  }

  const resp = await getClient(playerId).query({
    variables: variables,
    query: getClubGamesQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.clubGames;
}

export async function joinGame(
  playerId: string,
  gameCode: string,
  seatNo: number
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
      seatNo: seatNo,
    },
    mutation: joinGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function buyin(
  playerId: string,
  gameCode: string,
  amount: number
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
      amount: amount,
    },
    mutation: buyinQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function reload(
  playerId: string,
  gameCode: string,
  amount: number
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
      amount: amount,
    },
    mutation: reloadQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function pendingApprovalsForClub(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
  const variables: any = {
    clubCode: clubCode,
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: pendingApprovalsForClubQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function gameInfo(
  playerId: string,
  gameCode: string
): Promise<any> {
  const variables: any = {
    gameCode: gameCode,
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: gameInfoQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.gameInfo;
}

export async function pendingApprovalsForGame(
  playerId: string,
  gameCode: string
): Promise<Array<any>> {
  const variables: any = {
    gameCode: gameCode,
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: pendingApprovalsForGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function approveRequest(
  hostId: string,
  playerId: string,
  gameCode: string,
  type: string,
  status: string
): Promise<any> {
  const resp = await getClient(hostId).mutate({
    variables: {
      gameCode: gameCode,
      playerUuid: playerId,
      type: type,
      status: status,
    },
    mutation: approveQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function myGameState(playerUuid: string, gameCode: string) {
  const gameClient = getClient(playerUuid);
  const resp = await gameClient.query({
    variables: {gameCode: gameCode},
    query: myGameStateQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.game;
}

export async function tableGameState(playerUuid: string, gameCode: string) {
  const gameClient = getClient(playerUuid);
  const resp = await gameClient.query({
    variables: {gameCode: gameCode},
    query: tableGameStateQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.game;
}

export async function takeBreak(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: takeBreakQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function sitBack(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: sitBackQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function leaveGame(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: leaveGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function confirmSeatChange(
  playerId: string,
  gameCode: string,
  seatNo: number
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
      seatNo: seatNo,
    },
    mutation: confirmSeatChangeQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function seatChangeRequests(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      gameCode: gameCode,
    },
    query: seatChangeRequestsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.players;
}

export async function requestSeatChange(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: requestSeatChangeQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.date;
}

export async function startGame(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: startGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function addToWaitingList(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: addToWaitingListQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function removeFromWaitingList(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: removeFromWaitingListQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function waitingList(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      gameCode: gameCode,
    },
    query: waitingListQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function endGame(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      gameCode: gameCode,
    },
    mutation: endGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}

export async function gameHistory(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      gameCode: gameCode,
    },
    query: gameHistoryByIdQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.gameHistory;
}

export async function gameData(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      gameCode: gameCode,
    },
    query: gameDataByIdQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.game;
}

export async function playersInGameData(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      gameCode: gameCode,
    },
    query: playersInGameByIdQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.playerData;
}

export async function playersGameTrackerData(
  playerId: string,
  gameCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      gameCode: gameCode,
    },
    query: playersGameTrackerByIdQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.playerGameTrackerData;
}

export async function leaderboardData(
  playerId: string,
  clubCode: string
): Promise<any> {
  const resp = await getClient(playerId).query({
    variables: {
      clubCode: clubCode,
    },
    query: leaderboardQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.status;
}
