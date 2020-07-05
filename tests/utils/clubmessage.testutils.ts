import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';

export const sendMessageQuery = gql`
mutation($clubId: String!, $input: ClubMessageInput!){
    messageId: sendClubMessage(clubId: $clubId, message: $input)
}
`;  
enum ClubMessageType {
    TEXT,
    HAND,
    GIPHY,
    } 

interface  ClubMessageInputFormat {
    messageType: ClubMessageType;
    text: string;
    gameNum: number;
    handNum: number
    giphyLink: string;
    playerTags: string;
}

export async function sendClubMessage(clubId: string, message: ClubMessageInputFormat) {
  const messageInput = {
    messageType: 'TEXT',
    text: "Hi buddy",
    gameNum: 0,
    handNum: 0,
    giphyLink: "test.com",
    playerTags: "1,2,3"

};
    const response = await getClient("123").mutate({
      variables: {
        clubId: "123",
        input: messageInput,
      },
      mutation: sendMessageQuery,
    });

    return response.data.id; 
}
  