import { Client, Message, OmitPartialGroupDMChannel } from "discord.js";
import getConfig from "#utils/getConfig.js";
import { translate } from "bing-translate-api";

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.inGuild()) return;
  if (!message.deletable) return;
  if (message.author.id === client.user?.id) return;

  const {
    autoMessageTranslation,
    defaultLanguage,
    channelID: countChannelID,
  } = getConfig("misc", "application", "counting") as {
    autoMessageTranslation: boolean;
    defaultLanguage: string;
    channelID: string;
  };
  if (!autoMessageTranslation) return;

  if (message.channelId === countChannelID) return;

  if (message.author.bot) return;
  if (!message.content) return;

  const translationData = await translate(
    message.content,
    null,
    defaultLanguage
  ).catch((err) => console.log(`[Error] Failed to translate: ${err}`));

  if (!translationData || translationData.language.from === defaultLanguage)
    return;

  await message.channel.sendTyping();

  await message.reply({
    content: `> Message Translation\n\n${
      translationData.correctedText || translationData.translation
    }`,
    allowedMentions: { repliedUser: false },
  });
}
