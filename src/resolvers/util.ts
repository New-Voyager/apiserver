import {Cache} from '@src/cache/index';
import {PokerGame} from '@src/entity/game/game';
import {getLogger} from '@src/utils/log';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const humanizeDuration = require('humanize-duration');

const logger = getLogger('resolvers::util');

export async function isHostOrManagerOrOwner(
  playerUuid: string,
  game: PokerGame
): Promise<boolean> {
  // is the player host
  const host = game.hostUuid === playerUuid;
  if (host) {
    return true;
  }

  if (game.clubCode) {
    const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerUuid} is not a club member in club ${game.clubName}`
      );
      return false;
    }

    if (!host) {
      if (clubMember.isManager || clubMember.isOwner) {
        logger.info(
          `Player: ${playerUuid} is either a manager or club owner of the ${game.clubName}`
        );
        return true;
      } else {
        logger.error(
          `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
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

export function getSessionTimeStr(totalSeconds: number): string {
  if (totalSeconds < 60) {
    // "## seconds"
    return humanizeDuration(totalSeconds * 1000);
  }
  if (totalSeconds < 3600) {
    // "## minutes"
    return humanizeDuration(totalSeconds * 1000, {units: ['m'], round: true});
  }
  // "## hours"
  return humanizeDuration(totalSeconds * 1000, {units: ['h'], round: true});
}
