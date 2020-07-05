import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';

export const getSpecificHandHistoryQuery = gql`
  query($clubId: Int!, $gameNum: Int!, $handNum: Int!) {
    handHistory: specificHandHistory(clubId: $clubId, gameNum: $gameNum, handNum: $handNum) {
        pageId,
        clubId,
        gameNum,
        handNum,
        gameType,
        wonAt,
        showDown,
        winningCards,
        winningRank,
        loWinningCards,
        loWinningRank,
        timeStarted,
        timeEnded,
        data,
        totalPot
    }
  }
`;

export const getLastHandHistoryQuery = gql`
  query($clubId: Int!, $gameNum: Int!) {
    handHistory: lastHandHistory(clubId: $clubId, gameNum: $gameNum) {
        pageId,
        clubId,
        gameNum,
        handNum,
        gameType,
        wonAt,
        showDown,
        winningCards,
        winningRank,
        loWinningCards,
        loWinningRank,
        timeStarted,
        timeEnded,
        data,
        totalPot
    }
  }
`;

export const getAllHandHistoryQuery = gql`
  query($clubId: Int!, $gameNum: Int!, $page: PageInput) {
    handHistory: allHandHistory(clubId: $clubId, gameNum: $gameNum, page: $page) {
        pageId,
        clubId,
        gameNum,
        handNum,
        gameType,
        wonAt,
        showDown,
        winningCards,
        winningRank,
        loWinningCards,
        loWinningRank,
        timeStarted,
        timeEnded,
        data,
        totalPot
    }
  }
`;

export async function getSpecificHandHistory(
  playerId: string,
  clubId: number,
  gameNum: number,
  handNum: number
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum,
    handNum: handNum
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: getSpecificHandHistoryQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.handHistory;
}

export async function getLastHandHistory(
  playerId: string,
  clubId: number,
  gameNum: number
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: getLastHandHistoryQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.handHistory;
}

export async function getAllHandHistory(
  playerId: string,
  clubId: number,
  gameNum: number,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum
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
    query: getAllHandHistoryQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.handHistory;
}
