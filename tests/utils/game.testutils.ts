import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';
import {GameType} from '../../src/entity/game';

export const startGameQuery = gql`
  mutation($clubId: String!, $gameInput: GameCreateInput!) {
    startedGame: startGame(clubId: $clubId, game: $gameInput) {
      title
      gameId
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
  query($clubId: String!, $page: PageInput) {
    clubGames: clubGames(clubId: $clubId, page: $page) {
      pageId
      gameId
      status
      startedAt
      startedBy
      endedBy
      endedAt
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

export async function startGame(
  playerId: string,
  clubId: string,
  gameInput: GameInput
): Promise<any> {
  const resp = await getClient(playerId).mutate({
    variables: {
      clubId: clubId,
      gameInput: gameInput,
    },
    mutation: startGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  const startedGame = resp.data.startedGame;
  expect(startedGame).not.toBeNull();
  return startedGame;
}
export async function getClubGames(
  playerId: string,
  clubId: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
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
