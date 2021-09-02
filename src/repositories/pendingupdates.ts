import {Not, EntityManager, Repository, getRepository} from 'typeorm';
import {fixQuery} from '@src/utils';
import {
  ApprovalStatus,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  SeatStatus,
} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {startTimer} from '@src/timer';
import {occupiedSeats, WaitListMgmt} from './waitlist';
import {SeatChangeProcess} from './seatchange';
import {DEALER_CHOICE_TIMEOUT, NewUpdate} from './types';
import _ from 'lodash';
import {Nats} from '@src/nats';
import {TakeBreak} from './takebreak';
import {Cache} from '@src/cache';
import {BuyIn} from './buyin';
import {reloadApprovalTimeoutExpired} from './timer';
import {Reload} from './reload';
import {getGameConnection, getGameManager, getGameRepository} from '.';
import {Player} from '@src/entity/player/player';
import {LocationCheck} from './locationcheck';
import {GameSettingsRepository} from './gamesettings';
import {resumeGame} from '@src/gameserver';
import {PlayersInGameRepository} from './playersingame';
import {GameUpdatesRepository} from './gameupdates';

const logger = getLogger('pending-updates');

export async function markDealerChoiceNextHand(
  game: PokerGame,
  entityManager?: EntityManager
) {
  let nextHandUpdatesRepository;
  if (entityManager) {
    nextHandUpdatesRepository = entityManager.getRepository(NextHandUpdates);
  } else {
    nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
  }
  const nextHandUpdate = new NextHandUpdates();
  nextHandUpdate.game = game;
  nextHandUpdate.newUpdate = NextHandUpdate.WAIT_FOR_DEALER_CHOICE;
  nextHandUpdatesRepository.save(nextHandUpdate);
}

