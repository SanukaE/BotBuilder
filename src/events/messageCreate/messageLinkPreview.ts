import {
  ActionRowBuilder,
  Client,
  ComponentType,
  Message,
  OmitPartialGroupDMChannel,
  StringSelectMenuBuilder,
} from 'discord.js';

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (message.author.bot || !message.inGuild()) return;

  const messagePattern =
    /https?:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
  const matches = [...message.content.matchAll(messagePattern)];

  if (!matches.length) return;

  let messages: Message[] = [];

  for (const match of matches) {
    const [, guildId, channelId, messageId] = match;

    //prevents duplication
    if (messages.some((msg) => msg.id === messageId)) continue;

    try {
      const targetGuild = await client.guilds.fetch(guildId);

      const targetChannel = await targetGuild.channels.fetch(channelId);
      if (!targetChannel?.isTextBased()) continue;

      const targetMessage = await targetChannel.messages.fetch(messageId);
      messages.push(targetMessage);
    } catch (error) {
      null;
    }
  }

  if (!messages.length) return;

  const selectMenu = new StringSelectMenuBuilder({
    customId: 'message-link-preview-collector',
    options: messages.map((msg) => ({
      label: `By ${msg.author.displayName}`,
      description: !msg.channel.isDMBased() ? `in #${msg.channel.name}` : '',
      value: msg.id,
    })),
    placeholder: 'Pick a message to preview',
  });

  const row = new ActionRowBuilder<StringSelectMenuBuilder>({
    components: [selectMenu],
  });

  await message.channel.sendTyping();

  const msgReply = await message.reply({
    content: `> Message Link Preview\n\nThis message contains ${messages.length} link(s) to Discord messages. Use the menu below to preview them. Note that components such as buttons will not be displayed.`,
    components: [row],
    allowedMentions: { repliedUser: false },
  });

  const menuCollector = msgReply.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
  });

  menuCollector.on('collect', async (i) => {
    await i.deferUpdate();

    const messageID = i.values[0];
    const message = messages.find((msg) => msg.id === messageID)!;

    const member = await message.guild!.members.fetch(i.user.id);
    if (
      !message.channel.isDMBased() &&
      !message.channel.permissionsFor(member).has('ReadMessageHistory')
    ) {
      await i.followUp({
        content: 'You do not have permission to view this message.',
        ephemeral: true,
      });
      return;
    }

    await i.followUp({
      content: message.content,
      embeds: message.embeds,
      files: Array.from(message.attachments.values()),
      ephemeral: true,
    });
  });
}
