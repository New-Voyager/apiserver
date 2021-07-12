import * as crypto from 'crypto';
import {
  getRepository,
  getManager,
  getConnection,
  In,
  Repository,
  EntityManager,
} from 'typeorm';
import {
  NextHandUpdates,
  PokerGame,
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
} from '@src/entity/types';
import {GameServer, TrackGameServer} from '@src/entity/game/gameserver';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {getGameCodeForClub, getGameCodeForPlayer} from '@src/utils/uniqueid';
import {
  newPlayerSat,
  publishNewGame,
  changeGameStatus,
  playerKickedOut,
  playerSwitchSeat,
  playerConfigUpdate,
  pendingProcessDone,
  playerStatusChanged,
} from '@src/gameserver';
import {startTimer, cancelTimer} from '@src/timer';
import {fixQuery} from '@src/utils';
import {WaitListMgmt} from './waitlist';
import {
  Reward,
  GameRewardTracking,
  GameReward,
  HighHand,
} from '@src/entity/player/reward';
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
    club: Club,
    player: Player,
    input: any,
    template = false
  ): Promise<PokerGame> {
    // // first check whether this user can create a game in this club
    // const clubMemberRepository = getRepository<ClubMember>(ClubMember);

    // const clubRepository = getRepository(Club);
    // const club = await clubRepository.findOne({clubCode: clubCode});
    // if (!club) {
    //   throw new Error(`Club ${clubCode} is not found`);
    // }

    // const playerRepository = getRepository(Player);
    // const player = await playerRepository.findOne({uuid: playerId});
    // if (!player) {
    //   throw new Error(`Player ${playerId} is not found`);
    // }

    // const clubMember = await clubMemberRepository.findOne({
    //   where: {
    //     club: {id: club.id},
    //     player: {id: player.id},
    //   },
    // });
    // if (!clubMember) {
    //   throw new Error(`The player ${playerId} is not in the club`);
    // }
    // if (!(clubMember.isOwner || clubMember.isManager)) {
    //   throw new Error(
    //     `The player ${playerId} is not a owner or a manager of the club`
    //   );
    // }

    // if (clubMember.isManager && clubMember.status !== ClubMemberStatus.ACTIVE) {
    //   throw new Error(
    //     `The player ${playerId} is not an approved manager to create a game`
    //   );
    // }

    const useGameServer = true;

    const gameServerRepository = getRepository(GameServer);
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
    if (gameType == GameType.DEALER_CHOICE) {
      if (
        input.dealerChoiceGames === null ||
        input.dealerChoiceGames.length === 0
      ) {
        throw new Error('dealerChoiceGames must be specified');
      }

      const dealerChoiceGames = input.dealerChoiceGames.toString();
      input['dealerChoiceGames'] = dealerChoiceGames;
    } else if (gameType == GameType.ROE) {
      if (input.roeGames === null || input.roeGames.length === 0) {
        throw new Error('roeGames must be specified');
      }
      const roeGames = input.roeGames.toString();
      input['roeGames'] = roeGames;
    }
    const game: PokerGame = {...input} as PokerGame;
    logger.info(`\n\nCreating new game.. ${game.buyInApproval}\n\n`);
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
      game.gameCode = await getGameCodeForClub(club.clubCode, club.id);
    } else {
      game.gameCode = await getGameCodeForClub(player.id.toString(), 1);
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

      await getManager().transaction(async transactionEntityManager => {
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
          gameUpdates.gameID = savedGame.id;
          await gameUpdatesRepo.save(gameUpdates);
          saveUpdateTime = new Date().getTime() - saveUpdateTime;
          let pick = 0;
          if (gameServers.length > 0) {
            pick = Number.parseInt(savedGame.id) % gameServers.length;
          }

          const rewardTrackingIds = new Array<number>();
          if (input.rewardIds) {
            const rewardRepository = transactionEntityManager.getRepository(
              Reward
            );
            for await (const rewardId of input.rewardIds) {
              if (rewardId == 0) {
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
                reward: {id: rewardId},
                active: true,
              });
              if (!rewardTrack) {
                const createRewardTrack = new GameRewardTracking();
                createRewardTrack.reward = reward;
                createRewardTrack.day = new Date();

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
                tableStatus = await publishNewGame(gameInput, gameServer);
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

  public async createPrivateGameForPlayer(
    playerId: string,
    input: any,
    template = false
  ): Promise<PokerGame> {
    const playerRepository = getRepository(Player);
    const player = await playerRepository.findOne({uuid: playerId});
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }

    const gameServerRepository = getRepository(GameServer);
    const gameServers = await gameServerRepository.find();
    if (gameServers.length === 0) {
      throw new Error('No game server is availabe');
    }

    // create the game
    const game: PokerGame = {...input} as PokerGame;
    const gameTypeStr: string = input['gameType'];
    const gameType: GameType = GameType[gameTypeStr];
    game.gameType = gameType;
    game.isTemplate = template;
    game.status = GameStatus.CONFIGURED;
    game.hostId = player.id;
    game.hostUuid = player.uuid;
    game.hostName = player.name;
    game.gameCode = await getGameCodeForPlayer(player.id);
    game.privateGame = true;
    game.startedAt = new Date();

    let savedGame;
    try {
      const gameRespository = getRepository(PokerGame);
      await getManager().transaction(async transactionEntityManager => {
        savedGame = await transactionEntityManager
          .getRepository(PokerGame)
          .save(game);

        const pick = savedGame.id % gameServers.length;
        const trackServer = new TrackGameServer();
        trackServer.game = savedGame;
        trackServer.gameServer = gameServers[pick];
        await transactionEntityManager
          .getRepository(TrackGameServer)
          .save(trackServer);
      });
    } catch (err) {
      logger.error("Couldn't create game and retry again");
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
      repository = getRepository(PokerGame);
    }

    // get game by id (testing only)
    const game = await repository.findOne({where: {gameCode: gameCode}});
    return game;
  }

  public async getGameCountByClubId(clubId: number): Promise<number> {
    const repository = getRepository(PokerGame);
    const count = await repository.count({where: {clubId: clubId}});
    return count;
  }

  public async getGameCountByPlayerId(playerId: number): Promise<number> {
    const repository = getRepository(PokerGame);
    const count = await repository.count({where: {hostId: playerId}});
    return count;
  }

  public async getLiveGames(playerId: string) {
    // get the list of live games associated with player clubs
    const query = `
          WITH my_clubs AS (SELECT DISTINCT c.*, p.id as "player_id" FROM club as c JOIN club_member as cm ON
            c.id  = cm.club_id JOIN player as p ON 
            cm.player_id = p.id AND 
            p.uuid = '${playerId}' AND
            c.status = ${ClubStatus.ACTIVE} AND cm.status = ${ClubMemberStatus.ACTIVE})
          SELECT 
            c.club_code as "clubCode", 
            c.name as "clubName", 
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
            g.max_waitlist as "maxWaitList", 
            pgu.players_in_waitlist as "waitlistCount", 
            pgu.players_in_seats as "tableCount", 
            g.game_status as "gameStatus",
            pgt.status as "playerStatus",
            pgu.hand_num as "handsDealt"
          FROM poker_game as g JOIN poker_game_updates as pgu ON 
          g.id = pgu.game_id JOIN my_clubs as c ON 
            g.club_id = c.id 
            AND g.game_status NOT IN (${GameStatus.ENDED})
          LEFT OUTER JOIN 
            player_game_tracker as pgt ON
            pgt.pgt_player_id = c.player_id AND
            pgt.pgt_game_id  = g.id`;

    // EXTRACT(EPOCH FROM (now()-g.started_at)) as "elapsedTime",  Showing some error
    const resp = await getConnection().query(query);
    return resp;
  }

  public async getPastGames(playerId: string) {
    // get the list of past games associated with player clubs
    const query = `
          WITH my_clubs AS (SELECT DISTINCT c.*, p.id player_id FROM club c JOIN club_member cm ON
            c.id  = cm.club_id JOIN player p ON 
            cm.player_id = p.id AND 
            p.uuid = '${playerId}' AND
            c.status = ${ClubStatus.ACTIVE} AND cm.status = ${ClubMemberStatus.ACTIVE})
          SELECT 
            c.club_code as "clubCode", 
            c.name as "clubName", 
            g.game_code as "gameCode", 
            g.id as gameId, 
            g.title as title, 
            g.game_type as "gameType", 
            g.buy_in_min as "buyInMin", 
            g.buy_in_max as "buyInMax", 
            EXTRACT(EPOCH FROM(g.ended_at-g.started_at)) as "gameTime", 
            g.started_at as "startedAt", 
            g.ended_at as "endedAt",
            g.max_players as "maxPlayers", 
            g.max_waitlist as "maxWaitList", 
            pgt.status as "playerStatus",
            pgt.session_time as "sessionTime",
            pgt.buy_in as "buyIn",
            pgt.stack as "stack",
            pgu.hand_num as "handsDealt"
          FROM poker_game g JOIN poker_game_updates pgu ON 
          g.id = pgu.game_id JOIN my_clubs c 
          ON 
            g.club_id = c.id 
            AND g.game_status = ${GameStatus.ENDED}
          LEFT OUTER JOIN 
            player_game_tracker pgt ON
            pgt.pgt_player_id = c.player_id AND
            pgt.pgt_game_id  = g.id
        `;
    const resp = await getConnection().query(query);
    return resp;
  }

  public async getNextGameServer(): Promise<number> {
    const query = 'SELECT max(server_num)+1 next_number FROM game_server';
    const resp = await getConnection().query(query);
    let nextNumber = 1;
    if (resp[0]['next_number']) {
      nextNumber = resp[0]['next_number'];
    }
    return nextNumber;
  }

  public async joinGame(
    player: Player,
    game: PokerGame,
    seatNo: number
  ): Promise<PlayerStatus> {
    if (seatNo > game.maxPlayers) {
      throw new Error('Invalid seat number');
    }
    const waitlistMgmt = new WaitListMgmt(game);
    let startTime = new Date().getTime();
    const [playerInGame, newPlayer] = await getManager().transaction(
      async transactionEntityManager => {
        // get game updates
        const gameUpdateRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );

        const gameUpdates = await gameUpdateRepo
          .createQueryBuilder()
          .where({
            gameID: game.id,
          })
          .select('seat_change_inprogress', 'seatChangeInProgress')
          .addSelect('waitlist_seating_inprogress', 'waitlistSeatingInprogress')
          .execute();

        if (gameUpdates.length == 0) {
          logger.error(`Game status is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game status is not found for game: ${game.gameCode}`
          );
        }
        const gameUpdate = gameUpdates[0];

        if (gameUpdate.seatChangeInProgress) {
          throw new Error(
            `Seat change is in progress for game: ${game.gameCode}`
          );
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
          playerInGame.runItTwicePrompt = game.runItTwiceAllowed;
          playerInGame.muckLosingHand = game.muckLosingHand;

          if (game.status == GameStatus.ACTIVE) {
            // player must post blind
            playerInGame.missedBlind = true;
          }

          try {
            await playerGameTrackerRepository.save(playerInGame);
            await StatsRepository.joinedNewGame(player);
            // create a row in stats table
            await StatsRepository.newGameStatsRow(
              game,
              player,
              transactionEntityManager
            );
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

        // get number of players in the seats
        const count = await playerGameTrackerRepository.count({
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

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await gameUpdatesRepo.update(
          {
            gameID: game.id,
          },
          {playersInSeats: count}
        );

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
      newPlayerSat(game, player, seatNo, playerInGame);

      // continue to run wait list seating
      waitlistMgmt.runWaitList();
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
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
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
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
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
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('status')
      .addSelect('session_time', 'sessionTime')
      .addSelect('sat_at', 'satAt')
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
      playerInGame.seatNo = 0;

      const satAt = new Date(Date.parse(playerInGame.satAt.toString()));
      // calculate session time
      let sessionTime = playerInGame.sessionTime;
      const currentSessionTime = new Date().getTime() - satAt.getTime();
      const roundSeconds = Math.round(currentSessionTime / 1000);
      sessionTime = sessionTime + roundSeconds;
      logger.info(
        `Session Time: Player: ${player.id} sessionTime: ${sessionTime}`
      );
      await playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          playerId: player.id,
        },
        {
          status: PlayerStatus.NOT_PLAYING,
          seatNo: 0,
          satAt: undefined,
          sessionTime: sessionTime,
        }
      );

      // playerLeftGame(game, player, seatNo);
    }
    return true;
  }

  public async sitBack(player: Player, game: PokerGame): Promise<boolean> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const nextHandUpdatesRepository = getRepository(NextHandUpdates);
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
    await playerStatusChanged(
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
    await this.restartGameIfNeeded(game);
    return true;
  }

  public async restartGameIfNeeded(
    game: PokerGame,
    transactionEntityManager?: EntityManager
  ): Promise<void> {
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (transactionEntityManager) {
      playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
    } else {
      playerGameTrackerRepository = getRepository(PlayerGameTracker);
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
        const gameRepo = getRepository(PokerGame);
        const rows = await gameRepo
          .createQueryBuilder()
          .where({id: game.id})
          .select('game_status', 'status')
          .addSelect('table_status', 'tableStatus')
          .execute();
        if (rows) {
          const row = rows[0];

          // if game is active, there are more players in playing status, resume the game again
          if (
            row.status === GameStatus.ACTIVE &&
            row.tableStatus === TableStatus.NOT_ENOUGH_PLAYERS
          ) {
            // update game status
            await gameRepo.update(
              {
                id: game.id,
              },
              {
                tableStatus: TableStatus.GAME_RUNNING,
              }
            );
            // refresh the cache
            const gameUpdate = await Cache.getGame(game.gameCode, true);

            // resume the game
            await pendingProcessDone(
              gameUpdate.id,
              gameUpdate.status,
              gameUpdate.tableStatus
            );
          }
        }
      } catch (err) {
        logger.error(`Error handling buyin approval. ${err.toString()}`);
      }
    }
  }

  public async updateBreakTime(playerId: number, gameId: number) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
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
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);

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
    const trackgameServerRepository = getRepository(TrackGameServer);
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
    const repository = getRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }
    const updatesRepo = getRepository(PokerGameUpdates);
    const updates = await updatesRepo.findOne({where: {gameID: gameId}});

    // update player game tracker
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;

    // update session time
    playerGameTrackerRepository = getRepository(PlayerGameTracker);
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

    // update history tables
    await HistoryRepository.gameEnded(game, updates);

    return this.markGameStatus(gameId, GameStatus.ENDED);
  }

  public async anyPendingUpdates(gameId: number): Promise<boolean> {
    const game = await Cache.getGameById(gameId);
    if (game && game.pendingUpdates) {
      return true;
    }

    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ?'
    );
    const resp = await getConnection().query(query, [gameId]);
    if (resp[0]['updates'] > 0) {
      return true;
    }
    return false;
  }

  public async endGameNextHand(gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getConnection().query(query, [
      gameId,
      NextHandUpdate.END_GAME,
    ]);
    if (resp[0]['updates'] === 0) {
      const nextHandUpdate = new NextHandUpdates();
      const game = new PokerGame();
      game.id = gameId;
      nextHandUpdate.game = game;
      nextHandUpdate.newUpdate = NextHandUpdate.END_GAME;
      repository.save(nextHandUpdate);

      // notify users that the game will end in the next hand
    }
  }

  public async pauseGameNextHand(gameId: number) {
    // check to see if the game is already marked to be ended
    const repository = getRepository(NextHandUpdates);
    const query = fixQuery(
      'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
    );
    const resp = await getConnection().query(query, [
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
    const repository = getRepository(PokerGame);
    const playersInGame = getRepository(PlayerGameTracker);
    const game = await repository.findOne({where: {id: gameId}});
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

    await getConnection()
      .createQueryBuilder()
      .update(PokerGame)
      .set(values)
      .where('id = :id', {id: gameId})
      .execute();

    // update the game server with new status
    await changeGameStatus(game, status, game.tableStatus);

    // if game ended
    if (status === GameStatus.ENDED) {
      // complete books
      await ChipsTrackRepository.settleClubBalances(game);

      // roll up stats
      await StatsRepository.rollupStats(game);

      // update player performance
      await StatsRepository.gameEnded(game, players);

      // destroy Janus game
      try {
        //await this.deleteAudioConf(game.id);
      } catch (err) {}
    }

    // update cached game
    await Cache.getGame(game.gameCode, true /** update */);
    return status;
  }

  public async markTableStatus(gameId: number, status: TableStatus) {
    const repository = getRepository(PokerGame);
    const game = await repository.findOne({where: {id: gameId}});
    if (!game) {
      throw new Error(`Game: ${gameId} is not found`);
    }
    //this stores string value
    // const tableStatusValue = TableStatus[status.toString()];
    await getConnection()
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
  ): Promise<Array<any>> {
    const query = fixQuery(`SELECT p.id as "playerId", name, uuid as "playerUuid", p.is_bot as "isBot",
          buy_in as "buyIn", stack, status, seat_no as "seatNo", status,
          buyin_exp_at as "buyInExpTime", break_time_exp_at as "breakExpTime", game_token AS "gameToken",
          break_time_started_at as "breakStartedTime",
          run_it_twice_prompt as "runItTwicePrompt",
          muck_losing_hand as "muckLosingHand",
          missed_blind as "missedBlind",
          posted_blind as "postedBlind"
          FROM 
          player_game_tracker pgt JOIN player p ON pgt.pgt_player_id = p.id
          AND pgt.pgt_game_id = ? AND pgt.seat_no <> 0`);
    let resp;
    if (transactionManager) {
      resp = await transactionManager.query(query, [gameId]);
    } else {
      resp = await getConnection().query(query, [gameId]);
    }
    return resp;
  }

  public async getGamePlayerState(
    game: PokerGame,
    player: Player
  ): Promise<PlayerGameTracker | null> {
    const repo = getRepository(PlayerGameTracker);
    const resp = await repo.find({
      playerId: player.id,
      game: {id: game.id},
    });
    return resp[0];
  }

  public async kickOutPlayer(gameCode: string, player: Player) {
    await getManager().transaction(async transactionEntityManager => {
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
        // notify game server, player is kicked out
        playerKickedOut(game, player, playerInGame.seatNo);
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

  public async getGameUpdates(
    gameID: number
  ): Promise<PokerGameUpdates | undefined> {
    return await getRepository(PokerGameUpdates).findOne({gameID: gameID});
  }

  public async getCompletedGame(
    gameCode: string,
    playerId: number
  ): Promise<any> {
    const query = fixQuery(`
    SELECT pg.id, pg.game_code as "gameCode", pg.game_num as "gameNum",
    pgt.session_time as "sessionTime", pg.game_status as "status",
    pg.small_blind as "smallBlind", pg.big_blind as "bigBlind",
    pgt.no_hands_played as "handsPlayed", 
    pgt.no_hands_won as "handsWon", in_flop as "flopHands", in_turn as "turnHands",
    pgt.buy_in as "buyIn", (pgt.stack - pgt.buy_in) as "profit",
    in_preflop as "preflopHands", in_river as "riverHands", went_to_showdown as "showdownHands", 
    big_loss as "bigLoss", big_win as "bigWin", big_loss_hand as "bigLossHand", 
    big_win_hand as "bigWinHand", hand_stack,
    pg.game_type as "gameType", 
    pg.started_at as "startedAt", pg.host_name as "startedBy",
    pg.ended_at as "endedAt", pg.ended_by_name as "endedBy", 
    pg.started_at as "startedAt", pgt.session_time as "sessionTime", 
    pgt.stack as balance,
    pgu.hand_num as "handsDealt"
    FROM
    poker_game pg 
    JOIN poker_game_updates pgu ON pg.id = pgu.game_id
    LEFT OUTER JOIN player_game_tracker pgt ON 
    pgt.pgt_game_id = pg.id AND pgt.pgt_player_id = ?
    LEFT OUTER JOIN player_game_stats pgs ON 
    pgs.game_id = pg.id AND pgs.player_id = pgt.pgt_player_id
    WHERE
    pg.game_code = ?
    `);

    // TODO: we need to do pagination here
    const result = await getConnection().query(query, [playerId, gameCode]);
    if (result.length > 0) {
      return result[0];
    }
    return null;
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

    const result = await getConnection().query(query, [gameCode]);
    return result;
  }

  public async getGamePlayers(gameCode: string): Promise<Array<any>> {
    const query = fixQuery(`
    SELECT pgt.pgt_player_id AS "id", pgt.player_name AS "name", pgt.player_uuid AS "uuid"
    FROM player_game_tracker pgt
    JOIN
     poker_game pg ON pgt.pgt_game_id = pg.id
    WHERE pg.game_code = ?`);

    const result = await getConnection().query(query, [gameCode]);
    return result;
  }

  public async getAudioToken(player: Player, game: PokerGame): Promise<string> {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        playerId: player.id,
      })
      .select('audio_token')
      .select('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }

    const playerInGame = rows[0];
    let token = playerInGame.audio_token;

    // TODO: agora will be used only for the player who are in the seats
    // if the player is not playing, then the player cannot join
    // if (playerInGame.status !== PlayerStatus.PLAYING) {
    //   return '';
    // }

    if (!token) {
      token = await getAgoraToken(game.gameCode, player.id);

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

    return token;
  }

  public async switchSeat(
    player: Player,
    game: PokerGame,
    seatNo: number
  ): Promise<PlayerStatus> {
    if (seatNo > game.maxPlayers) {
      throw new Error('Invalid seat number');
    }
    logger.info(
      `[${game.gameCode}] Player: ${player.name} is switching to seat: ${seatNo}`
    );
    const [playerInGame, newPlayer] = await getManager().transaction(
      async transactionEntityManager => {
        // get game updates
        const gameUpdateRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        const gameUpdate = await gameUpdateRepo.findOne({
          where: {
            gameID: game.id,
          },
        });
        if (!gameUpdate) {
          logger.error(`Game status is not found for game: ${game.gameCode}`);
          throw new Error(
            `Game status is not found for game: ${game.gameCode}`
          );
        }
        if (
          gameUpdate.waitlistSeatingInprogress ||
          gameUpdate.seatChangeInProgress
        ) {
          throw new Error(
            `Seat change is in progress for game: ${game.gameCode}`
          );
        }

        const playerGameTrackerRepository = transactionEntityManager.getRepository(
          PlayerGameTracker
        );

        // make sure the seat is available
        let playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: game.id},
            seatNo: seatNo,
          },
        });

        // if there is a player in the seat, return an error

        // if the current player in seat tried to sit in the same seat, do nothing
        if (playerInSeat != null) {
          throw new Error('A player is in the seat');
        }

        // get player's old seat no
        playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: game.id},
            playerId: player.id,
          },
        });
        let oldSeatNo = playerInSeat?.seatNo;
        if (!oldSeatNo) {
          oldSeatNo = 0;
        }

        await playerGameTrackerRepository.update(
          {
            game: {id: game.id},
            playerId: player.id,
          },
          {
            seatNo: seatNo,
          }
        );
        playerInSeat = await playerGameTrackerRepository.findOne({
          where: {
            game: {id: game.id},
            seatNo: seatNo,
          },
        });

        if (!playerInSeat) {
          throw new Error('Switching seat failed');
        }

        // send an update message
        playerSwitchSeat(game, player, playerInSeat, oldSeatNo);
        logger.info(
          `[${game.gameCode}] Player: ${player.name} switched to seat: ${seatNo}`
        );

        return [playerInSeat, true];
      }
    );

    if (!playerInGame) {
      return PlayerStatus.PLAYER_UNKNOWN_STATUS;
    }
    return playerInGame.status;
  }

  public async updateGamePlayerConfig(
    player: Player,
    game: PokerGame,
    config: any
  ): Promise<void> {
    await getManager().transaction(async transactionEntityManager => {
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
      if (row != null) {
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
      row = await gameUpdateRepo.findOne({
        game: {id: game.id},
        playerId: player.id,
      });

      if (row) {
        const update: any = {
          playerId: player.id,
          gameId: game.id,
          muckLosingHand: row?.muckLosingHand,
          runItTwicePrompt: row?.runItTwicePrompt,
        };

        await playerConfigUpdate(game, update);
      }
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
      playerGameTrackerRepository = getRepository(PlayerGameTracker);
    }
    // TODO: start a buy-in timer
    const buyinTimeExp = new Date();
    const timeout = game.buyInTimeout;
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
    await getManager().transaction(async transactionEntityManager => {
      if (gameCode) {
        const gameRepo = transactionEntityManager.getRepository(PokerGame);
        const game = await gameRepo.findOne({gameCode: gameCode});
        if (!game) {
          throw new Error(`Game ${gameCode} is not found`);
        }
        await transactionEntityManager
          .getRepository(PlayerGameTracker)
          .delete({game: {id: game.id}});
        await transactionEntityManager
          .getRepository(PlayerGameStats)
          .delete({gameId: game.id});
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
        await transactionEntityManager
          .getRepository(PlayerGameStats)
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
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameID: game.id,
      },
      {
        gameType: gameType,
      }
    );

    // pending updates done
    await pendingProcessDone(game.id, game.status, game.tableStatus);
  }

  public async updateJanus(
    gameID: number,
    sessionId: string,
    handleId: string,
    roomId: number,
    roomPin: string
  ) {
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
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
  }

  public async updateAudioConfDisabled(gameID: number) {
    const gameUpdatesRepo = getRepository(PokerGame);
    await gameUpdatesRepo.update(
      {id: gameID},
      {
        audioConfEnabled: false,
      }
    );
  }

  public async deleteAudioConf(gameID: number) {
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
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
    const playerGameTrackerRepo = getRepository(PlayerGameTracker);
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
    const gameRepo = getRepository(PokerGame);
    // get number of players in the seats
    const count = await gameRepo.count({
      where: {
        host: {uuid: playerUuid},
        status: In([GameStatus.ACTIVE, GameStatus.CONFIGURED]),
      },
    });
    return count;
  }

  public async getLiveGameCount(club: Club): Promise<number> {
    const gameRepo = getRepository(PokerGame);
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
    const gameTrackerRepo = getRepository(PlayerGameTracker);
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
    const hhrepo = getRepository(HandHistory);
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
    const repository = getRepository(GameHistory);

    // get game by id (testing only)
    const gameHistory = await repository.findOne({where: {gameId: gameId}});
    return gameHistory;
  }

  public async getGameUpdatesById(
    gameId: number
  ): Promise<PokerGameUpdates | undefined> {
    const updatesRepo = getRepository(PokerGameUpdates);
    const updates = await updatesRepo.findOne({where: {gameID: gameId}});
    return updates;
  }

  public async getPlayersInGameById(
    gameId: number
  ): Promise<Array<PlayersInGame> | undefined> {
    const playersInGameRepo = getRepository(PlayersInGame);
    const playersInGame = await playersInGameRepo.find({
      where: {gameId: gameId},
    });
    return playersInGame;
  }

  public async getPlayersGameTrackerById(
    gameId: number
  ): Promise<Array<PlayerGameTracker> | undefined> {
    const playerGameTrackerRepo = getRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.find({
      where: {game: {id: gameId}},
    });
    return playerGameTracker;
  }

  public async postBlind(game: PokerGame, player: Player): Promise<void> {
    const playerGameTrackerRepo = getRepository(PlayerGameTracker);
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
}

export const GameRepository = new GameRepositoryImpl();
