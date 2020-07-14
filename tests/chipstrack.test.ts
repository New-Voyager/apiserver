import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import * as handutils from './utils/hand.testutils';
import * as gameutils from './utils/game.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('gameserver');

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

const holdemGameInput = {
  gameType: 'HOLDEM',
  title: 'Friday game',
  smallBlind: 1.0,
  bigBlind: 2.0,
  straddleBet: 4.0,
  utgStraddleAllowed: true,
  buttonStraddleAllowed: false,
  minPlayers: 3,
  maxPlayers: 9,
  gameLength: 60,
  buyInApproval: true,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistSupported: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
};

describe('Player Chips tracking APIs', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Create a player chips tracker when player sits in', async () => {
    logger.debug('Creating a player chips tracker');
    const gameServer1 = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    let game, resp;

    game = await gameutils.startGame(playerId, clubId, holdemGameInput);

    const playerID = await handutils.getPlayerById(playerId);
    const clubID = await clubutils.getClubById(clubId);
    const gameID = await gameutils.getGameById(game.gameId);

    const messageInput = {
      clubId: clubID,
      playerId: playerID,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 5,
    };

    try {
      resp = await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    } catch (err) {
      console.error(JSON.stringify(err));
    }
    expect(resp.status).toBe(200);
    const id = resp.data.id;
    expect(id).not.toBe(null);
    expect(id).not.toBe(undefined);
  });
});
