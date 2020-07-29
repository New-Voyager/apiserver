import {getClient} from './utils';
import {gql} from 'apollo-boost';
import {getLogger} from '../../src/utils/log';
const logger = getLogger('promotion');

export const createPromotion = gql`
  mutation($clubCode: String!, $input: CreatePromotionInput) {
    data: createPromotion(clubCode: $clubCode, input: $input) {
      id
    }
  }
`;

export const assignPromotion = gql`
  mutation(
    $clubCode: String!
    $gameCode: String!
    $promotionId: Int!
    $startAt: DateTime
    $endAt: DateTime
  ) {
    data: assignPromotion(
      clubCode: $clubCode
      gameCode: $gameCode
      promotionId: $promotionId
      startAt: $startAt
      endAt: $endAt
    )
  }
`;

export const getPromotionsQuery = gql`
  query($clubCode: String!) {
    promotion: promotions(clubCode: $clubCode) {
      id
      bonus
      promotionType
      clubCode
      cardRank
    }
  }
`;

export const getAssignedPromotionsQuery = gql`
  query($clubCode: String!, $gameCode: String!) {
    assignedPromotion: assignedPromotions(clubCode: $clubCode, gameCode: $gameCode) {
      gameCode
      promotionId
      clubCode
      bonus
      endAt
      startAt
      cardRank
      promotionType
    }
  }
`;

export async function getPromotion(
  clubCode: string,
  playerId: string
): Promise<Array<any>> {
  const variables: any = {
    clubCode: clubCode,
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
  clubCode: string,
  playerId: string,
  gameCode: string
): Promise<Array<any>> {
  const variables: any = {
    clubCode: clubCode,
    gameCode: gameCode,
  };

  const resp = await getClient(playerId).query({
    variables: variables,
    query: getAssignedPromotionsQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.assignedPromotion;
}
