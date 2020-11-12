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
