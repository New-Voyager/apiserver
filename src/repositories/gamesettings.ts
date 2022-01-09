import {PokerGame, PokerGameSettings} from '@src/entity/game/game';
import {EntityManager, getRepository, Repository} from 'typeorm';
import {Cache} from '@src/cache/index';
import {getGameRepository} from '.';
import {getLogger} from '@src/utils/log';
import {JanusSession} from '@src/janus';
import {Nats} from '@src/nats';
import {BuyInApprovalLimit, GameType} from '@src/entity/types';

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
      gameSettingsRepo =
        transactionEntityManager.getRepository(PokerGameSettings);
    } else {
      gameSettingsRepo = getRepository(PokerGameSettings);
    }
    gameSettings.gameCode = gameCode;
    gameSettings.useAgora = input.useAgora;
    gameSettings.doubleBoardEveryHand = input.doubleBoardEveryHand;
    const buyInLimitStr: string = input['buyInLimit'];
    const buyInLimit: BuyInApprovalLimit = BuyInApprovalLimit[buyInLimitStr];
    gameSettings.buyInLimit = buyInLimit;

    // setup bomb pot settings
    gameSettings.bombPotEnabled = input.bombPotEnabled;
    if (input.bombPotEnabled) {
      gameSettings.bombPotEveryHand = input.bombPotEveryHand;
      gameSettings.bombPotBet = input.bombPotBet; // x BB value
      gameSettings.doubleBoardBombPot = input.doubleBoardBombPot;
      if (input.bombPotInterval) {
        gameSettings.bombPotInterval = input.bombPotInterval * 60;
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
    gameSettings.roeGames = input.roeGames;
    gameSettings.dealerChoiceGames = input.dealerChoiceGames;
    gameSettings.funAnimations = input.funAnimations;
    gameSettings.chat = input.chat;
    gameSettings.runItTwiceAllowed = input.runItTwiceAllowed;
    gameSettings.audioConfEnabled = input.audioConfEnabled;
    gameSettings.showResult = input.showResult;
    if (input.showResult === undefined) {
      gameSettings.showResult = true;
    }
    gameSettings.showHandRank = input.showHandRank;

    // ion sfu url (TODO: needs to be changed to handle multiple servers pion1, pion2, pion3)
    if (process.env.ION_SFU_URL) {
      gameSettings.ionSfuUrl = process.env.ION_SFU_URL;
    }
    gameSettings.ionRoom = gameCode;

    await gameSettingsRepo.save(gameSettings);
  }

  public async update(game: PokerGame, gameCode: string, input: any) {
    const gameSettingsProps: any = {};
    if (input.resultPauseTime !== undefined) {
      gameSettingsProps.resultPauseTime = input.resultPauseTime;
    }
    if (input.buyInApproval !== undefined) {
      gameSettingsProps.buyInApproval = input.buyInApproval;
    }
    if (input.audioConfEnabled !== undefined) {
      gameSettingsProps.audioConfEnabled = input.audioConfEnabled;
    }
    if (input.funAnimations !== undefined) {
      gameSettingsProps.funAnimations = input.funAnimations;
    }
    if (input.chat !== undefined) {
      gameSettingsProps.chat = input.chat;
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
    if (input.bombPotEveryHand !== undefined) {
      gameSettingsProps.bombPotEveryHand = input.bombPotEveryHand;
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
    if (input.bombPotBet !== undefined) {
      gameSettingsProps.bombPotBet = input.bombPotBet;
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
    if (input.showResult !== undefined && input.showResult !== null) {
      gameSettingsProps.showResult = input.showResult;
    }
    if (input.gpsCheck !== undefined) {
      gameSettingsProps.gpsCheck = input.gpsCheck;
    }
    if (input.roeGames !== undefined && Array.isArray(input.roeGames)) {
      gameSettingsProps.roeGames = input.roeGames.join(',');
    }
    if (
      input.dealerChoiceGames !== undefined &&
      Array.isArray(input.roeGames)
    ) {
      gameSettingsProps.dealerChoiceGames = input.dealerChoiceGames.join(',');
    }
    if (Object.keys(gameSettingsProps).length !== 0) {
      const gameSettingsRepo = getGameRepository(PokerGameSettings);
      await gameSettingsRepo.update(
        {
          gameCode: gameCode,
        },
        gameSettingsProps
      );
    }
    if (input.bombPotNextHand !== undefined) {
      const type = input.bombPotGameType.toString();
      let gameType = GameType.UNKNOWN;
      let gameTypeStr = GameType[GameType.HOLDEM];
      if (type === GameType[GameType.HOLDEM]) {
        gameType = GameType.HOLDEM;
      } else if (type === GameType[GameType.PLO]) {
        gameType = GameType.PLO;
      } else if (type === GameType[GameType.FIVE_CARD_PLO]) {
        gameType = GameType.FIVE_CARD_PLO;
      } else if (type === GameType[GameType.PLO_HILO]) {
        gameType = GameType.PLO_HILO;
      } else if (type === GameType[GameType.FIVE_CARD_PLO_HILO]) {
        gameType = GameType.FIVE_CARD_PLO_HILO;
      }
      if (gameType !== GameType.UNKNOWN) {
        await Cache.updateNextHandBombPot(
          game.gameCode,
          input.bombPotNextHand,
          type
        );
      }
    }
    const gameSettingsUpdated = await Cache.getGameSettings(gameCode, true);
    Nats.gameSettingsChanged(game, gameSettingsUpdated.nextHandBombPot);
    logger.info(JSON.stringify(gameSettingsUpdated));
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
      // if (gameSettings.janusSessionId && gameSettings.janusPluginHandle) {
      // logger.info(`Deleting janus room: ${game.id}`);
      // const session = JanusSession.joinSession(gameSettings.janusSessionId);
      // session.attachAudioWithId(gameSettings.janusPluginHandle);
      // session.deleteRoom(game.id);
      // logger.info(`Janus room: ${game.id} is deleted`);
      // }
    }
  }
}

export const GameSettingsRepository = new GameSettingsRepositoryImpl();
