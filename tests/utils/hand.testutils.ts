import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const getSpecificHandHistoryQuery = gql`
  query($clubCode: String!, $gameCode: String!, $handNum: String!) {
    handHistory: specificHandHistory(
      clubCode: $clubCode
      gameCode: $gameCode
      handNum: $handNum
    ) {
      pageId
      gameId
      handNum
      gameType
      wonAt
      showDown
      winningCards
      winningRank
      loWinningCards
      loWinningRank
      timeStarted
      timeEnded
      data
      totalPot
    }
  }
`;

export const getLastHandHistoryQuery = gql`
  query($clubCode: String!, $gameCode: String!) {
    handHistory: lastHandHistory(clubCode: $clubCode, gameCode: $gameCode) {
      pageId
      gameId
      handNum
      gameType
      wonAt
      showDown
      winningCards
      winningRank
      loWinningCards
      loWinningRank
      timeStarted
      timeEnded
      data
      totalPot
    }
  }
`;

export const getAllHandHistoryQuery = gql`
  query($clubCode: String!, $gameCode: String!, $page: PageInput) {
    handHistory: allHandHistory(
      clubCode: $clubCode
      gameCode: $gameCode
      page: $page
    ) {
      pageId
      gameId
      handNum
      gameType
      wonAt
      showDown
      winningCards
      winningRank
      loWinningCards
      loWinningRank
      timeStarted
      timeEnded
      data
      totalPot
    }
  }
`;

export const getMyWinningHandsQuery = gql`
  query($clubCode: String!, $gameCode: String!, $page: PageInput) {
    handWinners: myWinningHands(
      clubCode: $clubCode
      gameCode: $gameCode
      page: $page
    ) {
      pageId
      gameId
      handNum
      winningCards
      winningRank
      pot
      isHigh
      playerId
    }
  }
`;

export const playerByIdQuery = gql`
  query {
    player: playerById {
      id
      name
      lastActiveTime
    }
  }
`;

export const getStarredHandsQuery = gql`
  query {
    hands: allStarredHands {
      gameId
      handNum
      playerId
      handHistory {
        data
      }
    }
  }
`;

export const saveStarredHandMutation = gql`
  mutation($clubCode: String!, $gameCode: String!, $handNum: String!) {
    saved: saveStarredHand(
      clubCode: $clubCode
      gameCode: $gameCode
      handNum: $handNum
    )
  }
`;

export async function getSpecificHandHistory(
  playerId: string,
  clubCode: string,
  gameCode: string,
  handNum: string
): Promise<any> {
  const variables: any = {
    clubCode: clubCode,
    gameCode: gameCode,
    handNum: handNum,
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
  clubCode: string,
  gameCode: string
): Promise<any> {
  const variables: any = {
    clubCode: clubCode,
    gameCode: gameCode,
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
  clubCode: string,
  gameCode: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
    clubCode: clubCode,
    gameCode: gameCode,
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

export async function getMyWinningHands(
  playerId: string,
  clubCode: string,
  gameCode: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
    clubCode: clubCode,
    gameCode: gameCode,
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
    query: getMyWinningHandsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.handWinners;
}

export async function getPlayerById(playerId: string): Promise<number> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    query: playerByIdQuery,
  });
  return resp.data.player.id;
}

export async function saveStarredHand(
  clubCode: string,
  gameCode: string,
  playerId: string,
  handNum: string
) {
  const client = getClient(playerId);
  const variables = {
    clubCode: clubCode,
    gameCode: gameCode,
    handNum: handNum,
  };
  const resp = await client.mutate({
    variables: variables,
    mutation: saveStarredHandMutation,
  });
  return resp.data.saved;
}

export async function getStarredHands(playerId: string): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    query: getStarredHandsQuery,
  });
  return resp.data.hands;
}
