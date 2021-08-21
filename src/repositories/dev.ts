import {DebugHands} from '@src/entity/debug/debughand';
import {Player} from '@src/entity/player/player';
import {HandRepository} from './hand';
import {Cache} from '@src/cache/index';
import {HistoryRepository} from './history';
import {GameType} from '@src/entity/types';
import {getDebugRepository} from '.';
import {BugReport} from '@src/entity/debug/bug';
import {FeatureRequest} from '@src/entity/debug/feature';

class DevRepositoryImpl {
  constructor() {}

  public async getHandLog(gameCode: string, handNum: number): Promise<any> {
    const debugHandRepo = getDebugRepository(DebugHands);
    const hand = await debugHandRepo.findOne({
      gameCode: gameCode,
      handNum: handNum,
    });
    if (!hand) {
      throw new Error(
        `Hand is not found. Game: ${gameCode} HandNum: ${handNum}`
      );
    }

    return JSON.parse(hand.data);
  }

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

  public async reportBug(player: Player, bug: string) {
    const bugReport = new BugReport();
    bugReport.reportedPlayerUuid = player.uuid;
    bugReport.bug = bug;
    const repo = getDebugRepository(BugReport);
    await repo.save(bugReport);
    return true;
  }

  public async requestFeature(player: Player, feature: string) {
    const featureRequest = new FeatureRequest();
    featureRequest.requestedPlayerUuid = player.uuid;
    featureRequest.feature = feature;
    const repo = getDebugRepository(FeatureRequest);
    await repo.save(featureRequest);
    return true;
  }

  public async featureRequests(req: any, resp: any) {
    const repo = getDebugRepository(FeatureRequest);
    const featureRequests = await repo.find();
    resp.status(200).send({requests: featureRequests});
  }

  public async bugReports(req: any, resp: any) {
    const repo = getDebugRepository(BugReport);
    const bugReports = await repo.find();
    resp.status(200).send({requests: bugReports});
  }
}

export const DevRepository = new DevRepositoryImpl();
