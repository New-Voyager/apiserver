import {resetDatabase, getClient} from '../../tests/utils/utils';
import {gql} from 'apollo-boost';

export const queryClubBalance = gql`
  query($clubCode: String!) {
    balance: clubBalance(clubCode: $clubCode) {
      balance
      updatedAt
    }
  }
`;

export const queryPlayerBalance = gql`
  query($playerId: String!, $clubCode: String!) {
    balance: playerBalance(playerId: $playerId, clubCode: $clubCode) {
      totalBuyins
      totalWinnings
      balance
      notes
      updatedAt
    }
  }
`;

// export const queryPlayerTrack = gql`
//   query($playerId: String!, $clubCode: String!, $gameCode: String!) {
//     balance: playerGametrack(
//       clubCode: $clubCode
//       gameCode: $gameCode
//       playerId: $playerId
//     ) {
//       buyIn
//       stack
//       seatNo
//       noOfBuyins
//       hhRank
//       hhHandNum
//     }
//   }
// `;

// export const queryClubTrack = gql`
//   query($clubCode: String!, $gameCode: String!) {
//     balance: clubGameRake(clubCode: $clubCode, gameCode: $gameCode) {
//       rake
//       promotion
//       lastHandNum
//     }
//   }
// `;

export async function getClubBalance(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {clubCode: clubCode},
    query: queryClubBalance,
  });

  return resp.data.balance.balance;
}

export async function getClubPlayerBalance(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    variables: {clubCode: clubCode, playerId: playerId},
    query: queryPlayerBalance,
  });

  return resp.data.balance.balance;
}

// export async function getPlayerTrack(
//   playerId: string,
//   clubCode: string,
//   gameCode: string
// ) {
//   const playerClient = getClient(playerId);
//   const resp = await playerClient.query({
//     variables: {playerId: playerId, clubCode: clubCode, gameCode: gameCode},
//     query: queryPlayerTrack,
//   });

//   return resp.data.balance.stack;
// }

// export async function getClubTrack(
//   playerId: string,
//   clubCode: string,
//   gameCode: string
// ) {
//   const playerClient = getClient(playerId);
//   const resp = await playerClient.query({
//     variables: {clubCode: clubCode, gameCode: gameCode},
//     query: queryClubTrack,
//   });

//   return resp.data.balance.rake;
// }
