import { Client, Message, OmitPartialGroupDMChannel } from 'discord.js';

export default async function (
  _: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (!message.inGuild()) return;
  if (message.author.bot) return;

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json'
    );
    const scamLinks: string[] = await response.json();

    if (scamLinks.some((link) => message.content.includes(link))) {
      await message.delete();

      if (message.member?.moderatable)
        await message.member.timeout(
          24 * 60 * 60 * 1000,
          'Attempted to share scam link'
        );

      await message.channel.sendTyping();

      await message.channel.send(
        `⚠️ Warning: ${message.author.username} attempted to share a scam link. Please be careful with links from unknown sources!`
      );
    }
  } catch (error: any) {
    console.log(
      `[Error] Failed to check for scam link: ${error.message || error}`
    );
  }
}
