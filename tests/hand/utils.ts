import { gql } from 'apollo-server-express';
import { getClient } from '../utils/utils';

const bookmarkedHandsByGame = gql`
  query ($gameCode: String!) {
    bookmarkedHandsByGame (gameCode: $gameCode) {
      id
  gameCode
  handNum
  data
  updatedAt
    }
  }

`

const bookmarkedHands = gql`
query {
  bookmarkedHands {
    id
  gameCode
  handNum
  data
  updatedAt
  }
}
  
`

export const getBookmarkedHandsByGame = async ({ ownerId, gameCode }) => {
  const resp = await getClient(ownerId).query({
    variables: {
      gameCode: gameCode,
      seatChange: true,
    },
    query: bookmarkedHandsByGame,
  });

  return resp.data;
}

export const getBookmarkedHands = async ({ ownerId }) => {
  const resp = await getClient(ownerId).query({
    variables: {
      seatChange: true,
    },
    query: bookmarkedHands,
  });

  return resp.data;
}