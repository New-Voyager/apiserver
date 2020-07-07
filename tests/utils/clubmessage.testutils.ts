import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const sendMessageQuery = gql`
  mutation($clubId: String!, $input: ClubMessageInput!) {
    messageId: sendClubMessage(clubId: $clubId, message: $input)
  }
`;

export const getClubMessageQuery = gql`
  query($clubId: String!) {
    clubMessage: clubMessages(clubId: $clubId) {
      id
      gameNum
      handNum
      text
      clubId
      giphyLink
      playerTags
      messageType
    }
  }
`;

enum ClubMessageType {
  TEXT,
  HAND,
  GIPHY,
}

interface ClubMessageInputFormat {
  messageType: ClubMessageType;
  text: string;
  gameNum: number;
  handNum: number;
  giphyLink: string;
  playerTags: string;
}

export async function getClubMessage(
  clubId: string,
  playerId: string
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
  };
  const resp = await getClient(playerId).query({
    variables: variables,
    query: getClubMessageQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  console.log(resp.data);
  return resp.data.clubMessage;
}
