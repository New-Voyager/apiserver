import {PokerGame, PokerGameSettings} from '@src/entity/game/game';
import {EntityManager, getRepository, Repository} from 'typeorm';
import {Cache} from '@src/cache/index';
import {getGameRepository} from '.';
import {getLogger} from '@src/utils/log';
import {JanusSession} from '@src/janus';

const logger = getLogger('repositories::gamesettings');
class GameSettingsRepositoryImpl {
  public async create(
    gameId: number,
    gameCode: string,
    input: any,
    transactionEntityManager?: EntityManager
  ) {
    const gameSettings = new PokerGameSettings();
    let gameSettingsRepo: Repository<PokerGameSettings>;
    if (transactionEntityManager) {
      gameSettingsRepo = transactionEntityManager.getRepository(
        PokerGameSettings
      );
    } else {
      gameSettingsRepo = getRepository(PokerGameSettings);
    }
    gameSettings.gameCode = gameCode;
    gameSettings.useAgora = input.useAgora;
    gameSettings.doubleBoardEveryHand = input.doubleBoardEveryHand;

    // setup bomb pot settings
    gameSettings.bombPotEnabled = input.bombPotEnabled;
    if (input.bombPotEnabled) {
      gameSettings.bombPotEveryHand = input.bombPotEveryHand;
      gameSettings.bombPotBet = input.bombPotBet; // x BB value
      gameSettings.doubleBoardBombPot = input.doubleBoardBombPot;
      if (input.bombBotInterval) {
        gameSettings.bombPotInterval = input.bombBotInterval * 60;
      } else if (input.bombPotIntervalInSecs) {
        gameSettings.bombPotInterval = input.bombPotIntervalInSecs;
      }
    }

    /*
      public buyInApproval!: boolean;
      public breakAllowed!: boolean;
      public breakLength!: number;
      public seatChangeAllowed!: boolean;
      public waitlistAllowed!: boolean;
      public maxWaitlist!: number;
      public seatChangeTimeout!: number;
      public buyInTimeout!: number;
      public waitlistSittingTimeout!: number;
      public runItTwiceAllowed!: boolean;
      public allowRabbitHunt!: boolean;
    */
    gameSettings.allowRabbitHunt = input.allowRabbitHunt;
    gameSettings.buyInApproval = input.buyInApproval;
    gameSettings.breakAllowed = input.breakAllowed;
    gameSettings.breakLength = input.breakLength;
    gameSettings.seatChangeAllowed = input.seatChangeAllowed;
    gameSettings.waitlistAllowed = input.waitlistAllowed;
    gameSettings.waitlistSittingTimeout = input.waitlistSittingTimeout;
    gameSettings.maxWaitlist = input.maxWaitList;
    gameSettings.seatChangeTimeout = input.seatChangeTimeout;
    gameSettings.breakAllowed = input.breakAllowed;
    gameSettings.breakLength = input.breakLength;
    gameSettings.buyInTimeout = input.buyInTimeout;
    gameSettings.ipCheck = input.ipCheck;
    gameSettings.gpsCheck = input.gpsCheck;

    await gameSettingsRepo.save(gameSettings);
  }

  public async update(gameCode: string, input: any) {
    const gameSettingsProps: any = {};
    if (input.buyInApproval !== undefined) {
      gameSettingsProps.buyInApproval = input.buyInApproval;
    }
    if (input.runItTwiceAllowed !== undefined) {
      gameSettingsProps.runItTwiceAllowed = input.runItTwiceAllowed;
    }
    if (input.allowRabbitHunt !== undefined) {
      gameSettingsProps.allowRabbitHunt = input.allowRabbitHunt;
    }
    if (input.showHandRank !== undefined) {
      gameSettingsProps.showHandRank = input.showHandRank;
    }
    if (input.doubleBoardEveryHand !== undefined) {
      gameSettingsProps.doubleBoardEveryHand = input.doubleBoardEveryHand;
    }
    if (input.bombPotEnabled !== undefined) {
      gameSettingsProps.bombPotEnabled = input.bombPotEnabled;
    }
    if (input.doubleBoardEveryHand !== undefined) {
      gameSettingsProps.doubleBoardEveryHand = input.doubleBoardEveryHand;
    }

    if (input.doubleBoardBombPot !== undefined) {
      gameSettingsProps.doubleBoardBombPot = input.doubleBoardBombPot;
    }
    if (input.bombPotInterval !== undefined) {
      gameSettingsProps.bombPotInterval = input.bombPotInterval * 60;
    }
    if (input.bombPotIntervalInSecs !== undefined) {
      gameSettingsProps.bombPotIntervalInSecs = input.bombPotIntervalInSecs;
    }
    if (input.seatChangeAllowed !== undefined) {
      gameSettingsProps.seatChangeAllowed = input.seatChangeAllowed;
    }
    if (input.seatChangeTimeout !== undefined) {
      gameSettingsProps.seatChangeTimeout = input.seatChangeTimeout;
    }
    if (input.waitlistAllowed !== undefined) {
      gameSettingsProps.waitlistAllowed = input.waitlistAllowed;
    }
    if (input.waitlistSittingTimeout !== undefined) {
      gameSettingsProps.waitlistSittingTimeout = input.waitlistSittingTimeout;
    }
    if (input.breakAllowed !== undefined) {
      gameSettingsProps.breakAllowed = input.breakAllowed;
    }
    if (input.breakLength !== undefined) {
      gameSettingsProps.breakLength = input.breakLength;
    }
    if (input.ipCheck !== undefined) {
      gameSettingsProps.ipCheck = input.ipCheck;
    }
    if (input.gpsCheck !== undefined) {
      gameSettingsProps.gpsCheck = input.gpsCheck;
    }
    if (input.roeGames !== undefined) {
      gameSettingsProps.roeGames = input.roeGames;
    }
    if (input.dealerChoiceGames !== undefined) {
      gameSettingsProps.dealerChoiceGames = input.dealerChoiceGames;
    }
    const gameSettingsRepo = getGameRepository(PokerGameSettings);
    await gameSettingsRepo.update(
      {
        gameCode: gameCode,
      },
      gameSettingsProps
    );
    await Cache.getGameSettings(gameCode, true);
  }

  public async get(
    gameCode: string,
    update?: boolean,
    transManager?: EntityManager
  ): Promise<PokerGameSettings> {
    return Cache.getGameSettings(gameCode, update, transManager);
  }

  public async deleteAudioConf(game: PokerGame) {
    const gameSettingsRepo = getGameRepository(PokerGameSettings);
    const gameSettings = await gameSettingsRepo.findOne({
      gameCode: game.gameCode,
    });
    if (gameSettings) {
      if (gameSettings.janusSessionId && gameSettings.janusPluginHandle) {
        logger.info(`Deleting janus room: ${game.id}`);
        const session = JanusSession.joinSession(gameSettings.janusSessionId);
        session.attachAudioWithId(gameSettings.janusPluginHandle);
        session.deleteRoom(game.id);
        logger.info(`Janus room: ${game.id} is deleted`);
      }
    }
  }
}

export const GameSettingsRepository = new GameSettingsRepositoryImpl();
