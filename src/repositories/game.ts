import * as crypto from 'crypto';
import {
  In,
  Repository,
  EntityManager,
  Not,
  getRepository,
  IsNull,
} from 'typeorm';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {
  GameType,
  GameStatus,
  ClubMemberStatus,
  ClubStatus,
  PlayerStatus,
  TableStatus,
  NextHandUpdate,
  SeatStatus,
} from '@src/entity/types';
import {GameServer, TrackGameServer} from '@src/entity/game/gameserver';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {getGameCodeForClub, getGameCodeForPlayer} from '@src/utils/uniqueid';
import {
  publishNewGame,
  playerConfigUpdate,
  resumeGame,
  endGame,
} from '@src/gameserver';
import {startTimer, cancelTimer} from '@src/timer';
import {fixQuery, getDistanceInMeters} from '@src/utils';
import {WaitListMgmt} from './waitlist';
import {Reward} from '@src/entity/player/reward';
import {ChipsTrackRepository} from './chipstrack';
import {
  BREAK_TIMEOUT,
  BUYIN_TIMEOUT,
  DEALER_CHOICE_TIMEOUT,
  NewUpdate,
} from './types';
import {Cache} from '@src/cache/index';
import {StatsRepository} from './stats';
import {getAgoraToken} from '@src/3rdparty/agora';
import {utcTime} from '@src/utils';
import _ from 'lodash';
import {JanusSession} from '@src/janus';
import {HandHistory} from '@src/entity/history/hand';
import {Player} from '@src/entity/player/player';
import {Club} from '@src/entity/player/club';
import {PlayerGameStats} from '@src/entity/history/stats';
import {HistoryRepository} from './history';
import {GameHistory} from '@src/entity/history/game';
import {PlayersInGame} from '@src/entity/history/player';
import {
  getGameConnection,
  getGameManager,
  getGameRepository,
  getHistoryConnection,
  getHistoryRepository,
  getUserConnection,
  getUserRepository,
} from '.';
import {GameReward, GameRewardTracking} from '@src/entity/game/reward';
import {ClubRepository} from './club';
import {getAppSettings} from '@src/firebase';
import {
  IpAddressMissingError,
  LocationPromixityError,
  SameIpAddressError,
} from '@src/errors';
import {LocationCheck} from './locationcheck';
import {Nats} from '@src/nats';
import {GameSettingsRepository} from './gamesettings';
const logger = getLogger('game');

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

    const gameServerRepository = getGameRepository(GameServer);
    let gameServers: Array<GameServer> = new Array<GameServer>();
    if (useGameServer) {
      gameServers = await gameServerRepository.find();
      if (gameServers.length === 0) {
        throw new Error('No game server is availabe');
      }
    }

    // create the game
    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];

    // validate data
    const minActionTime = 10;
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
    game.hostId = player.id;
    game.hostName = player.name;
    game.hostUuid = player.uuid;

    let saveTime, saveUpdateTime, publishNewTime;
    try {
      //logger.info('****** STARTING TRANSACTION TO CREATE a private game');

      await getGameManager().transaction(async transactionEntityManager => {
        saveTime = new Date().getTime();
        savedGame = await transactionEntityManager
          .getRepository(PokerGame)
          .save(game);
        game.id = savedGame.id;

        saveTime = new Date().getTime() - saveTime;
        if (!game.isTemplate) {
          // create an entry in the history table
          await HistoryRepository.newGameCreated(game);

          saveUpdateTime = new Date().getTime();
          // create a entry in PokerGameUpdates
          const gameUpdatesRepo = transactionEntityManager.getRepository(
            PokerGameUpdates
          );
          const gameUpdates = new PokerGameUpdates();
          gameUpdates.gameCode = savedGame.gameCode;
          gameUpdates.gameID = savedGame.id;
          const appSettings = getAppSettings();
          gameUpdates.appcoinPerBlock = appSettings.gameCoinsPerBlock;

          if (input.useAgora) {
            gameUpdates.appcoinPerBlock += appSettings.agoraCoinsPerBlock;
          }
          if (input.bombPotEnabled) {
            // set current time as last bomb pot time
            gameUpdates.lastBombPotTime = new Date();

            // first hand is bomb pot hand
            gameUpdates.bombPotNextHandNum = 1;
          }
          await GameSettingsRepository.create(
            game.id,
            game.gameCode,
            input,
            transactionEntityManager
          );
          await gameUpdatesRepo.save(gameUpdates);

          saveUpdateTime = new Date().getTime() - saveUpdateTime;
          let pick = 0;
          if (gameServers.length > 0) {
            pick = Number.parseInt(savedGame.id) % gameServers.length;
          }

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
          let scanServer = 0;
          let gameServer;

          if (useGameServer) {
            for (
              scanServer = 0;
              scanServer < gameServers.length;
              scanServer++
            ) {
              // create a new game in game server within the transcation
              try {
                gameServer = gameServers[pick];
                const gameInput = game as any;
                gameInput.rewardTrackingIds = rewardTrackingIds;
                logger.info(
                  `Game server ${gameServer.toString()} is requested to host ${
                    game.gameCode
                  }`
                );
                tableStatus = await publishNewGame(
                  gameInput,
                  gameServer,
                  false
                );
                logger.info(
                  `Game ${game.gameCode} is hosted in ${gameServer.toString()}`
                );
                break;
              } catch (err) {
                logger.warn(
                  `Game Id: ${savedGame.id} cannot be hosted by game server: ${gameServer.url}`
                );
              }
              gameServer = null;
              pick++;
              if (pick === gameServers.length) {
                pick = 0;
              }
            }
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

          if (useGameServer) {
            const trackgameServerRepository = transactionEntityManager.getRepository(
              TrackGameServer
            );
            const trackServer = new TrackGameServer();
            trackServer.game = savedGame;
            trackServer.gameServer = gameServers[pick];
            await trackgameServerRepository.save(trackServer);
          }
        }
      });

      await GameSettingsRepository.get(game.gameCode, true);
      await Cache.getGameUpdates(game.gameCode, true);
      //logger.info('****** ENDING TRANSACTION TO CREATE a private game');
      logger.info(
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
          pgu.players_in_waitlist as "waitlistCount", 
          pgu.players_in_seats as "tableCount", 
          g.game_status as "gameStatus",
          pgt.status as "playerStatus",
          pgu.hand_num as "handsDealt"
        FROM poker_game as g JOIN poker_game_updates as pgu ON 
        g.id = pgu.game_id 
        LEFT OUTER JOIN 
          player_game_tracker as pgt ON
          pgt.pgt_player_id = ${player.id} AND
          pgt.pgt_game_id  = g.id
        where
        g.game_status NOT IN (${GameStatus.ENDED}) AND
        g.club_id IN (${clubIdsIn})`;
    //console.log(query);
    // EXTRACT(EPOCH FROM (now()-g.started_at)) as "elapsedTime",  Showing some error
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
          pgu.players_in_waitlist as "waitlistCount", 
          pgu.players_in_seats as "tableCount", 
          g.game_status as "gameStatus",
          pgt.status as "playerStatus",
          pgu.hand_num as "handsDealt"
        FROM poker_game as g JOIN poker_game_updates as pgu ON 
        g.id = pgu.game_id 
        LEFT OUTER JOIN 
          player_game_tracker as pgt ON
          pgt.pgt_player_id = ${player.id} AND
          pgt.pgt_game_id  = g.id
        where
        g.game_status NOT IN (${GameStatus.ENDED}) AND
        g.host_id = ${player.id}`;
    //console.log(query);
    // EXTRACT(EPOCH FROM (now()-g.started_at)) as "elapsedTime",  Showing some error
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

  public async seatOccupied(
    game: PokerGame,
    seatNo: number,
    transManager?: EntityManager
  ) {
    let gameUpdatesRepo: Repository<PokerGameUpdates>;
    let playerGameTrackerRepo: Repository<PlayerGameTracker>;
    if (transManager) {
      gameUpdatesRepo = transManager.getRepository(PokerGameUpdates);
      playerGameTrackerRepo = transManager.getRepository(PlayerGameTracker);
    } else {
      gameUpdatesRepo = getGameRepository(PokerGameUpdates);
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
          PlayerStatus.NEED_TO_POST_BLIND,
        ]),
      },
    });

    const gameUpdateProps: any = {playersInSeats: count};
    gameUpdateProps[`seat${seatNo}`] = SeatStatus.OCCUPIED;
    await gameUpdatesRepo.update(
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
    let gameUpdatesRepo: Repository<PokerGameUpdates>;
    let playerGameTrackerRepo: Repository<PlayerGameTracker>;
    if (transManager) {
      gameUpdatesRepo = transManager.getRepository(PokerGameUpdates);
      playerGameTrackerRepo = transManager.getRepository(PlayerGameTracker);
    } else {
      gameUpdatesRepo = getGameRepository(PokerGameUpdates);
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
          PlayerStatus.NEED_TO_POST_BLIND,
        ]),
      },
    });

    const gameUpdateProps: any = {playersInSeats: count};
    gameUpdateProps[`seat${seatNo}`] = SeatStatus.OPEN;
    await gameUpdatesRepo.update(
      {
        gameID: game.id,
      },
      gameUpdateProps
    );
    await Cache.getGameUpdates(game.gameCode, true);
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
        // get game updates
        const gameUpdateRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );

        const gameUpdate = await gameUpdateRepo.findOne({gameID: game.id});
        if (!gameUpdate) {
          logger.error(`Game status is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game status is not found for game: ${game.gameCode}`
          );
        }
        if (gameUpdate.seatChangeInProgress) {
          throw new Error(
            `Seat change is in progress for game: ${game.gameCode}`
          );
        }
        const gameSettings = await GameSettingsRepository.get(game.gameCode);
        if (!gameSettings) {
          logger.error(`Game settings is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game settings is not found for game: ${game.gameCode}`
          );
        }

        if (gameSettings.gpsCheck || gameSettings.ipCheck) {
          const locationCheck = new LocationCheck(game, gameSettings);
          await locationCheck.checkForOnePlayer(player, ip, location);
        }

        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );

        if (gameUpdate.waitlistSeatingInprogress) {
          // wait list seating in progress
          // only the player who is asked from the waiting list can sit here
          await waitlistMgmt.seatPlayer(player, seatNo);
        }

        // player is taking a seat in the game
        // ensure the seat is available
        // create a record in the player_game_tracker
        // set the player status to waiting_for_buyin
        // send a message to game server that a new player is in the seat
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
          playerInGame.runItTwicePrompt = gameSettings.runItTwiceAllowed;
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
              playerInGame.audioToken = await this.getAudioToken(
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
          }
        );
        await this.seatOccupied(game, seatNo, transactionEntityManager);
        if (playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN) {
          await this.startBuyinTimer(
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
    let timeTaken = new Date().getTime() - startTime;
    logger.info(`joingame database time taken: ${timeTaken}`);
    startTime = new Date().getTime();
    if (newPlayer) {
      await Cache.removeGameObserver(game.gameCode, player);
      // send a message to gameserver
      //newPlayerSat(game, player, seatNo, playerInGame);
      Nats.newPlayerSat(game, player, playerInGame, seatNo);

      // continue to run wait list seating
      waitlistMgmt.runWaitList();
    }

    if (playerInGame.status === PlayerStatus.PLAYING) {
      await GameRepository.restartGameIfNeeded(game, true, false);
    }

    timeTaken = new Date().getTime() - startTime;
    logger.info(`joingame server notification time taken: ${timeTaken}`);
    startTime = new Date().getTime();
    return playerInGame.status;
  }

  public async myGameState(
    player: Player,
    game: PokerGame
  ): Promise<PlayerGameTracker> {
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

  public async leaveGame(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('status')
      .addSelect('session_time', 'sessionTime')
      .addSelect('sat_at', 'satAt')
      .addSelect('seat_no', 'seatNo')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];

    if (
      game.status === GameStatus.ACTIVE &&
      playerInGame.status === PlayerStatus.PLAYING
    ) {
      const update = new NextHandUpdates();
      update.game = game;
      update.playerId = player.id;
      update.playerUuid = player.uuid;
      update.playerName = player.name;
      update.newUpdate = NextHandUpdate.LEAVE;
      await nextHandUpdatesRepository.save(update);
    } else {
      playerInGame.status = PlayerStatus.NOT_PLAYING;
      const seatNo = playerInGame.seatNo;
      playerInGame.seatNo = 0;
      const setProps: any = {
        status: PlayerStatus.NOT_PLAYING,
        seatNo: 0,
      };

      if (playerInGame.satAt) {
        const satAt = new Date(Date.parse(playerInGame.satAt.toString()));
        // calculate session time
        let sessionTime = playerInGame.sessionTime;
        const currentSessionTime = new Date().getTime() - satAt.getTime();
        const roundSeconds = Math.round(currentSessionTime / 1000);
        sessionTime = sessionTime + roundSeconds;
        logger.info(
          `Session Time: Player: ${player.id} sessionTime: ${sessionTime}`
        );
        setProps.satAt = undefined;
        setProps.sessionTime = sessionTime;
      }
      await playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          playerId: player.id,
        },
        setProps
      );

      await GameRepository.seatOpened(game, seatNo);

      // playerLeftGame(game, player, seatNo);
    }
    return true;
  }

  public async sitBack(
    player: Player,
    game: PokerGame,
    ip: string,
    location: any
  ): Promise<boolean> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('stack')
      .select('status')
      .select('seat_no', 'seatNo')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    if (!playerInGame) {
      logger.error(`Game: ${game.gameCode} not available`);
      throw new Error(`Game: ${game.gameCode} not available`);
    }
    const gameSettings = await GameSettingsRepository.get(game.gameCode);
    if (!gameSettings) {
      throw new Error(
        `Game: ${game.gameCode} is not found in PokerGameSettings`
      );
    }
    if (gameSettings.gpsCheck || gameSettings.ipCheck) {
      const locationCheck = new LocationCheck(game, gameSettings);
      await locationCheck.checkForOnePlayer(player, ip, location);
    }

    cancelTimer(game.id, player.id, BREAK_TIMEOUT);

    // if (playerInGame.status === PlayerStatus.IN_BREAK) {
    //   if (game.status === GameStatus.ACTIVE) {
    //     const update = new NextHandUpdates();
    //     update.game = game;
    //     update.player = player;
    //     update.newUpdate = NextHandUpdate.BACK_FROM_BREAK;
    //     await nextHandUpdatesRepository.save(update);
    //   } else {
    playerInGame.status = PlayerStatus.PLAYING;
    playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        playerId: player.id,
      },
      {
        status: playerInGame.status,
        breakTimeExpAt: undefined,
      }
    );

    // update the clients with new status
    await Nats.playerStatusChanged(
      game,
      player,
      playerInGame.status,
      NewUpdate.SIT_BACK,
      playerInGame.stack,
      playerInGame.seatNo
    );
    const nextHandUpdate = await nextHandUpdatesRepository.findOne({
      where: {
        game: {id: game.id},
        playerId: player.id,
        newUpdate: NextHandUpdate.TAKE_BREAK,
      },
    });

    if (nextHandUpdate) {
      await nextHandUpdatesRepository.delete({id: nextHandUpdate.id});
    }
    await this.restartGameIfNeeded(game, true, false);
    return true;
  }

  public async restartGameIfNeeded(
    game: PokerGame,
    processPendingUpdates: boolean,
    hostStartedGame: boolean,
    transactionEntityManager?: EntityManager
  ): Promise<void> {
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
        const gameRepo = getGameRepository(PokerGame);
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
              await getGameConnection()
                .createQueryBuilder()
                .update(PokerGame)
                .set({
                  tableStatus: newTableStatus,
                })
                .where('id = :id', {id: game.id})
                .execute();

              game = await Cache.getGame(game.gameCode, true);
            }
          }

          // if game is active, there are more players in playing status, resume the game again
          if (
            row.status === GameStatus.ACTIVE &&
            newTableStatus === TableStatus.GAME_RUNNING
          ) {
            await this.updateAppcoinNextConsumeTime(game);

            // update game status
            await gameRepo.update(
              {
                id: game.id,
              },
              {
                tableStatus: newTableStatus,
              }
            );
            if (
              (processPendingUpdates && newTableStatus !== prevTableStatus) ||
              hostStartedGame
            ) {
              // refresh the cache
              const gameUpdate = await Cache.getGame(game.gameCode, true);
              // resume the game
              await resumeGame(gameUpdate.id);
            }
          }
        }
      } catch (err) {
        logger.error(`Error handling buyin approval. ${err.toString()}`);
      }
    }
  }

  public async updateAppcoinNextConsumeTime(game: PokerGame) {
    if (!game.appCoinsNeeded) {
      return;
    }

    try {
      // update next consume time
      const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
      const gameUpdateRow = await gameUpdatesRepo.findOne({
        gameID: game.id,
      });
      if (!gameUpdateRow) {
        return;
      }
      if (!gameUpdateRow.nextCoinConsumeTime) {
        const freeTime = getAppSettings().freeTime;
        const now = new Date();
        const nextConsumeTime = new Date(now.getTime() + freeTime * 1000);
        await gameUpdatesRepo.update(
          {
            gameID: game.id,
          },
          {
            nextCoinConsumeTime: nextConsumeTime,
          }
        );
        gameUpdateRow.nextCoinConsumeTime = nextConsumeTime;
      }
      await Cache.getGameUpdates(game.gameCode, true);
      logger.info(
        `[${
          game.gameCode
        }] Next coin consume time: ${gameUpdateRow.nextCoinConsumeTime.toISOString()}`
      );
    } catch (err) {
      logger.error(
        `Failed to update appcoins next consumption time. Error: ${err.toString()}`
      );
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

  public async getGameServer(gameId: number): Promise<GameServer | null> {
    const trackgameServerRepository = getGameRepository(TrackGameServer);
    const gameServer = await trackgameServerRepository.findOne({
      where: {game: {id: gameId}},
    });
    if (!gameServer) {
      return null;
    }
    return gameServer.gameServer;
  }

  public async startGame(player: Player, game: PokerGame): Promise<GameStatus> {
    if (game.status === GameStatus.ENDED) {
      // game that ended cannot be restarted
      logger.error(`Game: ${game.gameCode} is ended. Cannot be restarted`);
    }
    await this.markGameStatus(game.id, GameStatus.ACTIVE);
    return GameStatus.ACTIVE;
  }

  public async markGameActive(
    gameId: number,
    gameNum?: number
  ): Promise<GameStatus> {
    return this.markGameStatus(gameId, GameStatus.ACTIVE, gameNum);
  }

  public async markGameEnded(gameId: number): Promise<GameStatus> {
    const repository = getGameRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }
    const updatesRepo = getGameRepository(PokerGameUpdates);
    const updates = await updatesRepo.findOne({where: {gameID: gameId}});

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
          sessionTime = 0;
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
    const updatedGame = await Cache.getGame(game.gameCode, true);

    // complete books
    await ChipsTrackRepository.settleClubBalances(updatedGame);

    // roll up stats
    await StatsRepository.rollupStats(updatedGame);

    // update player performance
    await StatsRepository.gameEnded(updatedGame, players);

    const ret = this.markGameStatus(gameId, GameStatus.ENDED);
    game.status = GameStatus.ENDED;
    // update history tables
    await HistoryRepository.gameEnded(game, updates);
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

  public async endGameNextHand(player: Player, gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getGameRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getGameConnection().query(query, [
      gameId,
      NextHandUpdate.END_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      nextHandUpdate.playerId = player.id;
      nextHandUpdate.playerName = player.name;
      nextHandUpdate.playerUuid = player.uuid;
      nextHandUpdate.newUpdate = NextHandUpdate.END_GAME;
      repository.save(nextHandUpdate);

      // notify users that the game will end in the next hand
    }
  }

  public async pauseGameNextHand(gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getGameRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getGameConnection().query(query, [
      gameId,
      NextHandUpdate.PAUSE_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      nextHandUpdate.newUpdate = NextHandUpdate.PAUSE_GAME;
      repository.save(nextHandUpdate);

      // notify users that the game will pause in the next hand
    }
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
            })
            .where('id = :id', {id: gameId})
            .execute();
        } else {
          await getGameConnection()
            .createQueryBuilder()
            .update(PokerGame)
            .set({
              tableStatus: TableStatus.GAME_RUNNING,
            })
            .where('id = :id', {id: gameId})
            .execute();
          game.tableStatus = TableStatus.GAME_RUNNING;

          await getGameConnection()
            .createQueryBuilder()
            .update(PokerGame)
            .set({
              gameStarted: true,
            })
            .where('id = :id', {id: gameId})
            .execute();

          // game started

          // update last ip gps check time
          const lastIpCheckTime = new Date();
          await getGameRepository(PokerGameUpdates).update(
            {
              gameID: game.id,
            },
            {
              lastIpGpsCheckTime: lastIpCheckTime,
            }
          );

          await Cache.getGameUpdates(game.gameCode, true);
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

  public async getPlayersInSeats(
    gameId: number,
    transactionManager?: EntityManager
  ): Promise<Array<PlayerGameTracker>> {
    let playerGameTrackerRepo;
    if (transactionManager) {
      playerGameTrackerRepo = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    const resp = await playerGameTrackerRepo.find({
      game: {id: gameId},
      seatNo: Not(0),
    });
    return resp;
  }

  public async getSeatInfo(
    gameId: number,
    seatNo: number,
    transactionManager?: EntityManager
  ): Promise<any> {
    let playerGameTrackerRepo;
    if (transactionManager) {
      playerGameTrackerRepo = transactionManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    const resp = await playerGameTrackerRepo.findOne({
      game: {id: gameId},
      seatNo: seatNo,
    });
    return resp;
  }

  public async getGamePlayerState(
    game: PokerGame,
    player: Player
  ): Promise<PlayerGameTracker | null> {
    const repo = getGameRepository(PlayerGameTracker);
    const resp = await repo.find({
      playerId: player.id,
      game: {id: game.id},
    });
    return resp[0];
  }

  public async kickOutPlayer(gameCode: string, player: Player) {
    await getGameManager().transaction(async transactionEntityManager => {
      // find game
      const game = await this.getGameByCode(gameCode, transactionEntityManager);
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: {id: game.id},
          playerId: player.id,
        },
      });

      if (!playerInGame) {
        // player is not in game
        throw new Error(`Player ${player.name} is not in the game`);
      }

      if (game.tableStatus !== TableStatus.GAME_RUNNING) {
        // we can mark the user as KICKED_OUT from the player game tracker
        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          {
            seatNo: 0,
            status: PlayerStatus.KICKED_OUT,
          }
        );
        const count = await playerGameTrackerRepository.count({
          where: {
            game: {id: game.id},
            status: PlayerStatus.PLAYING,
          },
        });

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await gameUpdatesRepo.update(
          {
            gameID: game.id,
          },
          {playersInSeats: count}
        );
        await Cache.getGameUpdates(game.gameCode, true);

        Nats.playerKickedOut(game, player, playerInGame.seatNo);
      } else {
        // game is running, so kickout the user in next hand
        // deal with this in the next hand update
        const nextHandUpdatesRepository = transactionEntityManager.getRepository(
          NextHandUpdates
        );
        const update = new NextHandUpdates();
        update.game = game;
        update.playerId = player.id;
        update.playerUuid = player.uuid;
        update.playerName = player.name;
        update.newUpdate = NextHandUpdate.KICKOUT;
        await nextHandUpdatesRepository.save(update);
      }
    });
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
        pgt.rake_paid AS "rakePaid",
        pgt.sat_at AS "satAt",
        pgt.player_name AS "playerName",
        pgt.player_uuid AS "playerId"
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

  public async getAudioToken(
    player: Player,
    game: PokerGame,
    transactionEntityManager?: EntityManager
  ): Promise<string> {
    let playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    if (transactionEntityManager) {
      playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
    }
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('audio_token')
      .addSelect('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }
    let token;
    if (rows && rows.length >= 1) {
      const playerInGame = rows[0];
      token = playerInGame.audio_token;
    }

    // TODO: agora will be used only for the player who are in the seats
    // if the player is not playing, then the player cannot join
    // if (playerInGame.status !== PlayerStatus.PLAYING) {
    //   return '';
    // }

    if (!token) {
      token = await getAgoraToken(game.gameCode, player.id);

      if (rows && rows.length === 1) {
        // update the record
        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          {
            audioToken: token,
          }
        );
      }
    }

    return token;
  }

  public async updatePlayerGameConfig(
    player: Player,
    game: PokerGame,
    config: any
  ): Promise<void> {
    await getGameManager().transaction(async transactionEntityManager => {
      const updates: any = {};
      if (config.muckLosingHand !== undefined) {
        updates.muckLosingHand = config.muckLosingHand;
      }
      if (config.runItTwicePrompt !== undefined) {
        updates.runItTwicePrompt = config.runItTwicePrompt;
      }

      // get game updates
      const gameUpdateRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      let row = await gameUpdateRepo.findOne({
        game: {id: game.id},
        playerId: player.id,
      });
      if (row !== null) {
        await gameUpdateRepo.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          updates
        );
      } else {
        // create a row
        const playerTrack = new PlayerGameTracker();
        playerTrack.game = game;
        playerTrack.playerId = player.id;
        playerTrack.playerUuid = player.uuid;
        playerTrack.playerName = player.name;
        playerTrack.status = PlayerStatus.NOT_PLAYING;
        playerTrack.buyIn = 0;
        playerTrack.stack = 0;
        if (config.muckLosingHand !== undefined) {
          playerTrack.muckLosingHand = config.muckLosingHand;
        }
        if (config.runItTwicePrompt !== undefined) {
          playerTrack.runItTwicePrompt = config.runItTwicePrompt;
        }
        await gameUpdateRepo.save(playerTrack);
      }
      // row = await gameUpdateRepo.findOne({
      //   game: {id: game.id},
      //   playerId: player.id,
      // });

      // if (row) {
      //   const update: any = {
      //     playerId: player.id,
      //     gameId: game.id,
      //     muckLosingHand: row?.muckLosingHand,
      //     runItTwicePrompt: row?.runItTwicePrompt,
      //   };

      //   await playerConfigUpdate(game, update);
      // }
    });
  }

  public async startBuyinTimer(
    game: PokerGame,
    playerId: number,
    playerName: string,
    props?: any,
    transactionEntityManager?: EntityManager
  ) {
    logger.info(
      `[${game.gameCode}] Starting buyin timer for player: ${playerName}`
    );
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;

    if (transactionEntityManager) {
      playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }
    // TODO: start a buy-in timer
    const gameSettingsRepo = getGameRepository(PokerGameSettings);
    const gameSettings = await gameSettingsRepo.findOne({
      gameCode: game.gameCode,
    });
    let timeout = 60;
    if (gameSettings) {
      timeout = gameSettings.buyInTimeout;
    }
    const buyinTimeExp = new Date();
    buyinTimeExp.setSeconds(buyinTimeExp.getSeconds() + timeout);
    const exp = utcTime(buyinTimeExp);
    let setProps: any = {};
    if (props) {
      setProps = _.merge(setProps, props);
    }
    setProps.buyInExpAt = exp;
    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        playerId: playerId,
      },
      setProps
    );

    startTimer(game.id, playerId, BUYIN_TIMEOUT, buyinTimeExp);
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
        await transactionEntityManager
          .getRepository(TrackGameServer)
          .delete({game: {id: game.id}});

        if (!includeGame) {
          await transactionEntityManager
            .getRepository(PokerGame)
            .delete({id: game.id});
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
        await transactionEntityManager
          .getRepository(TrackGameServer)
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
    // cancel the dealer choice timer
    cancelTimer(game.id, 0, DEALER_CHOICE_TIMEOUT);

    logger.info(
      `Game: ${game.gameType} dealers choice: ${gameType.toString()}`
    );
    // update game type in the GameUpdates table
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameID: game.id,
      },
      {
        gameType: gameType,
      }
    );
    await Cache.getGameUpdates(game.gameCode, true);

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
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameID: gameID,
      },
      {
        janusSessionId: sessionId,
        janusPluginHandle: handleId,
        janusRoomId: roomId,
        janusRoomPin: roomPin,
      }
    );
    await Cache.getGameUpdates(gameCode, true);
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

  public async deleteAudioConf(gameID: number) {
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    const gameUpdates = await gameUpdatesRepo.findOne({gameID: gameID});
    if (gameUpdates) {
      if (gameUpdates.janusSessionId && gameUpdates.janusPluginHandle) {
        logger.info(`Deleting janus room: ${gameID}`);
        const session = JanusSession.joinSession(gameUpdates.janusSessionId);
        session.attachAudioWithId(gameUpdates.janusPluginHandle);
        session.deleteRoom(gameID);
        logger.info(`Janus room: ${gameID} is deleted`);
      }
    }
  }

  public async determineGameStatus(gameID: number): Promise<boolean> {
    // if only one player or zero player is active, then mark the game not enough players
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    // get number of players in the seats
    const count = await playerGameTrackerRepo.count({
      where: {
        game: {id: gameID},
        status: PlayerStatus.PLAYING,
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
  }

  public async getSeatStatus(gameID: number): Promise<Array<SeatStatus>> {
    const game = await Cache.getGameById(gameID);
    if (!game) {
      return [];
    }

    const pokerGameUpdatesRepo = getGameRepository(PokerGameUpdates);
    const pokerGameUpdates = await pokerGameUpdatesRepo.findOne({
      gameID: gameID,
    });

    const seatStatuses = new Array<SeatStatus>();
    seatStatuses.push(SeatStatus.UNKNOWN);
    if (pokerGameUpdates) {
      const pokerGameUpdatesAny = pokerGameUpdates as any;
      for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
        seatStatuses.push(pokerGameUpdatesAny[`seat${seatNo}`] as SeatStatus);
      }
    }
    return seatStatuses;
  }
}

export const GameRepository = new GameRepositoryImpl();
