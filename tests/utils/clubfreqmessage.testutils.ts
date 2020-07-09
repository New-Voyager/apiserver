import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const saveFreqMessage = gql`
  mutation($input: FavouriteMessageInput!) {
    messageId: saveFreqMessage(message: $input)
  }
`;

export const getClubFreqMessageQuery = gql`
  query($clubId: String!, $playerId: String!) {
    clubFreqMessage: getFreqMessages(clubId: $clubId, playerId: $playerId) {
      id
      clubId
      playerId
      text
      audioLink
      imageLink
    }
  }
`;

export async function getFreqMessages(
  clubId: string,
  playerId: string
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
    playerId: playerId,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: getClubFreqMessageQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  return resp.data.clubFreqMessage;
}
