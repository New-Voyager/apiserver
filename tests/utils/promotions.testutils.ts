import {getClient} from './utils';
import {gql} from 'apollo-boost';
import {getLogger} from '../../src/utils/log';
const logger = getLogger('promotion');

export const createPromotion = gql`
  mutation($clubId: String!, $input: CreatePromotionInput) {
    data: createPromotion(clubId: $clubId, input: $input) {
      id
    }
  }
`;

export const assignPromotion = gql`
  mutation(
    $clubId: String!
    $gameId: String!
    $promotionId: Int!
    $startAt: DateTime
    $endAt: DateTime
  ) {
    data: assignPromotion(
      clubId: $clubId
      gameId: $gameId
      promotionId: $promotionId
      startAt: $startAt
      endAt: $endAt
    )
  }
`;

export const getPromotionsQuery = gql`
  query($clubId: String!) {
    promotion: promotions(clubId: $clubId) {
      id
      bonus
      promotionType
      clubId
      cardRank
    }
  }
`;

export const getAssignedPromotionsQuery = gql`
  query($clubId: String!, $gameId: String!) {
    assignedPromotion: assignedPromotions(clubId: $clubId, gameId: $gameId) {
      gameId
      promotionId
      clubId
      bonus
      endAt
      startAt
      cardRank
      promotionType
    }
  }
`;

export async function getPromotion(
  clubId: string,
  playerId: string
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: getPromotionsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.promotion;
}

export async function getAssignedPromotion(
  clubId: string,
  playerId: string,
  gameId: string
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
    gameId: gameId,
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: getAssignedPromotionsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.assignedPromotion;
}
