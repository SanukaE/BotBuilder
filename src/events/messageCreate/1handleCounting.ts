import { Client, Colors, Message, OmitPartialGroupDMChannel } from 'discord.js';
import config from '#config' with { type: 'json' };
import createEmbed from '#utils/createEmbed.js';

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (!message.inGuild()) return;

  const { countChannelID, countMuteDuration } = config;
  if (message.channelId !== countChannelID) return;
  if (message.author.id === client.user?.id) return;

  const newNumber = Number(message.content);

  if (isNaN(newNumber)) {
    await message.delete();
    return;
  }

  const lastMessage = (
    await message.channel.messages.fetch({ limit: 1, before: message.id })
  ).first();
  const previousNumber = lastMessage ? Number(lastMessage?.content) : 0;

  if (lastMessage && lastMessage.author.id === message.member?.id) {
    await message.delete();
    return;
  }

  if (newNumber !== previousNumber + 1) {
    const notificationEmbed = createEmbed({
      color: Colors.Red,
      title: 'Count destroyed!',
      description: `The count was destroyed by user \`${message.author.username}\`. The count will now have to start again from \`0\`. I'll start.`,
      fields: [
        {
          name: 'Previous Number',
          value: `\`${previousNumber}\``,
          inline: true,
        },
        { name: 'Number Entered', value: `\`${newNumber}\``, inline: true },
      ],
      thumbnail: {
        url: 'https://th.bing.com/th/id/OIP.TJ7-kIoyGTTvlkGpNw6MzQHaFg?rs=1&pid=ImgDetMain',
      },
    });

    await message.react('❌');

    if (countMuteDuration) {
      await message.channel.edit({
        permissionOverwrites: [{ id: message.member!, deny: ['SendMessages'] }],
      });

      setTimeout(async () => {
        await message.channel.edit({
          permissionOverwrites: [
            { id: message.member!, allow: ['SendMessages'] },
          ],
        });
      }, countMuteDuration * 24 * 60 * 60_000);
    }

    await message.channel.sendTyping();

    await message.channel.send({
      embeds: [notificationEmbed],
    });

    const resetCountMsg = await message.channel.send('0');
    await resetCountMsg.react('✔');
    return;
  }

  await message.react('✔');
}
