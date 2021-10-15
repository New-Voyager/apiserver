import {INTERNAL_PORT, resetDatabase} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import { configureGame, createGameServer, joinGame, applyWaitlistOrder, declineWaitlistSeat} from './utils';
import {gameInfo} from '../utils/game.testutils';
import axios from 'axios'
import _ from 'lodash';

describe('waitlist APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('twoPlayersWaitingList', async () => {
    const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;
    const [clubCode, playerId] = await clubutils.createClub(`brady`, `yatzee`);
    await createGameServer('1.99.0.1');
    const resp = await configureGame({clubCode, playerId});
    const gameId = await gameutils.getGameById(resp.data.configuredGame.gameCode);
    const playerId2 = await clubutils.createPlayer('adam', '1243ABC');
    const playerId3 = await clubutils.createPlayer('adam1', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId2);
    await clubutils.playerJoinsClub(clubCode, playerId3);
    await applyWaitlistOrder({
        ownerId: playerId,
        playerIds: [],
        gameCode: resp.data.configuredGame.gameCode,
    });

    await gameutils.addToWaitingList(playerId2, resp.data.configuredGame.gameCode)
    await gameutils.addToWaitingList(playerId3, resp.data.configuredGame.gameCode)


    await gameutils.removeFromWaitingList(playerId3, resp.data.configuredGame.gameCode)
    await joinGame({
    ownerId: playerId2,
    gameCode: resp.data.configuredGame.gameCode,
    seatNo: 1,
    location: {
        lat: 100,
        long: 100,
    },
    });

    await axios.post(`${SERVER_API}/process-pending-updates/gameId/${gameId}`)

    const waitlist = await gameutils.waitingList(playerId, resp.data.configuredGame.gameCode)
    const rawData = await gameInfo(playerId2, resp.data.configuredGame.gameCode)

    expect(waitlist).toEqual([])
    expect(rawData.seatInfo.seats[0].playerUuid).toEqual(playerId2)
});

})