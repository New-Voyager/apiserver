import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const getSpecificHandHistoryQuery = gql`
  query($clubId: String!, $gameNum: String!, $handNum: String!) {
    handHistory: specificHandHistory(
      clubId: $clubId
      gameNum: $gameNum
      handNum: $handNum
    ) {
      pageId
      clubId
      gameNum
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
  query($clubId: String!, $gameNum: String!) {
    handHistory: lastHandHistory(clubId: $clubId, gameNum: $gameNum) {
      pageId
      clubId
      gameNum
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
  query($clubId: String!, $gameNum: String!, $page: PageInput) {
    handHistory: allHandHistory(
      clubId: $clubId
      gameNum: $gameNum
      page: $page
    ) {
      pageId
      clubId
      gameNum
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
  query($clubId: String!, $gameNum: String!, $page: PageInput) {
    handWinners: myWinningHands(
      clubId: $clubId
      gameNum: $gameNum
      page: $page
    ) {
      pageId
      clubId
      gameNum
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
      clubId
      gameNum
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

export const saveStarredHandMutation = gql`
  mutation($clubId: String!, $gameNum: String!, $handNum: String!) {
    saved: saveStarredHand(
      clubId: $clubId
      gameNum: $gameNum
      handNum: $handNum
    )
  }
`;

export async function getSpecificHandHistory(
  playerId: string,
  clubId: string,
  gameNum: string,
  handNum: string
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum,
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
  clubId: string,
  gameNum: string
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum,
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
  clubId: string,
  gameNum: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum,
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
  clubId: string,
  gameNum: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
    clubId: clubId,
    gameNum: gameNum,
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
  clubId: string,
  gameNum: string,
  playerId: string,
  handNum: string
) {
  const client = getClient(playerId);
  const variables = {
    clubId: clubId,
    gameNum: gameNum,
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
