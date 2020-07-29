import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';

export const queryClubBalance = gql`
  query($clubId: String!) {
    balance: clubBalance(clubId: $clubId) {
      balance
      updatedAt
    }
  }
`;

export const queryPlayerBalance = gql`
  query($playerId: String!, $clubId: String!) {
    balance: playerBalance(playerId: $playerId, clubId: $clubId) {
      totalBuyins
      totalWinnings
      balance
      notes
      updatedAt
    }
  }
`;

export const queryPlayerTrack = gql`
  query($playerId: String!, $clubId: String!, $gameId: String!) {
    balance: playerGametrack(
      clubId: $clubId
      gameId: $gameId
      playerId: $playerId
    ) {
      buyIn
      stack
      seatNo
      noOfBuyins
      hhRank
      hhHandNum
    }
  }
`;

export const queryClubTrack = gql`
  query($clubId: String!, $gameId: String!) {
    balance: clubGameRake(clubId: $clubId, gameId: $gameId) {
      rake
      promotion
      lastHandNum
    }
  }
`;

export async function getClubBalance(
  playerId: string,
  clubId: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {clubId: clubId},
    query: queryClubBalance,
  });

  return resp.data.balance.balance;
}

export async function getClubPlayerBalance(
  playerId: string,
  clubId: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {clubId: clubId, playerId: playerId},
    query: queryPlayerBalance,
  });

  return resp.data.balance.balance;
}

export async function getPlayerTrack(
  playerId: string,
  clubId: string,
  gameId: string
) {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {playerId: playerId, clubId: clubId, gameId: gameId},
    query: queryPlayerTrack,
  });

  return resp.data.balance.stack;
}

export async function getClubTrack(
  playerId: string,
  clubId: string,
  gameId: string
) {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {clubId: clubId, gameId: gameId},
    query: queryClubTrack,
  });

  return resp.data.balance.rake;
}
