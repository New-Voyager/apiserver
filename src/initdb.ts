import {ChatTextRepository} from './repositories/chat';

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

// initialize database with some default data
export async function seed() {
  for (const text of systemChatText) {
    await ChatTextRepository.addSystemChatText(text);
  }
}
