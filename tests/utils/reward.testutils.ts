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
