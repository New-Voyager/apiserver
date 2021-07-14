import {DebugHands} from '@src/entity/debug/debughand';
import {Player} from '@src/entity/player/player';
import {HandRepository} from './hand';
import {Cache} from '@src/cache/index';
import {HistoryRepository} from './history';
import {GameType} from '@src/entity/types';
import {getDebugRepository} from '.';

class DevRepositoryImpl {
  constructor() {}

  public async debugHandLog(player: Player, gameCode: string, handNum: number) {
    const debugHand = new DebugHands();
    debugHand.sharedById = player.id;
    debugHand.sharedByName = player.name;
    debugHand.sharedByUuid = player.uuid;

    const handLog = await HandRepository.getHandLog(gameCode, handNum);
    debugHand.data = JSON.stringify(handLog);

    const game = await Cache.getGame(gameCode);
    let gameType: GameType;
    if (!game) {
      const historyGame = await HistoryRepository.getCompletedGameByCode(
        gameCode
      );
      if (!historyGame) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      gameType = historyGame.gameType;
    } else {
      gameType = game.gameType;
    }

    debugHand.gameCode = gameCode;
    debugHand.gameType = gameType;
    debugHand.handNum = handNum;
    const debugHandRepo = getDebugRepository(DebugHands);
    await debugHandRepo.save(debugHand);
    return true;
  }
}

export const DevRepository = new DevRepositoryImpl();
