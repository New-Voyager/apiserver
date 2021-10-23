import * as crypto from 'crypto';
import {v4 as uuidv4} from 'uuid';
import {In, Repository, EntityManager, Not} from 'typeorm';
import {
  gameLogPrefix,
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameSettings,
} from '@src/entity/game/game';
import {
  GameType,
  GameStatus,
  PlayerStatus,
  TableStatus,
  SeatStatus,
  GameEndReason,
} from '@src/entity/types';
import {GameServer} from '@src/entity/game/gameserver';
import {errToLogString, getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {getGameCodeForClub, getGameCodeForPlayer} from '@src/utils/uniqueid';
import {publishNewGame, resumeGame, endGame} from '@src/gameserver';
import {startTimer, cancelTimer} from '@src/timer';
import {fixQuery, getDistanceInMeters} from '@src/utils';
import {WaitListMgmt} from './waitlist';
import {Reward} from '@src/entity/player/reward';
import {DEALER_CHOICE_TIMEOUT} from './types';
import {Cache} from '@src/cache/index';
import {StatsRepository} from './stats';
import {utcTime} from '@src/utils';
import _ from 'lodash';
import {HandHistory} from '@src/entity/history/hand';
import {Player, PlayerNotes} from '@src/entity/player/player';
import {Club, ClubMember} from '@src/entity/player/club';
import {PlayerGameStats} from '@src/entity/history/stats';
import {HistoryRepository} from './history';
import {GameHistory} from '@src/entity/history/game';
import {
  getGameConnection,
  getGameManager,
  getGameRepository,
  getHistoryRepository,
  getUserConnection,
  getUserRepository,
} from '.';
import {GameReward, GameRewardTracking} from '@src/entity/game/reward';
import {ClubRepository} from './club';
import {LocationCheck} from './locationcheck';
import {Nats} from '@src/nats';
import {GameSettingsRepository} from './gamesettings';
import {PlayersInGameRepository} from './playersingame';
import {GameUpdatesRepository} from './gameupdates';
import {GameServerRepository} from './gameserver';
import {PlayersInGame} from '@src/entity/history/player';
import {schedulePostProcessing} from '@src/scheduler';
import {notifyScheduler} from '@src/server';
import {NextHandUpdatesRepository} from './nexthand_update';
import {processPendingUpdates} from './pendingupdates';
import {AppCoinRepository} from './appcoin';
const logger = getLogger('repositories::game');

class GameRepositoryImpl {
  private notifyGameServer: boolean;
  constructor() {
    this.notifyGameServer = false;
    if (process.env.NOTIFY_GAME_SERVER === '0') {
      this.notifyGameServer = false;
    }
  }

  public async createPrivateGame(
    club: Club | null,
    player: Player,
    input: any,
    template = false
  ): Promise<PokerGame> {
    const useGameServer = true;

    // create the game
    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];

    // validate data
    const minActionTime = 2;
    if (!input.actionTime || input.actionTime < minActionTime) {
      throw new Error(`actionTime must be >= ${minActionTime}`);
    }

    if (gameType === GameType.DEALER_CHOICE) {
      if (
        input.dealerChoiceGames === null ||
        input.dealerChoiceGames.length === 0
      ) {
        throw new Error('dealerChoiceGames must be specified');
      }

      const dealerChoiceGames = input.dealerChoiceGames.toString();
      input['dealerChoiceGames'] = dealerChoiceGames;
      input['dealerChoiceOrbit'] = input.dealerChoiceOrbit;
    } else if (gameType === GameType.ROE) {
      if (input.roeGames === null || input.roeGames.length === 0) {
        throw new Error('roeGames must be specified');
      }
      const roeGames = input.roeGames.toString();
      input['roeGames'] = roeGames;
    }
    const game: PokerGame = {...input} as PokerGame;
    game.gameType = gameType;
    game.isTemplate = template;
    game.status = GameStatus.CONFIGURED;
    if (!game.title) {
      game.title = `${gameType.toString()} ${game.smallBlind}/${game.bigBlind}`;
    }
    if (!game.straddleBet) {
      game.straddleBet = game.bigBlind * 2;
    }
    if (club) {
      game.clubId = club.id;
      game.clubCode = club.clubCode;
      game.clubName = club.name;
      game.gameCode = await getGameCodeForClub();
    } else {
      game.gameCode = await getGameCodeForPlayer();
    }
    let savedGame;
    // use current time as the game id for now
    game.privateGame = true;

    game.startedAt = new Date();
    game.startedBy = player.id;
    game.startedByName = player.name;
    game.hostId = player.id;
    game.hostName = player.name;
    game.hostUuid = player.uuid;
    let gameServer: GameServer;

    let saveTime, saveUpdateTime, publishNewTime;
    try {
      //logger.info('****** STARTING TRANSACTION TO CREATE a private game');

      let gameServerUrl = '';
      if (useGameServer) {
        gameServer = await GameServerRepository.getNextGameServer();
        if (!gameServer) {
          throw new Error(`No game server is available to host the game`);
        }
        gameServerUrl = gameServer.url;
      }

      await getGameManager().transaction(async transactionEntityManager => {
        saveTime = new Date().getTime();
        game.gameServerUrl = gameServerUrl;
        savedGame = await transactionEntityManager
          .getRepository(PokerGame)
          .save(game);
        game.id = savedGame.id;
        await GameServerRepository.gameAdded(
          gameServerUrl,
          transactionEntityManager
        );

        saveTime = new Date().getTime() - saveTime;
        if (!game.isTemplate) {
          // create an entry in the history table
          await HistoryRepository.newGameCreated(game);

          saveUpdateTime = new Date().getTime();
          await GameUpdatesRepository.create(
            game.id,
            game.gameCode,
            input,
            transactionEntityManager
          );
          await GameSettingsRepository.create(
            game.id,
            game.gameCode,
            input,
            transactionEntityManager
          );

          const gameSeatInfoRepo = transactionEntityManager.getRepository(
            PokerGameSeatInfo
          );
          const gameSeatInfo = new PokerGameSeatInfo();
          gameSeatInfo.gameID = game.id;
          gameSeatInfo.gameCode = game.gameCode;
          await gameSeatInfoRepo.save(gameSeatInfo);

          saveUpdateTime = new Date().getTime() - saveUpdateTime;
          let pick = 0;

          const rewardTrackingIds = new Array<number>();
          if (input.rewardIds) {
            const rewardRepository = getUserRepository(Reward);
            for await (const rewardId of input.rewardIds) {
              if (rewardId === 0) {
                continue;
              }
              const reward = await rewardRepository.findOne({id: rewardId});
              if (!reward) {
                throw new Error(`Reward: ${rewardId} is not found`);
              }

              const rewardTrackRepo = transactionEntityManager.getRepository(
                GameRewardTracking
              );
              const rewardTrack = await rewardTrackRepo.findOne({
                rewardId: rewardId,
                active: true,
              });
              if (!rewardTrack) {
                const createRewardTrack = new GameRewardTracking();
                createRewardTrack.rewardId = reward.id;
                createRewardTrack.day = new Date();

                try {
                  const rewardTrackRepository = transactionEntityManager.getRepository(
                    GameRewardTracking
                  );
                  const rewardTrackResponse = await rewardTrackRepository.save(
                    createRewardTrack
                  );
                  const createGameReward = new GameReward();
                  createGameReward.gameId = game.id;
                  createGameReward.gameCode = game.gameCode;
                  createGameReward.rewardId = rewardId;
                  createGameReward.rewardTrackingId = rewardTrackResponse;
                  rewardTrackingIds.push(rewardTrackResponse.id);
                  const gameRewardRepository = transactionEntityManager.getRepository(
                    GameReward
                  );
                  await gameRewardRepository.save(createGameReward);
                } catch (err) {
                  logger.error(`Failed to update rewards. ${err.toString()}`);
                  throw err;
                }
              } else {
                rewardTrackingIds.push(rewardTrack.id);
                const createGameReward = new GameReward();
                createGameReward.gameId = game.id;
                createGameReward.gameCode = game.gameCode;
                createGameReward.rewardId = rewardId;
                createGameReward.rewardTrackingId = rewardTrack;

                const gameRewardRepository = transactionEntityManager.getRepository(
                  GameReward
                );
                await gameRewardRepository.save(createGameReward);
              }
            }
          }

          publishNewTime = new Date().getTime();
          let tableStatus = TableStatus.WAITING_TO_BE_STARTED;
          if (useGameServer) {
            if (!gameServer) {
              throw new Error(`No game server available to host the game`);
            }
            const gameInput = game as any;
            gameInput.rewardTrackingIds = rewardTrackingIds;
            logger.info(
              `Game server ${gameServer.url.toString()} is requested to host ${
                game.gameCode
              }`
            );
            tableStatus = await publishNewGame(gameInput, gameServer, false);
            let serverUrl = '';
            if (gameServer) {
              serverUrl = gameServer.url;
            }
            logger.info(`Game ${game.gameCode} is hosted in ${serverUrl}`);
            publishNewTime = new Date().getTime() - publishNewTime;

            if (!gameServer) {
              // could not assign game server for the game
              throw new Error('No game server is accepting this game');
            }
          }
          game.tableStatus = tableStatus;
          await transactionEntityManager.getRepository(PokerGame).update(
            {
              id: game.id,
            },
            {tableStatus: tableStatus}
          );
        }
      });

      await GameSettingsRepository.get(game.gameCode, true);
      await GameUpdatesRepository.get(game.gameCode, true);

      //logger.info('****** ENDING TRANSACTION TO CREATE a private game');
      logger.debug(
        `createPrivateGame saveTime: ${saveTime}, saveUpdateTime: ${saveUpdateTime}, publishNewTime: ${publishNewTime}`
      );
    } catch (err) {
      logger.error(
        `Couldn't create game and retry again. Error: ${err.toString()}`
      );
      throw new Error("Couldn't create the game, please retry again");
    }
    return savedGame;
  }

  public async getGameByCode(
    gameCode: string,
    transactionManager?: EntityManager
  ): Promise<PokerGame | undefined> {
    let repository: Repository<PokerGame>;
    if (transactionManager) {
      repository = transactionManager.getRepository(PokerGame);
    } else {
      repository = getGameRepository(PokerGame);
    }

    // get game by id (testing only)
    const game = await repository.findOne({where: {gameCode: gameCode}});
    return game;
  }

  public async getGameCountByClubId(clubId: number): Promise<number> {
    const repository = getGameRepository(PokerGame);
    const count = await repository.count({where: {clubId: clubId}});
    return count;
  }

  public async getGameCountByPlayerId(playerId: number): Promise<number> {
    const repository = getGameRepository(PokerGame);
    const count = await repository.count({where: {hostId: playerId}});
    return count;
  }

  public async getLiveGames(playerId: string) {
    const clubGames = await this.getClubGames(playerId);
    const playerGames = await this.getPlayerGames(playerId);

    const liveGames = new Array<any>();
    liveGames.push(...clubGames);

    const existingGames = clubGames.map(x => x.gameCode);
    for (const playerGame of playerGames) {
      const i = existingGames.indexOf(playerGame.gameCode);
      if (i === -1) {
        liveGames.push(playerGame);
      }
    }

    return liveGames;
  }

  public async getClubGames(playerId: string) {
    const player = await Cache.getPlayer(playerId);
    const clubIds = await ClubRepository.getClubIds(player.id);
    if (!clubIds || clubIds.length === 0) {
      return [];
    }
    const clubIdsIn = clubIds.join(',');
    const query = `
        SELECT 
          g.club_code as "clubCode", 
          g.club_name as "clubName", 
          g.game_code as "gameCode", 
          g.id as gameId, 
          g.title as title, 
          g.game_type as "gameType", 
          g.buy_in_min as "buyInMin", 
          g.buy_in_max as "buyInMax",
          g.small_blind as "smallBlind",
          g.big_blind as "bigBlind",
          g.started_at as "startedAt", 
          g.max_players as "maxPlayers", 
          100 as "maxWaitList", 
          pgs.players_in_waitlist as "waitlistCount", 
          pgs.players_in_seats as "tableCount", 
          g.game_status as "gameStatus",
          pgt.status as "playerStatus",
          pgu.hand_num as "handsDealt"
        FROM poker_game as g JOIN poker_game_updates as pgu ON 
          g.game_code = pgu.game_code
        JOIN poker_game_seat_info pgs ON
          g.game_code = pgs.game_code
        LEFT OUTER JOIN 
          player_game_tracker as pgt ON
          pgt.pgt_player_id = ${player.id} AND
          pgt.pgt_game_id  = g.id
        where
        g.game_status NOT IN (${GameStatus.ENDED}) AND
        g.club_id IN (${clubIdsIn})`;
    const resp = await getGameConnection().query(query);
    return resp;
  }

  public async getPlayerGames(playerId: string) {
    const player = await Cache.getPlayer(playerId);
    const query = `
        SELECT 
          g.club_code as "clubCode", 
          g.club_name as "clubName", 
          g.game_code as "gameCode", 
          g.id as gameId, 
          g.title as title, 
          g.game_type as "gameType", 
          g.buy_in_min as "buyInMin", 
          g.buy_in_max as "buyInMax",
          g.small_blind as "smallBlind",
          g.big_blind as "bigBlind",
          g.started_at as "startedAt", 
          g.max_players as "maxPlayers", 
          100 as "maxWaitList", 
          pgs.players_in_waitlist as "waitlistCount", 
          pgs.players_in_seats as "tableCount", 
          g.game_status as "gameStatus",
          pgt.status as "playerStatus",
          pgu.hand_num as "handsDealt"
        FROM poker_game as g JOIN poker_game_updates as pgu ON 
          g.game_code = pgu.game_code
        JOIN poker_game_seat_info pgs ON
          g.game_code = pgs.game_code
        LEFT OUTER JOIN 
          player_game_tracker as pgt ON
          pgt.pgt_player_id = ${player.id} AND
          pgt.pgt_game_id  = g.id
        where
        g.game_status NOT IN (${GameStatus.ENDED}) AND
        g.host_id = ${player.id}`;
    const resp = await getGameConnection().query(query);
    return resp;
  }

  public async getNextGameServer(): Promise<number> {
    const query = 'SELECT max(server_num)+1 next_number FROM game_server';
    const resp = await getGameConnection().query(query);
    let nextNumber = 1;
    if (resp[0]['next_number']) {
      nextNumber = resp[0]['next_number'];
    }
    return nextNumber;
  }

  public async endExpireGames(): Promise<any> {
    const games: Array<PokerGame> = await getGameRepository(PokerGame).find({
      where: {
        status: Not(GameStatus.ENDED),
      },
    });
    let numExpired = 0;
    for (const game of games) {
      // Game length is in minutes.
      const shouldExpireAt = new Date(
        game.startedAt.getTime() + 1000 * 60 * game.gameLength
      );
      const now = Date.now();
      if (shouldExpireAt.getTime() > now) {
        // Still got time until expire.
        continue;
      }

      logger.info(
        `Scheduling to end expired game ${game.title} (${game.id}/${game.gameCode})`
      );

      const minutesSinceExpired = (now - shouldExpireAt.getTime()) / 60_000;
      const envKillLimit = parseInt(
        process.env.RUNAWAY_GAME_KILL_THRESHOLD_MIN || ''
      );
      const killLimit = Number.isInteger(envKillLimit) ? envKillLimit : 10;

      if (
        game.status === GameStatus.ACTIVE &&
        game.tableStatus === TableStatus.GAME_RUNNING &&
        minutesSinceExpired < killLimit
      ) {
        // the game will be stopped in the next hand
        await NextHandUpdatesRepository.expireGameNextHand(game.id);
        const messageId = uuidv4();
        Nats.sendGameEndingMessage(game.gameCode, messageId);
      } else {
        if (minutesSinceExpired >= killLimit) {
          logger.info(
            `Attempting to kill runaway game ${game.title} (${game.id}/${game.gameCode}). Minutes since expired: ${minutesSinceExpired}, kill threshold: ${killLimit} minutes.`
          );
        }
        await Cache.removeAllObservers(game.gameCode);
        await GameRepository.markGameEnded(
          game.id,
          GameEndReason.SYSTEM_TERMINATED
        );
      }
      numExpired++;
    }
    return {numExpired: numExpired};
  }

  public async endGameInternal(
    gameCode: string,
    force: boolean
  ): Promise<GameStatus> {
    const game: PokerGame | undefined = await getGameRepository(
      PokerGame
    ).findOne({
      where: {gameCode: gameCode},
    });
    if (!game) {
      throw new Error(`Cannot find game ${gameCode}`);
    }
    const player = null;
    const endReason = GameEndReason.SYSTEM_TERMINATED;
    return this.endGame(player, game, endReason, force);
  }

  public async seatOccupied(
    game: PokerGame,
    seatNo: number,
    transManager?: EntityManager
  ) {
    if (!seatNo || seatNo < 1 || seatNo > 9) {
      throw new Error(
        `seatOccupied called with invalid seat number: ${seatNo}`
      );
    }

    let gameSeatInfoRepo: Repository<PokerGameSeatInfo>;
    let playerGameTrackerRepo: Repository<PlayerGameTracker>;
    if (transManager) {
      gameSeatInfoRepo = transManager.getRepository(PokerGameSeatInfo);
      playerGameTrackerRepo = transManager.getRepository(PlayerGameTracker);
    } else {
      gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    // get number of players in the seats
    const count = await playerGameTrackerRepo.count({
      where: {
        game: {id: game.id},
        status: In([
          PlayerStatus.PLAYING,
          PlayerStatus.IN_BREAK,
          PlayerStatus.WAIT_FOR_BUYIN,
        ]),
      },
    });

    const gameUpdateProps: any = {playersInSeats: count};
    gameUpdateProps[`seat${seatNo}`] = SeatStatus.OCCUPIED;
    await gameSeatInfoRepo.update(
      {
        gameID: game.id,
      },
      gameUpdateProps
    );
  }

  public async seatOpened(
    game: PokerGame,
    seatNo: number,
    transManager?: EntityManager
  ) {
    if (!seatNo || seatNo == 0 || seatNo < 1 || seatNo > 9) {
      logger.error(`seatOpened called with invalid seat number: ${seatNo}`);
      return;
    }

    let gameSeatInfoRepo: Repository<PokerGameSeatInfo>;
    let playerGameTrackerRepo: Repository<PlayerGameTracker>;
    if (transManager) {
      gameSeatInfoRepo = transManager.getRepository(PokerGameSeatInfo);
      playerGameTrackerRepo = transManager.getRepository(PlayerGameTracker);
    } else {
      gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    // get number of players in the seats
    const count = await playerGameTrackerRepo.count({
      where: {
        game: {id: game.id},
        status: In([
          PlayerStatus.PLAYING,
          PlayerStatus.IN_BREAK,
          PlayerStatus.WAIT_FOR_BUYIN,
        ]),
      },
    });

    const gameSeatInfoProps: any = {playersInSeats: count};
    gameSeatInfoProps[`seat${seatNo}`] = SeatStatus.OPEN;
    await gameSeatInfoRepo.update(
      {
        gameID: game.id,
      },
      gameSeatInfoProps
    );
  }

  public async joinGame(
    player: Player,
    game: PokerGame,
    seatNo: number,
    ip: string,
    location: any
  ): Promise<PlayerStatus> {
    if (seatNo > game.maxPlayers) {
      throw new Error('Invalid seat number');
    }
    const waitlistMgmt = new WaitListMgmt(game);
    let startTime = new Date().getTime();
    const [playerInGame, newPlayer] = await getGameManager().transaction(
      async transactionEntityManager => {
        const gameSeatInfoRepo = transactionEntityManager.getRepository(
          PokerGameSeatInfo
        );

        const gameSeatInfo = await gameSeatInfoRepo.findOne({gameID: game.id});
        if (!gameSeatInfo) {
          logger.error(`Game status is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game status is not found for game: ${game.gameCode}`
          );
        }
        if (gameSeatInfo.seatChangeInProgress) {
          throw new Error(
            `Seat change is in progress for game: ${game.gameCode}`
          );
        }
        const gameSettings = await GameSettingsRepository.get(
          game.gameCode,
          false,
          transactionEntityManager
        );
        if (!gameSettings) {
          logger.error(`Game settings is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game settings is not found for game: ${game.gameCode}`
          );
        }

        if (gameSettings.gpsCheck || gameSettings.ipCheck) {
          const locationCheck = new LocationCheck(game, gameSettings);
          await locationCheck.checkForOnePlayer(
            player,
            ip,
            location,
            undefined,
            transactionEntityManager
          );
        }

        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );

        if (gameSeatInfo.waitlistSeatingInprogress) {
          // wait list seating in progress
          // only the player who is asked from the waiting list can sit here
          await waitlistMgmt.seatPlayer(
            player,
            seatNo,
            transactionEntityManager
          );
        }

        // player is taking a seat in the game
        // ensure the seat is available
        // create a record in the player_game_tracker
        // set the player status to waiting_for_buyin
        // send a message to game server that a new player is in the seat
        //logger.info(`Perf: Calling join game query`);
        const playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: game.id},
            seatNo: seatNo,
          },
        });

        // if the current player in seat tried to sit in the same seat, do nothing
        if (playerInSeat && playerInSeat.playerId === player.id) {
          return [playerInSeat, false];
        }

        if (playerInSeat && playerInSeat.playerId !== player.id) {
          // there is a player in the seat (unexpected)
          throw new Error(
            `A player ${playerInSeat.playerName}:${playerInSeat.playerUuid} is sitting in seat: ${seatNo}`
          );
        }
        // if this player has already played this game before, we should have his record
        const playerInGames = await playerGameTrackerRepository
          .createQueryBuilder()
          .where({
            game: {id: game.id},
            playerId: player.id,
          })
          .select('stack')
          .addSelect('status')
          .addSelect('buy_in', 'buyIn')
          .addSelect('game_token', 'gameToken')
          .addSelect('missed_blind', 'missedBlind')
          .addSelect('posted_blind', 'postedBlind')
          .execute();

        let playerInGame: PlayerGameTracker | null = null;
        if (playerInGames.length > 0) {
          playerInGame = playerInGames[0];
        }

        if (playerInGame) {
          playerInGame.seatNo = seatNo;
          playerInGame.playerIp = ip;
          if (location) {
            playerInGame.playerLocation = `${location.lat},${location.long}`;
          }
        } else {
          playerInGame = new PlayerGameTracker();
          playerInGame.playerId = player.id;
          playerInGame.playerUuid = player.uuid;
          playerInGame.playerName = player.name;
          playerInGame.game = game;
          playerInGame.stack = 0;
          playerInGame.buyIn = 0;
          playerInGame.seatNo = seatNo;
          playerInGame.noOfBuyins = 0;
          playerInGame.buyinNotes = '';
          playerInGame.satAt = new Date();
          const randomBytes = Buffer.from(crypto.randomBytes(5));
          playerInGame.gameToken = randomBytes.toString('hex');
          playerInGame.status = PlayerStatus.NOT_PLAYING;
          playerInGame.runItTwiceEnabled = gameSettings.runItTwiceAllowed;
          playerInGame.muckLosingHand = game.muckLosingHand;
          playerInGame.playerIp = ip;
          if (location) {
            playerInGame.playerLocation = `${location.lat},${location.long}`;
          }

          if (
            game.status === GameStatus.ACTIVE &&
            game.tableStatus === TableStatus.GAME_RUNNING
          ) {
            // player must post blind
            playerInGame.missedBlind = true;
          }

          try {
            if (gameSettings.useAgora) {
              playerInGame.audioToken = await PlayersInGameRepository.getAudioToken(
                player,
                game,
                transactionEntityManager
              );
            }
          } catch (err) {
            logger.error(
              `Failed to get agora token ${err.toString()} Game: ${game.id}`
            );
          }

          try {
            await playerGameTrackerRepository.save(playerInGame);
            await StatsRepository.joinedNewGame(player);
            // create a row in stats table
            await StatsRepository.newGameStatsRow(game, player);
          } catch (err) {
            logger.error(
              `Failed to update player_game_tracker and player_game_stats table ${err.toString()} Game: ${
                game.id
              }`
            );
            throw err;
          }
        }

        // we need 5 bytes to scramble 5 cards
        if (playerInGame.stack > 0) {
          playerInGame.status = PlayerStatus.PLAYING;
        } else {
          playerInGame.status = PlayerStatus.WAIT_FOR_BUYIN;
        }

        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          {
            seatNo: seatNo,
            status: playerInGame.status,
            waitingFrom: null,
            waitlistNum: 0,
            satAt: new Date(),
          }
        );
        await this.seatOccupied(game, seatNo, transactionEntityManager);
        if (playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN) {
          await PlayersInGameRepository.startBuyinTimer(
            game,
            player.id,
            player.name,
            {},
            transactionEntityManager
          );
        }
        return [playerInGame, true];
      }
    );
    try {
      if (game.clubCode) {
        const clubMember = await Cache.getClubMember(
          player.uuid,
          game.clubCode
        );
        if (clubMember) {
          const clubMemberRepo = getUserRepository(ClubMember);
          await clubMemberRepo.update(
            {
              id: clubMember.id,
            },
            {
              lastGamePlayedDate: new Date(),
            }
          );
        }
      }
    } catch (err) {
      // ignore this error (not critical)
    }
    let timeTaken = new Date().getTime() - startTime;
    logger.debug(`joingame database time taken: ${timeTaken}`);
    startTime = new Date().getTime();
    if (newPlayer) {
      await Cache.removeGameObserver(game.gameCode, player);
      // send a message to gameserver
      //newPlayerSat(game, player, seatNo, playerInGame);
      Nats.newPlayerSat(game, player, playerInGame, seatNo);

      // continue to run wait list seating
      waitlistMgmt.runWaitList().catch(e => {
        logger.error(`Failed to run waitlist processing. Error: ${e.message}`);
      });
    }

    if (playerInGame.status === PlayerStatus.PLAYING) {
      await GameRepository.restartGameIfNeeded(game, true, false);
    }

    timeTaken = new Date().getTime() - startTime;
    logger.debug(`joingame server notification time taken: ${timeTaken}`);
    startTime = new Date().getTime();
    return playerInGame.status;
  }

  public async myGameState(
    player: Player,
    game: PokerGame
  ): Promise<PlayerGameTracker> {
    logger.info(`myGameState query is called`);
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.findOne({
      where: {
        game: {id: game.id},
        playerId: player.id,
      },
    });
    const allPlayers = await playerGameTrackerRepository.find({
      where: {
        game: {id: game.id},
      },
    });

    if (!playerInGame) {
      logger.error(
        `Player ${player.name} is not in the game: ${game.gameCode}`
      );
      throw new Error(`Player ${player.name} is not in the game`);
    }
    return playerInGame;
  }

  public async tableGameState(game: PokerGame): Promise<PlayerGameTracker[]> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepository.find({
      where: {
        game: {id: game.id},
      },
    });

    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
    }

    return playerInGame;
  }

  public async restartGameIfNeeded(
    game: PokerGame,
    runPendingUpdates: boolean,
    hostStartedGame: boolean,
    transactionEntityManager?: EntityManager
  ): Promise<void> {
    logger.info(
      `[${gameLogPrefix(game)}] Restarting game. Game status: ${
        GameStatus[game.status]
      }`
    );
    if (game.status !== GameStatus.ACTIVE) {
      return;
    }
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (transactionEntityManager) {
      playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }

    const playingCount = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        status: PlayerStatus.PLAYING,
      })
      .getCount();

    if (playingCount >= 2) {
      try {
        let gameRepo: Repository<PokerGame>;
        if (transactionEntityManager) {
          gameRepo = transactionEntityManager.getRepository(PokerGame);
        } else {
          gameRepo = getGameRepository(PokerGame);
        }
        const rows = await gameRepo
          .createQueryBuilder()
          .where({id: game.id})
          .select('game_status', 'status')
          .addSelect('table_status', 'tableStatus')
          .execute();
        if (rows) {
          const row = rows[0];

          const prevTableStatus = row.tableStatus;
          let newTableStatus = prevTableStatus;
          if (prevTableStatus === TableStatus.NOT_ENOUGH_PLAYERS) {
            if (game.gameStarted) {
              newTableStatus = TableStatus.GAME_RUNNING;
              let queryBuilder;
              if (transactionEntityManager) {
                queryBuilder = transactionEntityManager.createQueryBuilder();
              } else {
                queryBuilder = getGameConnection().createQueryBuilder();
              }
              await queryBuilder
                .update(PokerGame)
                .set({
                  tableStatus: newTableStatus,
                })
                .where('id = :id', {id: game.id})
                .execute();

              game = await Cache.getGame(
                game.gameCode,
                true,
                transactionEntityManager
              );
            }
          }

          // if game is active, there are more players in playing status, resume the game again
          if (
            row.status === GameStatus.ACTIVE &&
            newTableStatus === TableStatus.GAME_RUNNING
          ) {
            // update game status
            await gameRepo.update(
              {
                id: game.id,
              },
              {
                tableStatus: newTableStatus,
              }
            );
            // refresh the cache
            const gameCached = await Cache.getGame(
              game.gameCode,
              true,
              transactionEntityManager
            );
            logger.info(`[${game.gameCode}] Resuming game`);
            const gameUpdate = await Cache.getGameUpdates(game.gameCode, true);
            if (
              game.gameType === GameType.DEALER_CHOICE &&
              gameUpdate.orbitPos === 0
            ) {
              await processPendingUpdates(game.id);
            } else {
              // resume the game
              await resumeGame(gameCached.id, transactionEntityManager);
            }
          }
        }
      } catch (err) {
        logger.error(`Error handling buyin approval. ${err.toString()}`);
      }
    }
  }

  public async updateBreakTime(playerId: number, gameId: number) {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: gameId},
        playerId: playerId,
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${gameId} not available`);
      throw new Error(`Game: ${gameId} not available`);
    }

    const now = new Date();
    const timeout = 60;
    now.setSeconds(now.getSeconds() + timeout);
    const exp = utcTime(now);

    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .set({
        breakTimeExpAt: exp,
      })
      .execute();

    return playerInGame.status;
  }

  public async markPlayerGameState(
    playerId: number,
    gameId: number,
    status: PlayerStatus
  ) {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: gameId},
        playerId: playerId,
      })
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${gameId} not available`);
      throw new Error(`Game: ${gameId} not available`);
    }
    const playerStatus = (PlayerStatus[status] as unknown) as PlayerStatus;
    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .where({
        game: {id: gameId},
        playerId: playerId,
      })
      .set({
        status: playerStatus,
      })
      .execute();
    return playerStatus;
  }

  public async getGameServer(
    gameId: number,
    transactionManager?: EntityManager
  ): Promise<GameServer | null> {
    const game = await Cache.getGameById(gameId, transactionManager);
    if (!game) {
      throw new Error(`Game id ${gameId} not found`);
    }
    const gameServer = await GameServerRepository.get(
      game.gameServerUrl,
      transactionManager
    );
    return gameServer;
  }

  public async startGame(player: Player, game: PokerGame): Promise<GameStatus> {
    if (game.status === GameStatus.ENDED) {
      // game that ended cannot be restarted
      logger.error(`Game: ${game.gameCode} is ended. Cannot be restarted`);
      return game.status;
    }
    await this.markGameStatus(game.id, GameStatus.ACTIVE);

    return GameStatus.ACTIVE;
  }

  public async markGameActive(
    gameId: number,
    gameNum?: number
  ): Promise<GameStatus> {
    const resp = this.markGameStatus(gameId, GameStatus.ACTIVE, gameNum);

    const game = await Cache.getGameById(gameId);
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }

    const host = await Cache.getPlayer(game.hostUuid);
    if (!host.bot) {
      // consume game coins
      await AppCoinRepository.consumeGameCoins(game);
    }

    // update game history
    await HistoryRepository.updateGameNum(gameId, gameNum);
    return resp;
  }

  public async markGameEnded(
    gameId: number,
    endReason: GameEndReason
  ): Promise<GameStatus> {
    const repository = getGameRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }

    // update session time
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const players = await playerGameTrackerRepository.find({
      game: {id: game.id},
    });
    for (const playerInGame of players) {
      if (playerInGame.satAt) {
        const satAt = new Date(Date.parse(playerInGame.satAt.toString()));
        // calculate session time
        let sessionTime: number = playerInGame.sessionTime;
        if (!sessionTime) {
          sessionTime = 1;
        }
        const currentSessionTime = new Date().getTime() - satAt.getTime();
        const roundSeconds = Math.round(currentSessionTime / 1000);
        sessionTime = sessionTime + roundSeconds;

        await playerGameTrackerRepository.update(
          {
            id: playerInGame.id,
          },
          {
            sessionTime: sessionTime,
            satAt: undefined,
          }
        );
      }
    }

    await getGameConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set({
        endReason: endReason,
      })
      .where('id = :id', {id: gameId})
      .execute();

    const updatedGame = await Cache.getGame(game.gameCode, true);
    let updates = await GameUpdatesRepository.get(game.gameCode);

    await PlayersInGameRepository.gameEnded(game);
    await HistoryRepository.gameEnded(game, updates.handNum, endReason);
    const ret = this.markGameStatus(gameId, GameStatus.ENDED);
    await GameServerRepository.gameRemoved(game.gameServerUrl);
    game.status = GameStatus.ENDED;
    updates = await GameUpdatesRepository.get(game.gameCode, true);

    // Schedule post processing.
    if (notifyScheduler()) {
      logger.info(
        `Scheduling post processing for game ${game.id}/${game.gameCode}`
      );
      schedulePostProcessing(game.id, game.gameCode).catch(e => {
        logger.error(
          `[${game.gameCode}] Failed to schedule post processing. Error: ${e.message}`
        );
      });
    }
    return ret;
  }

  public async anyPendingUpdates(gameId: number): Promise<boolean> {
    const game = await Cache.getGameById(gameId);
    if (game && game.pendingUpdates) {
      return true;
    }

    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ?'
    );
    const resp = await getGameConnection().query(query, [gameId]);
    if (resp[0]['updates'] > 0) {
      return true;
    }
    return false;
  }

  public async markGameStatus(
    gameId: number,
    status: GameStatus,
    gameNum?: number
  ) {
    const repository = getGameRepository(PokerGame);
    const playersInGame = getGameRepository(PlayerGameTracker);
    let game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }

    const players = await playersInGame.find({
      where: {game: {id: gameId}},
    });

    const values: any = {
      status: status,
    };
    if (status === GameStatus.ENDED) {
      values.endedAt = new Date();
    }

    if (gameNum) {
      values.gameNum = gameNum;
    }

    await getGameConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set(values)
      .where('id = :id', {id: gameId})
      .execute();

    if (status === GameStatus.PAUSED) {
      // game is paused
      await Nats.changeGameStatus(
        game,
        status,
        TableStatus.WAITING_TO_BE_STARTED
      );
      return status;
    }
    // if game ended
    if (status === GameStatus.ENDED) {
      // update cached game
      game = await Cache.getGame(game.gameCode, true /** update */);

      try {
        // update the game server with new status
        await endGame(game.id);
      } catch (err) {
        logger.warn(`Could not end game in game server: ${err.toString()}`);
      }

      // announce to the players the game has ended
      await Nats.changeGameStatus(
        game,
        status,
        TableStatus.WAITING_TO_BE_STARTED
      );
      return status;
    } else {
      if (status === GameStatus.ACTIVE) {
        const playerGameTrackerRepository = getGameManager().getRepository(
          PlayerGameTracker
        );
        const playingCount = await playerGameTrackerRepository
          .createQueryBuilder()
          .where({
            game: {id: game.id},
            status: PlayerStatus.PLAYING,
          })
          .getCount();

        if (playingCount <= 1) {
          await getGameConnection()
            .createQueryBuilder()
            .update(PokerGame)
            .set({
              tableStatus: TableStatus.NOT_ENOUGH_PLAYERS,
              gameStarted: true,
            })
            .where('id = :id', {id: gameId})
            .execute();
        } else {
          await getGameConnection()
            .createQueryBuilder()
            .update(PokerGame)
            .set({
              tableStatus: TableStatus.GAME_RUNNING,
              gameStarted: true,
            })
            .where('id = :id', {id: gameId})
            .execute();
          game.tableStatus = TableStatus.GAME_RUNNING;

          // update last ip gps check time
          await GameUpdatesRepository.updateLastIpCheckTime(game);
        }
        // update the game server with new status
        await Nats.changeGameStatus(game, status, game.tableStatus);

        const updatedGame = await Cache.getGame(
          game.gameCode,
          true /** update */
        );

        if (status === GameStatus.ACTIVE) {
          await this.restartGameIfNeeded(
            updatedGame,
            false,
            true /* host started game */
          );
        }
      }
    }

    return status;
  }

  public async markTableStatus(gameId: number, status: TableStatus) {
    const repository = getGameRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }
    //this stores string value
    // const tableStatusValue = TableStatus[status.toString()];
    await getGameConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set({tableStatus: status})
      .where('id = :id', {id: gameId})
      .execute();
    // update cached game
    await Cache.getGame(game.gameCode, true /** update */);
    return status;
  }

  public async getGameSettings(
    gameCode: string
  ): Promise<PokerGameSettings | undefined> {
    return await getGameRepository(PokerGameSettings).findOne({
      gameCode: gameCode,
    });
  }

  public async getGameResultTable(gameCode: string): Promise<any> {
    const query = fixQuery(`
      SELECT 
        pgt.session_time AS "sessionTime",
        pgt.no_hands_played AS "handsPlayed",
        pgt.buy_in AS "buyIn",
        pgt.stack - pgt.buy_in AS "profit",
        pgt.stack AS "stack",
        pgt.rake_paid AS "rakePaid",
        pgt.sat_at AS "satAt",
        pgt.player_name AS "playerName",
        pgt.player_uuid AS "playerUuid",
        pgt.pgt_player_id AS "playerId"
      FROM player_game_tracker pgt
      INNER JOIN poker_game pg ON pgt.pgt_game_id = pg.id
      WHERE pg.game_code = ?
      AND pgt.no_hands_played > 0`);

    const result = await getGameConnection().query(query, [gameCode]);
    return result;
  }

  public async getGamePlayers(gameCode: string): Promise<Array<any>> {
    const query = fixQuery(`
    SELECT pgt.pgt_player_id AS "id", pgt.player_name AS "name", pgt.player_uuid AS "uuid"
    FROM player_game_tracker pgt
    JOIN
     poker_game pg ON pgt.pgt_game_id = pg.id
    WHERE pg.game_code = ?`);

    const result = await getGameConnection().query(query, [gameCode]);
    return result;
  }

  public async deleteGame(
    playerId: string,
    gameCode: string,
    includeGame: boolean
  ) {
    await getGameManager().transaction(async transactionEntityManager => {
      if (gameCode) {
        const gameRepo = transactionEntityManager.getRepository(PokerGame);
        const game = await gameRepo.findOne({gameCode: gameCode});
        if (!game) {
          throw new Error(`Game ${gameCode} is not found`);
        }
        await transactionEntityManager
          .getRepository(PlayerGameTracker)
          .delete({game: {id: game.id}});
        await getHistoryRepository(PlayerGameStats).delete({gameId: game.id});
        await transactionEntityManager
          .getRepository(NextHandUpdates)
          .delete({game: {id: game.id}});

        if (!includeGame) {
          await gameRepo.delete({id: game.id});
        }
      } else {
        await transactionEntityManager
          .getRepository(PlayerGameTracker)
          .createQueryBuilder()
          .delete()
          .execute();
        await getHistoryRepository(PlayerGameStats)
          .createQueryBuilder()
          .delete()
          .execute();
        await transactionEntityManager
          .getRepository(NextHandUpdates)
          .createQueryBuilder()
          .delete()
          .execute();

        if (!includeGame) {
          await transactionEntityManager
            .getRepository(PokerGame)
            .createQueryBuilder()
            .delete()
            .execute();
        }
      }
    });
    return true;
  }

  public async updateDealerChoice(
    game: PokerGame,
    player: Player,
    gameType: GameType
  ) {
    // is this player supposed to update?
    const gameUpdate = await GameUpdatesRepository.get(game.gameCode, true);
    if (gameUpdate.dealerChoiceSeat !== player.id) {
      return;
    }

    // cancel the dealer choice timer
    cancelTimer(game.id, 0, DEALER_CHOICE_TIMEOUT).catch(e => {
      logger.error(
        `Cancelling dealer choice timeout failed. Error: ${e.message}`
      );
    });
    await GameUpdatesRepository.updateNextGameType(game, gameType);
    // pending updates done
    await resumeGame(game.id);
  }

  public async updateJanus(
    gameCode: string,
    gameID: number,
    sessionId: string,
    handleId: string,
    roomId: number,
    roomPin: string
  ) {
    const gameSettingsRepo = getGameRepository(PokerGameSettings);
    await gameSettingsRepo.update(
      {
        gameCode: gameCode,
      },
      {
        janusSessionId: sessionId,
        janusPluginHandle: handleId,
        janusRoomId: roomId,
        janusRoomPin: roomPin,
      }
    );
  }

  public async updateAudioConfDisabled(gameCode: string) {
    const gameSettingsRepo = getGameRepository(PokerGameSettings);
    await gameSettingsRepo.update(
      {gameCode: gameCode},
      {
        audioConfEnabled: false,
      }
    );
    await Cache.getGameSettings(gameCode, true);
  }

  public async determineGameStatus(gameID: number): Promise<boolean> {
    // if only one player or zero player is active, then mark the game not enough players
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    // get number of players in the seats
    const count = await playerGameTrackerRepo.count({
      where: {
        game: {id: gameID},
        status: PlayerStatus.PLAYING,
        stack: Not(0),
      },
    });

    if (count <= 1) {
      // only one player is active, mark the game not enough players
      await this.markTableStatus(gameID, TableStatus.NOT_ENOUGH_PLAYERS);
      return false;
    }
    return true;
  }

  public async hostingCount(playerUuid: string): Promise<number> {
    const gameRepo = getGameRepository(PokerGame);
    // get number of players in the seats
    const count = await gameRepo.count({
      where: {
        hostUuid: playerUuid,
        status: In([GameStatus.ACTIVE, GameStatus.CONFIGURED]),
      },
    });
    return count;
  }

  public async getLiveGameCount(club: Club): Promise<number> {
    const gameRepo = getGameRepository(PokerGame);
    // get number of players in the seats
    const count = await gameRepo.count({
      where: {
        clubId: club.id,
        status: In([GameStatus.ACTIVE, GameStatus.CONFIGURED]),
      },
    });
    return count;
  }

  public async getAllPlayersInGame(gameCode: string): Promise<Array<any>> {
    const gameTrackerRepo = getGameRepository(PlayerGameTracker);
    const game = await Cache.getGame(gameCode);
    if (!game) {
      return [];
    }

    const playersInDb = await gameTrackerRepo.find({
      game: {id: game.id},
    });

    const players = new Array<any>();
    for (const player of playersInDb) {
      players.push({
        id: player.playerId,
        name: player.playerName,
        uuid: player.playerUuid,
      });
    }
    return players;
  }

  public async getPlayerStackStat(
    player: Player,
    game: PokerGame
  ): Promise<Array<any>> {
    const hhrepo = getHistoryRepository(HandHistory);
    const stacks = await hhrepo
      .createQueryBuilder()
      .where({
        gameId: game.id,
      })
      .select('players_stack')
      .addSelect('hand_num')
      .orderBy('hand_num', 'ASC')
      .execute();
    const playerIdStr = `${player.id}`;
    const playerStacks = new Array<any>();
    for (const stack of stacks) {
      const playerStack = JSON.parse(stack['players_stack'])[playerIdStr];
      const stackRet = {
        handNum: stack.hand_num,
        before: playerStack.b,
        after: playerStack.a,
      };
      playerStacks.push(stackRet);
    }
    return playerStacks;
  }

  public async getGameHistoryById(
    gameId: number
  ): Promise<GameHistory | undefined> {
    const repository = getHistoryRepository(GameHistory);

    // get game by id (testing only)
    const gameHistory = await repository.findOne({where: {gameId: gameId}});
    return gameHistory;
  }

  public async getPlayersInGameById(
    gameId: number
  ): Promise<Array<PlayersInGame> | undefined> {
    const playersInGameRepo = getHistoryRepository(PlayersInGame);
    const playersInGame = await playersInGameRepo.find({
      where: {gameId: gameId},
    });
    return playersInGame;
  }

  public async getPlayersGameTrackerById(
    gameId: number
  ): Promise<Array<PlayerGameTracker> | undefined> {
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.find({
      where: {game: {id: gameId}},
    });
    return playerGameTracker;
  }

  public async postBlind(game: PokerGame, player: Player): Promise<void> {
    logger.info(`postBlind is called`);
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.findOne({
      where: {
        game: {id: game.id},
        playerId: player.id,
      },
    });
    if (playerGameTracker) {
      await playerGameTrackerRepo.update(
        {
          game: {id: game.id},
          playerId: player.id,
        },
        {
          postedBlind: true,
        }
      );
    }
    const gameDB = await Cache.getGame(game.gameCode, true);
    if (gameDB && gameDB.tableStatus === TableStatus.NOT_ENOUGH_PLAYERS) {
      // resume game
      await this.restartGameIfNeeded(game, false, false);
    }
  }

  public async getSeatStatus(gameID: number): Promise<Array<SeatStatus>> {
    const game = await Cache.getGameById(gameID);
    if (!game) {
      return [];
    }

    const pokerGameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
    const gameSeatInfo = await pokerGameSeatInfoRepo.findOne({
      gameID: gameID,
    });

    const seatStatuses = new Array<SeatStatus>();
    seatStatuses.push(SeatStatus.UNKNOWN);
    if (gameSeatInfo) {
      const gameSeatInfoAny = gameSeatInfo as any;
      for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
        seatStatuses.push(gameSeatInfoAny[`seat${seatNo}`] as SeatStatus);
      }
    }
    return seatStatuses;
  }

  // Updates firebase token for the player
  public async getPlayersWithNotes(
    playerId: string,
    gameCode: string
  ): Promise<Array<any>> {
    const player = await Cache.getPlayer(playerId);
    const game = await Cache.getGame(gameCode);
    // get players in the game
    const playersInGame = await PlayersInGameRepository.getPlayersInSeats(
      game.id
    );
    const playerIds = _.map(playersInGame, e => e.playerId);

    const notesRepo = getUserRepository(PlayerNotes);
    const notes = await notesRepo.find({
      relations: ['player', 'notesToPlayer'],
      where: {
        player: {id: player.id},
        notesToPlayer: {id: In(playerIds)},
      },
    });
    if (!notes) {
      return [];
    }
    const retNotes = new Array<any>();
    for (const notesPlayer of notes) {
      let notes = '';
      if (notesPlayer.notes) {
        notes = notesPlayer.notes;
      }
      retNotes.push({
        playerId: notesPlayer.notesToPlayer.id,
        playerUuid: notesPlayer.notesToPlayer.uuid,
        notes: notes,
      });
    }
    return retNotes;
  }

  public async endGame(
    player: Player | null,
    game: PokerGame,
    endReason: GameEndReason,
    force: boolean
  ) {
    try {
      let gameRunning = true;
      if (
        game.status === GameStatus.ACTIVE &&
        game.tableStatus === TableStatus.GAME_RUNNING
      ) {
        const playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
          game.id
        );
        if (playersInSeats.length == 1) {
          gameRunning = false;
        }
      } else {
        if (
          game.status === GameStatus.ACTIVE &&
          game.tableStatus === TableStatus.NOT_ENOUGH_PLAYERS
        ) {
          gameRunning = false;
        }
      }

      if (game.status === GameStatus.CONFIGURED) {
        gameRunning = false;
      }

      logger.info(
        `Ending Game ${game.gameCode}. game.status: ${
          GameStatus[game.status]
        }, game.tableStatus: ${
          TableStatus[game.tableStatus]
        }, force: ${force}, reason: ${GameEndReason[endReason]}`
      );

      if (gameRunning && !force) {
        // the game will be stopped in the next hand
        await NextHandUpdatesRepository.endGameNextHand(
          player,
          game.id,
          endReason
        );
        const messageId = uuidv4();
        Nats.sendGameEndingMessage(game.gameCode, messageId);
      } else {
        await Cache.removeAllObservers(game.gameCode);
        const status = await GameRepository.markGameEnded(game.id, endReason);
        return status;
      }
      return game.status;
    } catch (err) {
      let playerUuid = 'SYSTEM';
      if (player) {
        playerUuid = player.uuid;
      }
      logger.error(
        `Error while ending game. playerId: ${playerUuid}, gameCode: ${
          game.gameCode
        }: ${errToLogString(err)}`
      );
      throw err;
    }
  }

  public async getActiveGames(): Promise<Array<PokerGame>> {
    const gameRepo = getGameRepository(PokerGame);
    const games = await gameRepo.find({
      status: GameStatus.ACTIVE,
    });
    return games;
  }
}

export const GameRepository = new GameRepositoryImpl();
