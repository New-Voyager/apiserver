import {ChatTextRepository} from './repositories/chat';
import {StatsRepository} from './repositories/stats';
import {getLogger} from './utils/log';

const systemChatText = [
  'Donkey call',
  'Runner Runner',
  'How can you run so lucky!',
  'Please fold',
  'Not my day!',
  'See you at the river',
  'Fish',
  'Nice hand!',
  'No gamble no future',
  'I got lucky',
];

const logger = getLogger('seed');

// initialize database with some default data
export async function seed() {
  try {
    for (const text of systemChatText) {
      await ChatTextRepository.addSystemChatText(text);
    }

    await StatsRepository.newSystemStats();
  } catch (err) {
    logger.error(`Error when seeding database. ${err.toString()}`);
    throw err;
  }
}
