import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {Club, ClubMember} from '@src/entity/player/club';
import {UpdateResult} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Cache} from '@src/cache';
import {HandHistory} from '@src/entity/history/hand';
import {
  getGameManager,
  getGameRepository,
  getHistoryRepository,
  getUserRepository,
} from '.';
import {ClubMemberStat} from '@src/entity/player/club';

const logger = getLogger('chipstrack');

class ChipsTrackRepositoryImpl {
  public async settleClubBalances(game: PokerGame): Promise<boolean> {
    try {
      await getGameManager().transaction(async transactionEntityManager => {
        // update session time
        const playerGameRepo = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
        const playerInGame = await playerGameRepo.find({
          game: {id: game.id},
        });
        const updates = new Array<any>();
        for (const player of playerInGame) {
          let sessionTime = player.sessionTime;
          if (player.satAt) {
            const currentSessionTime = Math.round(
              (new Date().getTime() - player.satAt.getTime()) / 1000
            );
            // in seconds
            sessionTime = sessionTime + currentSessionTime;
            logger.info(
              `Session time in club: ${player.playerId} sessionTime: ${sessionTime}`
            );

            if (sessionTime === 0) {
              sessionTime = 1;
            }
            logger.info(
              `Session time in club: ${player.playerId} sessionTime: ${sessionTime}`
            );
            const update = playerGameRepo.update(
              {
                game: {id: game.id},
              },
              {
                sessionTime: sessionTime,
              }
            );
            updates.push(update);
          }
        }
        if (updates.length > 0) {
          await Promise.all(updates);
        }

        // walk through the hand history and collect big win hands for each player
        const playerBigWinLoss = {};
        const hands = await getHistoryRepository(HandHistory).find({
          where: {gameId: game.id},
          order: {handNum: 'ASC'},
        });

        // determine big win/loss hands
        for (const hand of hands) {
          const playerStacks = JSON.parse(hand.playersStack);
          for (const playerId of Object.keys(playerStacks)) {
            const playerStack = playerStacks[playerId];
            const diff = playerStack.after - playerStack.before;
            if (!playerBigWinLoss[playerId]) {
              playerBigWinLoss[playerId] = {
                playerId: playerId,
                bigWin: 0,
                bigLoss: 0,
                bigWinHand: 0,
                bigLossHand: 0,
                playerStack: [],
              };
            }

            if (diff > 0 && diff > playerBigWinLoss[playerId].bigWin) {
              playerBigWinLoss[playerId].bigWin = diff;
              playerBigWinLoss[playerId].bigWinHand = hand.handNum;
            }

            if (diff < 0 && diff < playerBigWinLoss[playerId].bigLoss) {
              playerBigWinLoss[playerId].bigLoss = diff;
              playerBigWinLoss[playerId].bigLossHand = hand.handNum;
            }
            // gather player stack from each hand
            playerBigWinLoss[playerId].playerStack.push({
              hand: hand.handNum,
              playerStack,
            });
          }
        }

        const chipUpdates = new Array<Promise<UpdateResult>>();
        for (const playerIdStr of Object.keys(playerBigWinLoss)) {
          const playerId = parseInt(playerIdStr);
          const result = await transactionEntityManager
            .getRepository(PlayerGameTracker)
            .update(
              {
                playerId: playerId,
                game: {id: game.id},
              },
              {
                bigWin: playerBigWinLoss[playerIdStr].bigWin,
                bigWinHand: playerBigWinLoss[playerIdStr].bigWinHand,
                bigLoss: playerBigWinLoss[playerIdStr].bigLoss,
                bigLossHand: playerBigWinLoss[playerIdStr].bigLossHand,
                handStack: JSON.stringify(
                  playerBigWinLoss[playerIdStr].playerStack
                ),
              }
            );
          //logger.info(JSON.stringify(result));
        }

        if (game.clubCode) {
          // update club member balance
          const playerChips = await transactionEntityManager
            .getRepository(PlayerGameTracker)
            .find({
              where: {game: {id: game.id}},
            });

          for (const playerChip of playerChips) {
            const profit = playerChip.stack - playerChip.buyIn;
            const playerGame = getUserRepository(ClubMember)
              .createQueryBuilder()
              .update()
              .set({
                balance: () => `balance + ${profit}`,
                // TODO: remove commented code on success
                // totalBuyins: () => `total_buyins + ${playerChip.buyIn}`,
                // totalWinnings: () => `total_winnings + ${playerChip.stack}`,
                // rakePaid: () => `rake_paid + ${playerChip.rakePaid}`,
                // totalGames: () => 'total_games + 1',
                // totalHands: () => `total_hands + ${playerChip.noHandsPlayed}`,
              })
              .where({
                player: {id: playerChip.playerId},
                club: {id: game.clubId},
              })
              .execute();

            chipUpdates.push(playerGame);
            const clubPlayerStats = getUserRepository(ClubMemberStat)
              .createQueryBuilder()
              .update()
              .set({
                totalBuyins: () => `total_buyins + ${playerChip.buyIn}`,
                totalWinnings: () => `total_winnings + ${playerChip.stack}`,
                rakePaid: () => `rake_paid + ${playerChip.rakePaid}`,
                totalGames: () => 'total_games + 1',
                totalHands: () => `total_hands + ${playerChip.noHandsPlayed}`,
              })
              .where({
                playerId: playerChip.playerId,
                clubId: game.clubId,
              })
              .execute();
            chipUpdates.push(clubPlayerStats);
          }
        }
        await Promise.all(chipUpdates);
      });
      //logger.info('****** ENDING TRANSACTION FOR RAKE CALCULATION');
      return true;
    } catch (e) {
      logger.error(`Error: ${JSON.stringify(e)}`);
      throw new Error(JSON.stringify(e));
    }
  }

  public async getClubBalance(clubCode: string): Promise<Club> {
    const clubRepository = getUserRepository(Club);
    const club = await clubRepository.findOne({
      where: {clubCode: clubCode},
    });
    if (!club) {
      logger.error(`Club ${clubCode} is not found`);
      throw new Error(`Club ${clubCode} is not found`);
    }
    return club;
  }

  public async getPlayerBalance(
    playerId: string,
    clubCode: string
  ): Promise<ClubMember> {
    let clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      clubMember = await Cache.getClubMember(playerId, clubCode, true);
    }
    if (!clubMember) {
      throw new Error(`Player ${playerId} is not a club member`);
    }
    const clubMemberRepository = getUserRepository(ClubMember);
    const clubPlayerBalance = await clubMemberRepository.findOne({
      where: {id: clubMember.id},
    });
    if (!clubPlayerBalance) {
      logger.error(
        'Error in retreiving club player balance for player: ${playerId}, clubCode: ${clubCode}'
      );
      throw new Error('Error in retreiving data');
    }
    return clubPlayerBalance;
  }

  public async getRakeCollected(
    playerId: string,
    gameCode: string
  ): Promise<number> {
    // only club owner or game host can get the rake
    // verify it here

    const game = await Cache.getGame(gameCode);
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    const gameUpdate = await gameUpdatesRepo.findOne({
      where: {gameID: game.id},
    });
    if (!gameUpdate) {
      return 0;
    }
    return gameUpdate.rake;
  }
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
