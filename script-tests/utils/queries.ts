import {gql} from 'apollo-boost';

export const createPlayer = gql`
  mutation($input: PlayerCreateInput!) {
    playerId: createPlayer(player: $input)
  }
`;

export const getPlayer = gql`
  query {
    player: playerById {
      uuid
      id
      name
      lastActiveTime
    }
  }
`;

export const createClub = gql`
  mutation($input: ClubCreateInput!) {
    clubCode: createClub(club: $input)
  }
`;

export const getClub = gql`
  query($clubCode: String!) {
    club: clubById(clubCode: $clubCode) {
      id
    }
  }
`;

export const joinClub = gql`
  mutation($clubCode: String!) {
    status: joinClub(clubCode: $clubCode)
  }
`;

export const clubMemberStatus = gql`
  query($clubCode: String!, $playerUuid: String!) {
    status: clubMembers(clubCode: $clubCode, filter: {playerId: $playerUuid}) {
      status
    }
  }
`;

export const approveClubMember = gql`
  mutation($clubCode: String!, $playerUuid: String!) {
    status: approveMember(clubCode: $clubCode, playerUuid: $playerUuid)
  }
`;

export const rejectClubMember = gql`
  mutation($clubCode: String!, $playerUuid: String!) {
    status: rejectMember(clubCode: $clubCode, playerUuid: $playerUuid)
  }
`;

export const createReward = gql`
  mutation($clubCode: String!, $input: RewardInput!) {
    rewardId: createReward(clubCode: $clubCode, input: $input)
  }
`;

export const configureGame = gql`
  mutation($clubCode: String!, $gameInput: GameCreateInput!) {
    configuredGame: configureGame(clubCode: $clubCode, game: $gameInput) {
      gameCode
    }
  }
`;

export const getGame = gql`
  query($gameCode: String!) {
    game: gameById(gameCode: $gameCode) {
      id
    }
  }
`;

export const joinGame = gql`
  mutation($gameCode: String!, $seatNo: Int!) {
    joinGame(gameCode: $gameCode, seatNo: $seatNo)
  }
`;

export const buyIn = gql`
  mutation($gameCode: String!, $amount: Float!) {
    buyIn(gameCode: $gameCode, amount: $amount) {
      expireSeconds
      approved
    }
  }
`;

export const clubGameRake = gql`
  query($gameCode: String!) {
    balance: rakeCollected(gameCode: $gameCode)
  }
`;

export const playersInSeats = gql`
  query($gameCode: String!) {
    seatInfo: gameInfo(gameCode: $gameCode) {
      seatInfo {
        playersInSeats {
          seatNo
          playerUuid
          name
          buyIn
          stack
          status
        }
      }
    }
  }
`;

export const startGame = gql`
  mutation($gameCode: String!) {
    startGame(gameCode: $gameCode)
  }
`;

export const endGame = gql`
  mutation($gameCode: String!) {
    GameStatus: endGame(gameCode: $gameCode)
  }
`;

export const clubBalance = gql`
  query($clubCode: String!) {
    balance: clubBalance(clubCode: $clubCode) {
      balance
      updatedAt
    }
  }
`;

export const playerBalance = gql`
  query($playerId: String!, $clubCode: String!) {
    balance: playerBalance(playerId: $playerId, clubCode: $clubCode) {
      totalBuyins
      totalWinnings
      balance
      updatedAt
    }
  }
`;

export const sendMessage = gql`
  mutation($clubCode: String!, $text: String) {
    resp: sendClubMessage(
      clubCode: $clubCode
      message: {messageType: TEXT, text: $text}
    )
  }
`;

export const reload = gql`
  mutation($gameCode: String!, $amount: Float!) {
    resp: reload(gameCode: $gameCode, amount: $amount) {
      expireSeconds
      approved
    }
  }
`;

export const updateClubMember = gql`
  mutation(
    $clubCode: String!
    $playerUuid: String!
    $update: ClubMemberUpdateInput!
  ) {
    status: updateClubMember(
      clubCode: $clubCode
      playerUuid: $playerUuid
      update: $update
    )
  }
`;

export const liveGames = gql`
  query($clubCode: String!) {
    games: liveGames(clubCode: $clubCode) {
      title
      clubName
      gameType
      tableCount
    }
  }
`;

export const requestSeatChange = gql`
  mutation($gameCode: String!) {
    date: requestSeatChange(gameCode: $gameCode)
  }
`;

export const seatChangeRequests = gql`
  query($gameCode: String!) {
    players: seatChangeRequests(gameCode: $gameCode) {
      playerUuid
      name
      status
      seatNo
      sessionTime
      seatChangeRequestedAt
    }
  }
`;

export const confirmSeatChange = gql`
  mutation($gameCode: String!, $seatNo: Int!) {
    status: confirmSeatChange(gameCode: $gameCode, seatNo: $seatNo)
  }
`;

export const addToWaitingList = gql`
  mutation($gameCode: String!) {
    status: addToWaitingList(gameCode: $gameCode)
  }
`;

export const removeFromWaitingList = gql`
  mutation($gameCode: String!) {
    status: removeFromWaitingList(gameCode: $gameCode)
  }
`;

export const waitingList = gql`
  query($gameCode: String!) {
    players: waitingList(gameCode: $gameCode) {
      playerUuid
      name
      waitingFrom
      status
      waitlistNum
    }
  }
`;

export const leaveGame = gql`
  mutation($gameCode: String!) {
    status: leaveGame(gameCode: $gameCode)
  }
`;
