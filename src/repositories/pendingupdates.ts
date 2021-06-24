import {
  getRepository,
  getConnection,
  Not,
  EntityManager,
  Repository,
} from 'typeorm';
import {fixQuery} from '@src/utils';
import {
  ApprovalStatus,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {
  pendingProcessDone,
  playerBuyIn,
  playerKickedOut,
  playerLeftGame,
} from '@src/gameserver';
import {startTimer} from '@src/timer';
import {occupiedSeats, WaitListMgmt} from './waitlist';
import {SeatChangeProcess} from './seatchange';
import {BUYIN_TIMEOUT, DEALER_CHOICE_TIMEOUT} from './types';
import _ from 'lodash';
import {Nats} from '@src/nats';
import {TakeBreak} from './takebreak';
import {Cache} from '@src/cache';
import {BuyIn} from './buyin';
import {reloadApprovalTimeoutExpired} from './timer';
import {Reload} from './reload';

const logger = getLogger('pending-updates');

export async function markDealerChoiceNextHand(
  game: PokerGame,
  entityManager?: EntityManager
) {
  let nextHandUpdatesRepository;
  if (entityManager) {
    nextHandUpdatesRepository = entityManager.getRepository(NextHandUpdates);
  } else {
    nextHandUpdatesRepository = getRepository(NextHandUpdates);
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

  const gameRespository = getRepository(PokerGame);
  const game = await gameRespository.findOne({id: gameId});
  if (!game) {
    throw new Error(`Game: ${gameId} is not found`);
  }

  await Cache.updateGamePendingUpdates(game?.gameCode, false);
  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  const gameUpdate = await gameUpdatesRepo.findOne({gameID: game.id});
  if (!gameUpdate) {
    return;
  }

  logger.info(`Processing pending updates for game id: ${game.gameCode}`);
  if (gameUpdate.seatChangeInProgress) {
    logger.info(
      `Seat change is in progress for game id: ${game.gameCode}. No updates will be performed.`
    );
    return;
  }

  // if there is an end game update, let us end the game first
  const query = fixQuery(
    'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
  );
  let resp = await getConnection().query(query, [
    gameId,
    NextHandUpdate.END_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    // game ended
    await GameRepository.markGameStatus(gameId, GameStatus.ENDED);

    // delete hand updates for the game
    await getConnection().query(
      fixQuery('DELETE FROM next_hand_updates WHERE game_id=?'),
      [gameId]
    );
    return;
  }

  // did the host paused the game?
  resp = await getConnection().query(query, [
    gameId,
    NextHandUpdate.PAUSE_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    logger.info(`Game: ${gameId} is paused`);
    // game paused
    await GameRepository.markGameStatus(gameId, GameStatus.PAUSED);

    // delete hand updates for the game
    await getConnection().query(
      fixQuery(
        'DELETE FROM next_hand_updates WHERE game_id=? AND new_update = ?'
      ),
      [gameId, NextHandUpdate.PAUSE_GAME]
    );
    return;
  }

  const pendingUpdatesRepo = getRepository(NextHandUpdates);
  const updates = await pendingUpdatesRepo.find({
    relations: ['game', 'player'],
    where: {
      game: {id: gameId},
    },
  });

  let endPendingProcess = true;
  let seatChangeInProgress = false;
  let openedSeat = 0;
  if (updates.length !== 0) {
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);

    for (const update of updates) {
      // walk through each update
      if (update.newUpdate === NextHandUpdate.KICKOUT) {
        // kick out a player
        await kickoutPlayer(
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
        const takeBreak = new TakeBreak(game, update.player);
        takeBreak.processPendingUpdate(update);
      }
    }

    let seatChangeAllowed = game.seatChangeAllowed;
    const seats = await occupiedSeats(game.id);
    seatChangeAllowed = true; // debugging
    if (seatChangeAllowed) {
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

  if (!seatChangeInProgress && game.waitlistAllowed) {
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.runWaitList();
  }

  if (endPendingProcess) {
    // start buy in timers for the player's whose stack is 0 and playing
    await BuyIn.startBuyInTimers(game);

    // if the game does not have more than 1 active player, then the game cannot continue
    const canContinue = await GameRepository.determineGameStatus(game.id);
    if (canContinue && dealerChoiceUpdate) {
      await handleDealersChoice(game, dealerChoiceUpdate, pendingUpdatesRepo);
    } else {
      const cachedGame = await Cache.getGame(game.gameCode);
      await pendingProcessDone(
        gameId,
        cachedGame.status,
        cachedGame.tableStatus
      );
    }
  }
}

async function kickoutPlayer(
  playerGameTrackerRepository: any,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
) {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      player: {id: update.player.id},
    },
  });
  // calculate session time
  const currentSessionTime =
    new Date().getTime() - playerInGame.satAt.getTime();
  const roundMinutes = Math.round(currentSessionTime / 1000);
  const sessionTime = playerInGame.sessionTime + roundMinutes;

  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      player: {id: update.player.id},
    },
    {
      status: PlayerStatus.KICKED_OUT,
      sessionTime: sessionTime,
      seatNo: 0,
      satAt: undefined,
    }
  );

  const count = await playerGameTrackerRepository.count({
    where: {
      game: {id: game.id},
      status: PlayerStatus.PLAYING,
    },
  });

  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  await gameUpdatesRepo.update(
    {
      gameID: game.id,
    },
    {playersInSeats: count}
  );

  if (playerInGame) {
    // notify game server, player is kicked out
    playerKickedOut(game, update.player, playerInGame.seatNo);
  }
  // delete this update
  pendingUpdatesRepo.delete({id: update.id});
}

async function leaveGame(
  playerGameTrackerRepository: any,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo
) {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      player: {id: update.player.id},
    },
  });
  const openedSeat = playerInGame.seatNo;

  // calculate session time
  const currentSessionTime =
    new Date().getTime() - playerInGame.satAt.getTime();
  const roundMinutes = Math.round(currentSessionTime / 1000);
  const sessionTime = playerInGame.sessionTime + roundMinutes;

  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      player: {id: update.player.id},
    },
    {
      satAt: undefined,
      sessionTime: sessionTime,
      status: PlayerStatus.LEFT,
      seatNo: 0,
    }
  );

  const count = await playerGameTrackerRepository.count({
    where: {
      game: {id: game.id},
      seatNo: Not(0),
    },
  });

  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  await gameUpdatesRepo.update(
    {
      gameID: game.id,
    },
    {playersInSeats: count}
  );

  if (playerInGame) {
    // notify game server, player is kicked out
    playerLeftGame(game, update.player, playerInGame.seatNo);
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
      player: {id: update.player.id},
    },
  });

  playerInGame.status = PlayerStatus.PLAYING;
  playerInGame.stack += amount;
  playerInGame.buyIn += amount;
  playerInGame.noOfBuyins += 1;
  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      player: {id: update.player.id},
    },
    {
      status: playerInGame.status,
      stack: playerInGame.stack,
      buyIn: playerInGame.buyIn,
      noOfBuyins: playerInGame.noOfBuyins,
    }
  );

  if (playerInGame) {
    // notify game server, player has a new buyin
    await playerBuyIn(game, update.player, playerInGame);
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

  const reload = new Reload(game, update.player);
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
  const playersInSeats = await GameRepository.getPlayersInSeats(game.id);
  const takenSeats = _.keyBy(playersInSeats, 'seatNo');

  const gameUpdatesRepo = getRepository(PokerGameUpdates);
  const gameUpdates = await gameUpdatesRepo.find({
    gameID: game.id,
  });
  if (gameUpdates.length === 0) {
    return;
  }

  const gameUpdate = gameUpdates[0];
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

  await gameUpdatesRepo.update(
    {
      dealerChoiceSeat: playerId,
    },
    {
      gameID: game.id,
    }
  );

  Nats.sendDealersChoiceMessage(game, playerId, timeout);

  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});
}
