import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {Club, ClubMember} from '@src/entity/club';
import {getRepository, getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker, ClubChipsTransaction} from '@src/entity/chipstrack';
import {Cache} from '@src/cache';
import {HandHistory} from '@src/entity/hand';
import {PlayerStatus} from '@src/entity/types';

const logger = getLogger('chipstrack');

class ChipsTrackRepositoryImpl {
  public async settleClubBalances(game: PokerGame): Promise<any> {
    try {
      if (!game.club) {
        // we don't track balances of individual host games
        return true;
      }

      const gameUpdatesRepo = getRepository(PokerGameUpdates);

      const gameId = game.id;
      const gameUpdates = await gameUpdatesRepo.findOne({
        gameID: gameId,
      });
      if (!gameUpdates) {
        throw new Error(`Game Updates for ${gameId} is not found`);
      }
      logger.info('****** STARTING TRANSACTION FOR RAKE CALCULATION');
      await getManager().transaction(async transactionEntityManager => {
        const clubChipsTransaction = new ClubChipsTransaction();
        clubChipsTransaction.club = game.club;
        clubChipsTransaction.amount = gameUpdates.rake;
        clubChipsTransaction.balance = game.club.balance + gameUpdates.rake;
        clubChipsTransaction.description = `rake collected from game #${game.gameCode}`;
        await transactionEntityManager
          .getRepository(ClubChipsTransaction)
          .save(clubChipsTransaction);
        const clubId = game.club.id;
        await transactionEntityManager
          .getRepository(Club)
          .createQueryBuilder()
          .update()
          .set({
            balance: () => `balance + ${gameUpdates.rake}`,
          })
          .where({
            id: clubId,
          })
          .execute();

        // walk through the hand history and collect big win hands for each player
        const playerBigWinLoss: any = {};
        const hands = await transactionEntityManager
          .getRepository(HandHistory)
          .find({gameId: game.id});

        // determine big win/loss hands
        for (const hand of hands) {
          const playerStacks = JSON.parse(hand.playersStack);
          for (const seatNo of Object.keys(playerStacks)) {
            const playerStack = playerStacks[seatNo];
            const diff = playerStack.after - playerStack.before;
            if (!playerBigWinLoss[seatNo]) {
              playerBigWinLoss[seatNo] = {
                seatNo: seatNo,
                bigWin: 0,
                bigLoss: 0,
                bigWinHand: 0,
                bigLossHand: 0,
                playerStack: [],
              };
            }

            if (diff > 0 && diff > playerBigWinLoss[seatNo].bigWin) {
              playerBigWinLoss[seatNo].bigWin = diff;
              playerBigWinLoss[seatNo].bigWinHand = hand.handNum;
            }

            if (diff < 0 && diff < playerBigWinLoss[seatNo].bigLoss) {
              playerBigWinLoss[seatNo].bigLoss = diff;
              playerBigWinLoss[seatNo].bigLossHand = hand.handNum;
            }
            // gather player stack from each hand
            playerBigWinLoss[seatNo].playerStack.push({
              hand: hand.handNum,
              playerStack,
            });
          }
        }

        const chipUpdates = new Array<any>();
        for (const seatNoStr of Object.keys(playerBigWinLoss)) {
          const seatNo = parseInt(seatNoStr);
          const result = await transactionEntityManager
            .getRepository(PlayerGameTracker)
            .update(
              {
                seatNo: seatNo,
                game: {id: game.id},
              },
              {
                bigWin: playerBigWinLoss[seatNo].bigWin,
                bigWinHand: playerBigWinLoss[seatNo].bigWinHand,
                bigLoss: playerBigWinLoss[seatNo].bigLoss,
                bigLossHand: playerBigWinLoss[seatNo].bigLossHand,
                handStack: JSON.stringify(playerBigWinLoss[seatNo].playerStack),
              }
            );
          console.log(JSON.stringify(result));
        }

        // update club member balance
        const playerChips = await transactionEntityManager
          .getRepository(PlayerGameTracker)
          .find({
            relations: ['game', 'player'],
            where: {game: {id: gameId}},
          });

        for (const playerChip of playerChips) {
          const profit = playerChip.stack - playerChip.buyIn;
          const playerGame = transactionEntityManager
            .getRepository(ClubMember)
            .createQueryBuilder()
            .update()
            .set({
              balance: () => `balance + ${profit}`,
              totalBuyins: () => `total_buyins + ${playerChip.buyIn}`,
              totalWinnings: () => `total_winnings + ${playerChip.stack}`,
              rakePaid: () => `rake_paid + ${playerChip.rakePaid}`,
              totalGames: () => 'total_games + 1',
              totalHands: () => `total_hands + ${playerChip.noHandsPlayed}`,
              notes: '',
            })
            .where({
              player: {id: playerChip.player.id},
              club: {id: clubId},
            })
            .execute();
          chipUpdates.push(playerGame);
        }
        await Promise.all(chipUpdates);
      });
      logger.info('****** ENDING TRANSACTION FOR RAKE CALCULATION');
      return true;
    } catch (e) {
      logger.error(`Error: ${JSON.stringify(e)}`);
      return new Error(JSON.stringify(e));
    }
  }

  public async getClubBalance(clubCode: string): Promise<Club> {
    const clubRepository = getRepository(Club);
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
    const clubMemberRepository = getRepository(ClubMember);
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
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
    const gameUpdates = await gameUpdatesRepo.find({
      where: {gameID: game.id},
    });
    if (!gameUpdates || gameUpdates.length === 0) {
      return 0;
    }
    return gameUpdates[0].rake;
  }
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
