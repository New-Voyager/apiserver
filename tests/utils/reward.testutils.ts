import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const createReward = gql`
  mutation($clubCode: String!, $input: RewardInput!) {
    rewardId: createReward(clubCode: $clubCode, input: $input)
  }
`;

export const getRewardsQuery = gql`
  query($clubCode: String!) {
    rewards: rewards(clubCode: $clubCode) {
      id
      name
      type
      amount
      schedule
      minRank
      startHour
      endHour
    }
  }
`;

export const highHandsByGameQuery = gql`
  query($gameCode: String!) {
    logdata: highHandsByGame(gameCode: $gameCode) {
      gameCode
      handNum
      playerUuid
      playerName
      playerCards
      boardCards
      highHand
      rank
      handTime
    }
  }
`;

export const highHandsByRewardQuery = gql`
  query($gameCode: String!, $rewardId: String!) {
    logdata: highHandsByReward(gameCode: $gameCode, rewardId: $rewardId) {
      gameCode
      handNum
      playerUuid
      playerName
      playerCards
      boardCards
      highHand
      rank
      handTime
    }
  }
`;

export const highHandWinnersQuery = gql`
  query($gameCode: String!, $rewardId: String!) {
    winnerdata: highHandWinners(gameCode: $gameCode, rewardId: $rewardId) {
      gameCode
      handNum
      playerUuid
      playerName
      playerCards
      boardCards
      highHand
      rank
      handTime
    }
  }
`;

export async function getRewards(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
  const variables: any = {
    playerId: playerId,
    clubCode: clubCode,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: getRewardsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  console.log(resp.data);
  return resp.data.rewards;
}

export async function getlogDatabyGame(
  playerId: string,
  gameCode: string
): Promise<Array<any>> {
  const variables: any = {
    playerId: playerId,
    gameCode: gameCode,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: highHandsByGameQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.logdata;
}

export async function getlogDatabyReward(
  playerId: string,
  gameCode: string,
  rewardId: string
): Promise<Array<any>> {
  const variables: any = {
    playerId: playerId,
    gameCode: gameCode,
    rewardId: rewardId,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: highHandsByRewardQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.logdata;
}

export async function getHighHandWinners(
  playerId: string,
  gameCode: string,
  rewardId: string
): Promise<Array<any>> {
  const variables: any = {
    playerId: playerId,
    gameCode: gameCode,
    rewardId: rewardId,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: highHandWinnersQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.winnerdata;
}