export async function processPendingUpdates(gameId: number) {
  // this flag indicates whether we need to start seat change process or not
  // seat change is done, only if a player leaves, kicked out, or left due to connection issues
  let newOpenSeat = false;
  let dealerChoiceUpdate: NextHandUpdates | null = null;

  const gameRespository = getGameRepository(PokerGame);
  const game = await gameRespository.findOne({id: gameId});
  if (!game) {
    throw new Error(`Game: ${gameId} is not found`);
  }

  await Cache.updateGamePendingUpdates(game?.gameCode, false);
  const gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
  const gameSeatInfo = await gameSeatInfoRepo.findOne({gameID: game.id});
  if (!gameSeatInfo) {
    return;
  }

  const gameSettings = await GameSettingsRepository.get(game.gameCode);
  if (!gameSettings) {
    return;
  }

  logger.debug(`Processing pending updates for game id: ${game.gameCode}`);
  if (gameSeatInfo.seatChangeInProgress) {
    logger.info(
      `Seat change is in progress for game id: ${game.gameCode}. No updates will be performed.`
    );
    return;
  }

  // if there is an end game update, let us end the game first
  const query = fixQuery(
    'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
  );
  let resp = await getGameConnection().query(query, [
    gameId,
    NextHandUpdate.END_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    const nextHandRepo = getGameRepository(NextHandUpdates);
    const update = await nextHandRepo.findOne({
      game: {id: gameId},
      newUpdate: NextHandUpdate.END_GAME,
    });
    const gameRepo = getGameRepository(PokerGame);
    const endedAt = new Date();
    const result = await gameRepo.update(
      {
        id: gameId,
      },
      {
        endedAt: endedAt,
        endedBy: update?.playerId,
        endedByName: update?.playerName,
      }
    );

    // game ended
    await GameRepository.markGameEnded(gameId);

    // delete hand updates for the game
    await getGameConnection().query(
      fixQuery('DELETE FROM next_hand_updates WHERE game_id=?'),
      [gameId]
    );
    return;
  }

  // did the host paused the game?
  resp = await getGameConnection().query(query, [
    gameId,
    NextHandUpdate.PAUSE_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    logger.info(`Game: ${gameId} is paused`);
    // game paused
    await GameRepository.markGameStatus(gameId, GameStatus.PAUSED);

    // delete hand updates for the game
    await getGameConnection().query(
      fixQuery(
        'DELETE FROM next_hand_updates WHERE game_id=? AND new_update = ?'
      ),
      [gameId, NextHandUpdate.PAUSE_GAME]
    );
    return;
  }

  const pendingUpdatesRepo = getGameRepository(NextHandUpdates);
  const updates = await pendingUpdatesRepo.find({
    where: {
      game: {id: gameId},
    },
  });

  let endPendingProcess = true;
  let seatChangeInProgress = false;
  let openedSeat: number | undefined = 0;
  if (updates.length !== 0) {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    for (const update of updates) {
      // walk through each update
      if (update.newUpdate === NextHandUpdate.SWITCH_SEAT) {
        // switch player
        await switchSeat(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
        newOpenSeat = true;
      } else if (update.newUpdate === NextHandUpdate.KICKOUT) {
        // kick out a player
        openedSeat = await kickoutPlayer(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
        newOpenSeat = true;
      } else if (update.newUpdate === NextHandUpdate.LEAVE) {
        openedSeat = await leaveGame(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
        newOpenSeat = true;
      } else if (update.newUpdate === NextHandUpdate.BUYIN_APPROVED) {
        await buyinApproved(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
      } else if (update.newUpdate === NextHandUpdate.RELOAD_APPROVED) {
        await reloadApproved(game, update, pendingUpdatesRepo);
        continue;
      } else if (update.newUpdate === NextHandUpdate.WAIT_FOR_DEALER_CHOICE) {
        dealerChoiceUpdate = update;
      } else if (update.newUpdate === NextHandUpdate.TAKE_BREAK) {
        const player = await Cache.getPlayerById(update.playerId);
        const takeBreak = new TakeBreak(game, player);
        takeBreak.processPendingUpdate(update);
      }
    }

    let seatChangeAllowed = gameSettings.seatChangeAllowed;
    const seats = await occupiedSeats(game.id);
    seatChangeAllowed = true; // debugging
    if (seatChangeAllowed && openedSeat) {
      if (newOpenSeat && seats <= game.maxPlayers - 1) {
        logger.info(`[${game.gameCode}] Seat Change is in Progress`);
        // open seat
        const seatChangeProcess = new SeatChangeProcess(game);
        const waitingPlayers = await seatChangeProcess.getSeatChangeRequestedPlayers();
        if (waitingPlayers.length > 0) {
          endPendingProcess = false;
          await seatChangeProcess.start(openedSeat);
          seatChangeInProgress = true;
        }
      }
    }
  }

  if (!seatChangeInProgress && gameSettings.waitlistAllowed) {
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.runWaitList();
  }

  if (endPendingProcess) {
    if (gameSettings.gpsCheck || gameSettings.ipCheck) {
      const locationCheck = new LocationCheck(game, gameSettings);
      await locationCheck.check();
    }

    // start buy in timers for the player's whose stack is 0 and playing
    await BuyIn.startBuyInTimers(game);

    // if the game does not have more than 1 active player, then the game cannot continue
    const canContinue = await GameRepository.determineGameStatus(game.id);
    if (canContinue && dealerChoiceUpdate) {
      await handleDealersChoice(game, dealerChoiceUpdate, pendingUpdatesRepo);
    } else {
      const cachedGame = await Cache.getGame(game.gameCode);
      await resumeGame(gameId);
    }
  }
}

async function kickoutPlayer(
  playerGameTrackerRepository: Repository<PlayerGameTracker>,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
): Promise<number> {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });
  if (!playerInGame) {
    return 0;
  }
  // calculate session time
  let sessionTime = playerInGame.sessionTime;
  const currentSessionTime =
    new Date().getTime() - playerInGame.satAt.getTime();
  const roundSeconds = Math.round(currentSessionTime / 1000);
  sessionTime = sessionTime + roundSeconds;

  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      playerId: update.playerId,
    },
    {
      status: PlayerStatus.KICKED_OUT,
      sessionTime: sessionTime,
      seatNo: 0,
      satAt: undefined,
    }
  );

  // do updates that are necessary
  await GameRepository.seatOpened(game, playerInGame.seatNo);

  if (playerInGame) {
    const player = await Cache.getPlayerById(update.playerId);
    Nats.playerKickedOut(game, player, playerInGame.seatNo);
  }
  // delete this update
  pendingUpdatesRepo.delete({id: update.id});
  return playerInGame.seatNo;
}

async function switchSeat(
  playerGameTrackerRepository: Repository<PlayerGameTracker>,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
) {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });
  if (!playerInGame) {
    return;
  }

  try {
    // old seat no
    const oldSeatNo = playerInGame.seatNo;
    const newSeatNo = update.newSeat;
    const player = await Cache.getPlayer(playerInGame.playerUuid);

    await getGameManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      await playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          playerId: update.playerId,
        },
        {
          seatNo: newSeatNo,
        }
      );
      playerInGame.seatNo = newSeatNo;

      // do updates that are necessary
      await GameRepository.seatOccupied(
        game,
        newSeatNo,
        transactionEntityManager
      );
      await GameRepository.seatOpened(
        game,
        oldSeatNo,
        transactionEntityManager
      );
      await Nats.notifyPlayerSwitchSeat(game, player, playerInGame, oldSeatNo);
    });
  } finally {
    // delete this update
    pendingUpdatesRepo.delete({id: update.id});
  }
}

async function leaveGame(
  playerGameTrackerRepository: Repository<PlayerGameTracker>,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
): Promise<number> {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });
  if (!playerInGame) {
    return 0;
  }

  const openedSeat = playerInGame.seatNo;

  let sessionTime = playerInGame.sessionTime;

  if (playerInGame.satAt) {
    // calculate session time
    const satAt = new Date(Date.parse(playerInGame.satAt.toString()));
    const currentSessionTime = new Date().getTime() - satAt.getTime();
    const roundSeconds = Math.round(currentSessionTime / 1000);
    sessionTime = sessionTime + roundSeconds;

    await playerGameTrackerRepository.update(
      {
        game: {id: game.id},
        playerId: update.playerId,
      },
      {
        satAt: undefined,
        sessionTime: sessionTime,
        status: PlayerStatus.LEFT,
        seatNo: 0,
      }
    );
  }

  // do updates that are necessary
  await GameRepository.seatOpened(game, openedSeat);

  if (playerInGame) {
    // notify game server, player is kicked out
    const player = await Cache.getPlayerById(update.playerId);
    Nats.playerLeftGame(game, player, playerInGame.seatNo);
  }
  // delete this update
  pendingUpdatesRepo.delete({id: update.id});
  return openedSeat;
}

