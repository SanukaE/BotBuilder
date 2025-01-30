import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  Message,
  OmitPartialGroupDMChannel,
} from 'discord.js';
import natural from 'natural';
import config from '#config' assert { type: 'json' };
import getPublicFile from '#utils/getPublicFile.js';

export default async function (
  _: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (!message.inGuild()) return;
  if (message.author.bot) return;

  const { supportChannelID, staffRoleIDs } = config;
  if (message.channelId !== supportChannelID) return;
  if (staffRoleIDs.some((roleId) => message.member?.roles.cache.has(roleId)))
    return;

  const faqAnswers = getPublicFile('faqAnswers.txt', true).fileData!.split(
    '### END OF ANSWER ###'
  );

  const keyWords = getKeyWords(message.content.trim());

  const answer = findBestMatch(keyWords, faqAnswers);
  if (!answer) return;

  const notSolvedBtn = new ButtonBuilder({
    customId: 'faq-answer-not-solved-collector',
    label: "Doesn't help",
    style: ButtonStyle.Danger,
  });

  const row = new ActionRowBuilder<ButtonBuilder>({
    components: [notSolvedBtn],
  });

  await message.channel.sendTyping();

  const answerMsg = await message.reply({ content: answer, components: [row] });

  const buttonCollector = answerMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) =>
      (i.user.id === message.author.id ||
        staffRoleIDs.some((roleId) =>
          message.member?.roles.cache.has(roleId)
        )) &&
      i.customId === 'faq-answer-not-solved-collector',
  });

  buttonCollector.on('collect', async (i) => {
    buttonCollector.stop("FAQ answer didn't help");
    if (answerMsg.deletable) await answerMsg.delete();
  });
}

function getKeyWords(query: String) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(query.toLowerCase());

  const stopWords = new Set(natural.stopwords);
  const keywords = words.filter((word) => !stopWords.has(word));

  return keywords;
}

function findBestMatch(keywords: string[], values: string[]) {
  let bestMatch = '';
  let highestMatchCount = 0;

  values.forEach((value) => {
    const matchCount = keywords.filter((keyword) =>
      value.toLowerCase().trim().includes(keyword.toLowerCase())
    ).length;

    if (matchCount > highestMatchCount) {
      highestMatchCount = matchCount;
      bestMatch = value;
    }
  });

  return bestMatch;
}
