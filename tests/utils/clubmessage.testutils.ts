import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const sendMessageQuery = gql`
  mutation($clubId: String!, $input: ClubMessageInput!) {
    messageId: sendClubMessage(clubId: $clubId, message: $input)
  }
`;

export const getClubMessageQuery = gql`
  query($clubId: String!, $page: PageInput) {
    clubMessage: clubMessages(clubId: $clubId, pageOptions: $page) {
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
  playerId: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<Array<any>> {
  const variables: any = {
    clubId: clubId,
  };
  if (page) {
    variables.page = {};
    if (page.prev) {
      variables['page']['prev'] = page.prev;
    }
    if (page.next) {
      variables['page']['next'] = page.next;
    }
    if (page.count) {
      variables['page']['count'] = page.count;
    }
  }
  const resp = await getClient(playerId).query({
    variables: variables,
    query: getClubMessageQuery,
  });
  expect(resp.errors).toBeUndefined();
  expect(resp.data).not.toBeNull();
  console.log(resp.data);
  return resp.data.clubMessage;
}
