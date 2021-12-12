import {moveToNextHand, processPendingUpdates, resetDatabase} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import * as gameutils from '../utils/game.testutils';
import { buyIn, createGameServer, reload, startGame } from '../game/utils';
import _ from 'lodash';


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
  buyInLimit: 'BUYIN_CREDIT_LIMIT',
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 50,
  buyInMax: 400,
  actionTime: 30,
  muckLosingHand: true,
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
};

describe('buyin Credit Limit APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('credit limit', async () => {
    const [clubCode, ownerId] = await clubutils.createClub('owner', 'buyin');

    // 4 players in the club
    // each player in the club has 100 chips credit limit
    // create a new game with buyin limit set to credit limit
    // each player requests buyin for 50, should be auto approved
    // then player1 requests another buyin for  50, should be approved
    // then player2 requests another buyin for 60, should not be approved
    // then player3 requests a buyin for 100, the host approves the credit limit

    const player1 = await clubutils.createPlayer('player1', 'player1');
    await clubutils.playerJoinsClub(clubCode, player1);
    await clubutils.approvePlayer(clubCode, ownerId, player1);

    const player2 = await clubutils.createPlayer('player2', 'player2');
    await clubutils.playerJoinsClub(clubCode, player2);
    await clubutils.approvePlayer(clubCode, ownerId, player2);

    const player3 = await clubutils.createPlayer('player3', 'player3');
    await clubutils.playerJoinsClub(clubCode, player3);
    await clubutils.approvePlayer(clubCode, ownerId, player3);

    // enable credit tracking
    await clubutils.setTrackCredit(clubCode, ownerId, true);

    // set credit limit
    await clubutils.setCreditLimit(clubCode, ownerId, ownerId, 100);
    await clubutils.setCreditLimit(clubCode, ownerId, player1, 100);
    await clubutils.setCreditLimit(clubCode, ownerId, player2, 100);
    await clubutils.setCreditLimit(clubCode, ownerId, player3, 100);
    await createGameServer('1.99.0.1');

    const game = await gameutils.configureGame(ownerId, clubCode, holdemGameInput);
    await gameutils.joinGame(player1, game.gameCode, 1);
    await gameutils.joinGame(player2, game.gameCode, 2);
    await gameutils.joinGame(player3, game.gameCode, 3);
    await gameutils.joinGame(ownerId, game.gameCode, 4);

    let resp = await buyIn({ownerId: player1, gameCode: game.gameCode, amount: 50});
    console.log(JSON.stringify(resp));
    await buyIn({ownerId: ownerId, gameCode: game.gameCode, amount: 50});
    await buyIn({ownerId: player2, gameCode: game.gameCode, amount: 50});
    await buyIn({ownerId: player3, gameCode: game.gameCode, amount: 50});

    resp = await buyIn({ownerId: player1, gameCode: game.gameCode, amount: 100});
    let status = resp.status;
    expect(status.approved).toBeFalsy();
    expect(status.insufficientCredits).toBeTruthy();
    expect(status.status).toEqual('PLAYING');

    resp = await reload({playerId: player1, gameCode: game.gameCode, amount: 100});
    status = resp.status;
    expect(status.approved).toBeFalsy();
    expect(status.availableCredits).toEqual(50);
    expect(status.insufficientCredits).toBeTruthy();
    expect(status.status).toEqual('PLAYING');

    resp = await reload({playerId: player1, gameCode: game.gameCode, amount: 20});
    status = resp.status;
    expect(status.approved).toBeTruthy();
    expect(status.appliedNextHand).toBeFalsy();
    expect(status.status).toEqual('PLAYING');
   
    // start the game
    const data = await startGame({
      ownerId: ownerId,
      gameCode: game.gameCode,
    });

    expect(data.status).toEqual('ACTIVE');  
    let gameInfo = await gameutils.gameInfo(ownerId, game.gameCode);
    expect(gameInfo.tableStatus).toEqual('GAME_RUNNING');
    console.log(JSON.stringify(gameInfo));
    let seats = _.keyBy(gameInfo.seatInfo.playersInSeats, 'seatNo');
    expect(seats[1].stack).toEqual(70);
    expect(seats[2].stack).toEqual(50);
    expect(seats[3].stack).toEqual(50);
    expect(seats[4].stack).toEqual(50);

    // reload stack
    resp = await reload({playerId: player1, gameCode: game.gameCode, amount: 20});
    status = resp.status;
    expect(status.approved).toBeTruthy();
    expect(status.appliedNextHand).toBeTruthy();
    expect(status.status).toEqual('PLAYING');

    gameInfo = await gameutils.gameInfo(ownerId, game.gameCode);
    console.log(JSON.stringify(gameInfo));
    seats = _.keyBy(gameInfo.seatInfo.playersInSeats, 'seatNo');
    expect(seats[1].stack).toEqual(70);
    expect(seats[2].stack).toEqual(50);
    expect(seats[3].stack).toEqual(50);
    expect(seats[4].stack).toEqual(50);

    // move to next hand
    await processPendingUpdates(gameInfo.gameID);
    await moveToNextHand(0, gameInfo.gameCode, gameInfo.gameID);

    gameInfo = await gameutils.gameInfo(ownerId, gameInfo.gameCode);
    console.log(JSON.stringify(gameInfo));
    seats = _.keyBy(gameInfo.seatInfo.playersInSeats, 'seatNo');
    expect(seats[1].stack).toEqual(90);
    expect(seats[2].stack).toEqual(50);
    expect(seats[3].stack).toEqual(50);
    expect(seats[4].stack).toEqual(50);
    
    // tried to reload another 20 chips
    resp = await reload({playerId: player1, gameCode: game.gameCode, amount: 20});
    status = resp.status;
    expect(status.approved).toBeFalsy();    

    // tried to reload another 10 chips
    resp = await reload({playerId: player1, gameCode: game.gameCode, amount: 10});
    status = resp.status;
    expect(status.approved).toBeTruthy();    
    expect(status.appliedNextHand).toBeTruthy();

    gameInfo = await gameutils.gameInfo(ownerId, gameInfo.gameCode);
    console.log(JSON.stringify(gameInfo));
    seats = _.keyBy(gameInfo.seatInfo.playersInSeats, 'seatNo');
    expect(seats[1].stack).toEqual(90);
    
    // move to next hand
    await processPendingUpdates(gameInfo.gameID);
    await moveToNextHand(0, gameInfo.gameCode, gameInfo.gameID);
    gameInfo = await gameutils.gameInfo(ownerId, gameInfo.gameCode);
    console.log(JSON.stringify(gameInfo));
    seats = _.keyBy(gameInfo.seatInfo.playersInSeats, 'seatNo');
    expect(seats[1].stack).toEqual(100);
  });
});
