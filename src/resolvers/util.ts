import {Cache} from '@src/cache/index';
import {PokerGame} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
const logger = getLogger('seatchange_resolver');

export async function isHostOrManagerOrOwner(
  playerUuid: string,
  game: PokerGame
): Promise<boolean> {
  // is the player host
  const host = game.startedBy.uuid === playerUuid;
  if (host) {
    return true;
  }

  if (game.club) {
    const clubMember = await Cache.getClubMember(
      playerUuid,
      game.club.clubCode
    );
    if (!clubMember) {
      logger.error(
        `Player: ${playerUuid} is not a club member in club ${game.club.name}`
      );
      return false;
    }

    if (!host) {
      if (clubMember.isManager || clubMember.isOwner) {
        logger.info(
          `Player: ${playerUuid} is either a manager or club owner of the ${game.club.name}`
        );
        return true;
      } else {
        logger.error(
          `Player: ${playerUuid} is not a owner or a manager ${game.club.name}. Cannot make rearrange seats`
        );
        return false;
      }
    }
  }
  return false;
}

export function getResolvers() {
  return {};
}