async function buyinApproved(
  playerGameTrackerRepository: any,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
) {
  let amount = 0;
  if (update.buyinAmount) {
    amount = update.buyinAmount;
  } else {
    amount = update.reloadAmount;
  }

  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });

  playerInGame.status = PlayerStatus.PLAYING;
  playerInGame.stack += amount;
  playerInGame.buyIn += amount;
  playerInGame.noOfBuyins += 1;
  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      playerId: update.playerId,
    },
    {
      status: playerInGame.status,
      stack: playerInGame.stack,
      buyIn: playerInGame.buyIn,
      noOfBuyins: playerInGame.noOfBuyins,
    }
  );

  if (playerInGame) {
    const player = await Cache.getPlayerById(update.playerId);
    // notify game server, player has a new buyin
    await Nats.playerBuyIn(game, player, playerInGame);
  }
  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});
}

async function reloadApproved(
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
) {
  let amount = 0;
  if (update.buyinAmount) {
    amount = update.buyinAmount;
  } else {
    amount = update.reloadAmount;
  }
  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});

  const player = await Cache.getPlayerById(update.playerId);
  const reload = new Reload(game, player);
  await reload.approvedAndUpdateStack(amount);
}

async function handleDealersChoice(
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo: Repository<NextHandUpdates>
) {
  const dealerChoiceTimeout = new Date();
  const timeout = 10;
  dealerChoiceTimeout.setSeconds(dealerChoiceTimeout.getSeconds() + timeout);

  // start a timer
  startTimer(game.id, 0, DEALER_CHOICE_TIMEOUT, dealerChoiceTimeout);

  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});

  // get next player and send the notification
  const playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
    game.id
  );
  const takenSeats = _.keyBy(playersInSeats, 'seatNo');
  const gameUpdate = await Cache.getGameUpdates(game.gameCode, true);
  const occupiedSeats = new Array<number>();
  // dealer
  occupiedSeats.push(0);
  for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
    const playerSeat = takenSeats[seatNo];
    if (!playerSeat) {
      occupiedSeats.push(0);
    } else {
      if (playerSeat.status == PlayerStatus.PLAYING) {
        occupiedSeats.push(playerSeat.playerId);
      } else {
        occupiedSeats.push(0);
      }
    }
  }
  // determine button pos
  let buttonPos = gameUpdate.buttonPos;
  let playerId = 0;
  let maxPlayers = game.maxPlayers;
  while (maxPlayers > 0) {
    buttonPos++;
    if (buttonPos > maxPlayers) {
      buttonPos = 1;
    }
    if (occupiedSeats[buttonPos] !== 0) {
      playerId = occupiedSeats[buttonPos];
      break;
    }
    maxPlayers--;
  }
  await GameUpdatesRepository.updateDealersChoiceSeat(game, playerId);

  Nats.sendDealersChoiceMessage(game, playerId, timeout);

  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});
}

export async function switchSeatNextHand(
  game: PokerGame,
  player: Player,
  seatNo: number,
  transactionEntityManager?: EntityManager
) {
  let nextHandUpdatesRepository;
  const update = new NextHandUpdates();
  update.game = game;
  update.playerId = player.id;
  update.playerUuid = player.uuid;
  update.playerName = player.name;
  update.newUpdate = NextHandUpdate.SWITCH_SEAT;
  update.newSeat = seatNo;
  if (transactionEntityManager) {
    nextHandUpdatesRepository = transactionEntityManager.getRepository(
      NextHandUpdates
    );
    await nextHandUpdatesRepository.save(update);
    const gameSeatInfoProps: any = {};
    gameSeatInfoProps[`seat${seatNo}`] = SeatStatus.RESERVED;
    const gameSeatInfoRepo = transactionEntityManager.getRepository(
      PokerGameSeatInfo
    );
    await gameSeatInfoRepo.update(
      {
        gameCode: game.gameCode,
      },
      gameSeatInfoProps
    );
  } else {
    await getGameManager().transaction(async transactionEntityManager => {
      nextHandUpdatesRepository = transactionEntityManager.getRepository(
        NextHandUpdates
      );
      await nextHandUpdatesRepository.save(update);
      const gameSeatInfoRepo = transactionEntityManager.getRepository(
        PokerGameSeatInfo
      );
      const gameSeatInfoProps: any = {};
      gameSeatInfoProps[`seat${seatNo}`] = SeatStatus.RESERVED;
      await gameSeatInfoRepo.update(
        {
          gameCode: game.gameCode,
        },
        gameSeatInfoProps
      );
    });
  }
}
