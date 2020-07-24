import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';

export const queryClubBalance = gql`
  query($clubId: Int!) {
    balance: clubBalance(clubId: $clubId) {
      balance
      updatedAt
    }
  }
`;

export const queryPlayerBalance = gql`
  query($playerId: Int!, $clubId: Int!) {
    balance: playerBalance(playerId: $playerId, clubId: $clubId) {
      totalBuyins
      totalWinnings
      balance
      notes
      updatedAt
    }
  }
`;

export async function getClubBalance(
  playerId: string,
  clubId: number
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
  clubId: number,
  playerID: number
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {clubId: clubId, playerId: playerID},
    query: queryPlayerBalance,
  });

  return resp.data.balance.balance;
}
