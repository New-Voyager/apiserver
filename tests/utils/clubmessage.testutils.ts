import {getClient} from './utils';
import {gql} from 'apollo-boost';

export const sendMessageQuery = gql`
  mutation($clubId: String!, $input: ClubMessageInput!) {
    messageId: sendClubMessage(clubId: $clubId, message: $input)
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

export async function sendClubMessage(
  clubId: string,
  message: ClubMessageInputFormat
) {
  const response = await getClient(
    '3e15e3c2-f14e-43d1-8362-f22e27798706'
  ).mutate({
    variables: {
      clubId: clubId,
      input: message,
    },
    mutation: sendMessageQuery,
  });

  return response.data.id;
}
