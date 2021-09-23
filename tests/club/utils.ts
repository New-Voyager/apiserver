import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const clubGamesQuery = gql`
  query($clubCode: String!) {
    clubGames(clubCode: $clubCode) {
      title
    }
  }
`;

export const getClubGames = async ({ownerId, clubCode}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: clubGamesQuery,
  });
  return resp.data;
};
