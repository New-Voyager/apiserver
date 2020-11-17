import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';

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

export const buyinQuery = gql`
  mutation($gameCode: String!, $amount: Float!) {
    status: buyIn(gameCode: $gameCode, amount: $amount)
  }
`;

export const approveBuyInQuery = gql`
  mutation($gameCode: String!, $playerUuid: String!, $amount: Float!) {
    status: approveBuyIn(
      gameCode: $gameCode
      playerUuid: $playerUuid
      amount: $amount
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

export async function approveBuyIn(
  hostId: string,
  playerId: string,
  gameCode: string,
  amount: number
): Promise<any> {
  const resp = await getClient(hostId).mutate({
    variables: {
      gameCode: gameCode,
      playerUuid: playerId,
      amount: amount,
    },
    mutation: approveBuyInQuery,
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
