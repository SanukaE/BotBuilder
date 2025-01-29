import { Client, Message, PartialMessage } from 'discord.js';

export default async function (
  _: Client,
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
) {
  if (!newMessage.inGuild()) return;
  if (newMessage.author.bot) return;

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json'
    );
    const scamLinks: string[] = await response.json();

    if (scamLinks.some((link) => newMessage.content.includes(link))) {
      await newMessage.delete();

      if (newMessage.member?.moderatable)
        await newMessage.member.timeout(
          24 * 60 * 60 * 1000,
          'Attempted to share scam link'
        );

      await newMessage.channel.send(
        `⚠️ Warning: ${newMessage.author.username} attempted to share a scam link by editing a message. Please be careful with links from unknown sources!`
      );
    }
  } catch (error: any) {
    console.log(
      `[Error] Failed to check for scam link: ${error.newMessage || error}`
    );
  }
}
