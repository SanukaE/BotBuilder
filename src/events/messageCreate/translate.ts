import { Client, Message, OmitPartialGroupDMChannel } from 'discord.js';
import config from '#config' assert { type: 'json' };
import { translate } from 'bing-translate-api';

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (message.author.id === client.user?.id) return;

  const { enableAutoMessageTranslation, translationLanguage } = config;
  if (!enableAutoMessageTranslation) return;

  if (message.author.bot) return;

  const translationData = await translate(
    message.content,
    undefined,
    translationLanguage,
    true
  ).catch((err) => console.log(`[Error] Failed to translate: ${err}`));

  if (!translationData || translationData.language.from === translationLanguage)
    return;

  await message.channel.sendTyping();

  await message.reply({
    content: `> Message Translation\n\n${
      translationData.correctedText || translationData.translation
    }`,
    allowedMentions: { repliedUser: false },
  });
}
