import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const getSpecificHandHistoryQuery = gql`
  query($gameCode: String!, $handNum: String!) {
    handHistory: specificHandHistory(gameCode: $gameCode, handNum: $handNum) {
      pageId
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
  query($gameCode: String!) {
    handHistory: lastHandHistory(gameCode: $gameCode) {
      pageId
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
  query($gameCode: String!, $page: PageInput) {
    handHistory: allHandHistory(gameCode: $gameCode, page: $page) {
      pageId
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
  query($gameCode: String!, $page: PageInput) {
    handWinners: myWinningHands(gameCode: $gameCode, page: $page) {
      pageId
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
  mutation($gameCode: String!, $handNum: String!) {
    saved: saveStarredHand(gameCode: $gameCode, handNum: $handNum)
  }
`;

export const shareHand = gql`
  mutation($gameCode: String!, $handNum: Int!, $clubCode: String!) {
    status: shareHand(
      gameCode: $gameCode
      handNum: $handNum
      clubCode: $clubCode
    )
  }
`;

export const bookmarkHand = gql`
  mutation($gameCode: String!, $handNum: Int!) {
    status: bookmarkHand(gameCode: $gameCode, handNum: $handNum)
  }
`;

export const bookmarkedHands = gql`
  query {
    data: bookmarkedHands {
      id
      savedBy {
        name
        uuid
      }
      gameCode
      handNum
      data
      updatedAt
    }
  }
`;

export const sharedHand = gql`
  query($clubCode: String!, $id: Int!) {
    data: sharedHand(clubCode: $clubCode, id: $id) {
      id
      sharedBy {
        name
        uuid
      }
      sharedTo {
        name
        clubCode
      }
      gameCode
      handNum
      data
      updatedAt
    }
  }
`;

export const sharedHands = gql`
  query($clubCode: String!) {
    data: sharedHands(clubCode: $clubCode) {
      id
      sharedBy {
        name
        uuid
      }
      sharedTo {
        name
        clubCode
      }
      gameCode
      handNum
      data
      updatedAt
    }
  }
`;

export async function getSpecificHandHistory(
  playerId: string,
  gameCode: string,
  handNum: string
): Promise<any> {
  const variables: any = {
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
  gameCode: string
): Promise<any> {
  const variables: any = {
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
  gameCode: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
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
  gameCode: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<any> {
  const variables: any = {
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
  gameCode: string,
  playerId: string,
  handNum: string
) {
  const client = getClient(playerId);
  const variables = {
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

export async function saveSharedHand(
  gameCode: string,
  playerId: string,
  handNum: number,
  clubCode: string
) {
  const client = getClient(playerId);
  const variables = {
    gameCode: gameCode,
    handNum: handNum,
    clubCode: clubCode,
  };
  const resp = await client.mutate({
    variables: variables,
    mutation: shareHand,
  });
  return resp.data.status;
}

export async function saveBookmarkHand(
  gameCode: string,
  playerId: string,
  handNum: number
) {
  const client = getClient(playerId);
  const variables = {
    gameCode: gameCode,
    handNum: handNum,
  };
  const resp = await client.mutate({
    variables: variables,
    mutation: bookmarkHand,
  });
  return resp.data.status;
}

export async function getBookmarkedHands(
  playerId: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    query: bookmarkedHands,
  });
  return resp.data.data;
}

export async function getsharedHands(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const variables = {
    clubCode: clubCode,
  };
  const resp = await playerClient.query({
    variables: variables,
    query: sharedHands,
  });
  return resp.data.data;
}

export async function getsharedHand(
  playerId: string,
  clubCode: string,
  id: number
): Promise<any> {
  const playerClient = getClient(playerId);
  const variables = {
    clubCode: clubCode,
    id: id,
  };
  const resp = await playerClient.query({
    variables: variables,
    query: sharedHand,
  });
  return resp.data.data;
}
