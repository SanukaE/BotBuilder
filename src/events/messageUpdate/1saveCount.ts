import { Client, Message, PartialMessage } from 'discord.js';
import config from '#config' with { type: 'json' };

export default async function (
  _: Client,
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
) {
  if (newMessage.author?.bot) return;
  if (!newMessage.inGuild()) return;

  const { countChannelID } = config;
  if (!countChannelID) return;
  if (newMessage.channelId !== countChannelID) return;

  const countChannel = newMessage.channel;

  if (countChannel.lastMessage?.author.id !== newMessage.author.id) return;

  await newMessage.delete();

  const oldMsgCount = oldMessage.content!;

  await countChannel.sendTyping();

  const currentCount = await countChannel.send(oldMsgCount);
  await currentCount.react('✔');
}
