import Assistant from "#libs/Assistant.js";
import { Client, Message, OmitPartialGroupDMChannel } from "discord.js";

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (!message.inGuild()) return;
  if (message.author.bot) return;
  if (!message.content) return;

  const mentions = Array.from(message.mentions.members.values());

  if (mentions.length === 0) return;
  if (!mentions.some((member) => member.id === client.user!.id)) return;

  const currentChannel = message.channel;

  await currentChannel.sendTyping();

  const response = await Assistant(
    client,
    currentChannel.id,
    message.author.id,
    message.content
  );

  // The response will either be:
  // - A text response from the AI if no response function was called
  // - A message from the response function if it was called
  // - "Task complete!" as fallback if response is null but no response function was called
  if (response) {
    await message.reply(response);
  } else {
    await message.reply("Task complete!");
  }
}
