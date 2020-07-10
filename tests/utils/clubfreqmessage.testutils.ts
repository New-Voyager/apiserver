import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const saveFreqMessage = gql`
  mutation($input: FavouriteMessageInput!) {
    messageId: saveFreqMessage(message: $input)
  }
`;

export const getClubFavMessageQuery = gql`
  query($clubId: String!) {
    clubFreqMessage: clubFavoriteMessages(clubId: $clubId) {
      id
      clubId
      text
      audioLink
      imageLink
    }
  }
`;

export const getPlayerFavMessageQuery = gql`
  query {
    clubFreqMessage: playerFavoriteMessages {
      id
      playerId
      text
      audioLink
      imageLink
    }
  }
`;

export async function getClubFavMessages(
  playerId: string,
  clubId: string
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: getClubFavMessageQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.clubFreqMessage;
}

export async function getPlayerFavMessages(
  playerId: string
): Promise<Array<any>> {
  const variables: any = {
    playerId: playerId,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: getPlayerFavMessageQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.clubFreqMessage;
}
