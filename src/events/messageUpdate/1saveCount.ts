import { Client, Message, PartialMessage } from "discord.js";
import getConfig from "#utils/getConfig.js";

export default async function (
  _: Client,
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
) {
  if (newMessage.author?.bot) return;
  if (!newMessage.inGuild()) return;

  const { channelID } = getConfig("counting") as { channelID: string };
  if (!channelID) return;
  if (newMessage.channelId !== channelID) return;

  const countChannel = newMessage.channel;

  if (countChannel.lastMessage?.author.id !== newMessage.author.id) return;

  await newMessage.delete();

  const oldMsgCount = oldMessage.content!;

  await countChannel.sendTyping();

  const currentCount = await countChannel.send(oldMsgCount);
  await currentCount.react("✔");
}
