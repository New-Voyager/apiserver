import {getClient} from './utils';
import {gql} from 'apollo-boost';
import {getLogger} from '../../src/utils/log';
const logger = getLogger('clubmessage');

export const sendMessageQuery = gql`
  mutation($clubCode: String!, $input: ClubMessageInput!) {
    messageId: sendClubMessage(clubCode: $clubCode, message: $input)
  }
`;

export const getClubMessageQuery = gql`
  query($clubCode: String!, $page: PageInput) {
    clubMessage: clubMessages(clubCode: $clubCode, pageOptions: $page) {
      id
      gameNum
      handNum
      text
      clubCode
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
  clubCode: string,
  playerId: string,
  page?: {prev?: number; next?: number; count?: number}
): Promise<Array<any>> {
  const variables: any = {
    clubCode: clubCode,
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
  logger.debug(resp.data);
  return resp.data.clubMessage;
}
