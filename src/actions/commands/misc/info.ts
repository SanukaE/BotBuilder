import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ChannelType,
} from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import { Location, makeAPICall } from '../../../utils/makeAPICall.js';
import createEmbed from '../../../utils/createEmbed.js';
import 'dotenv/config';

const command: CommandType = {
  name: 'info',
  description: 'Get all the information about the bot, the server and more.',
  options: [
    {
      name: 'on',
      description: 'On what you want to get more information on?',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: 'NamelessMC',
          value: 'namelessmc',
        },
        {
          name: 'Bot',
          value: 'bot',
        },
        {
          name: 'Server',
          value: 'server',
        },
      ],
    },
  ],

  async script(client, interaction) {
    const userChoice = interaction.options.getString('on');

    if (userChoice === 'server' && !interaction.inGuild()) {
      await interaction.editReply('This choice can only be used in a server.');
      return;
    }

    const embedMessage = createEmbed();

    const donateButton = new ButtonBuilder({
      label: 'Support The Project',
      emoji: '❤',
      style: ButtonStyle.Link,
      url: 'https://buy.stripe.com/28oeVWcQX6881Hi6oo',
    });

    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [donateButton],
    });

    let description: string | null = 'N/A';
    let response: Response;
    let data: any;

    switch (userChoice) {
      case 'namelessmc':
        embedMessage.setTitle('NamelessMC Stats:');
        embedMessage.setColor('DarkGold');
        embedMessage.setThumbnail('https://i.postimg.cc/Kz6WKb69/image.png');
        embedMessage.setImage('https://i.postimg.cc/VLbtcT8L/image.png');

        description =
          'NamelessMC is a free, easy to use & powerful website software for your Minecraft server, which includes a large range of features.';

        response = await makeAPICall(Location.NamelessMC, '/info', {
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
        });

        data = await response.json();

        embedMessage.addFields([
          {
            name: 'Version:',
            value: `\`${data.nameless_version}\``,
            inline: true,
          },
          {
            name: 'Default Language:',
            value: `\`${data.locale}\``,
            inline: true,
          },
          {
            name: 'Modules:',
            value: `\`${data.modules.join()}\``,
            inline: true,
          },
        ]);

        break;

      case 'bot':
        embedMessage.setTitle('About the Bot:');
        embedMessage.setColor('Blurple');
        embedMessage.setThumbnail(client.user?.avatarURL() as string | null);
        embedMessage.setImage(client.user?.bannerURL() as string | null);

        embedMessage.addFields([
          {
            name: 'GitHub:',
            value: 'https://github.com/SanukaE/BotBuilder',
          },
          { name: 'Support:', value: 'Soon...' }, //TODO
        ]);

        description =
          'Introducing BotBuilder your ultimate Discord bot tailor-made for server owners, especially for those managing Minecraft servers! With AIO, you get a comprehensive suite of features designed to make your server management smooth, efficient, and fun—all while being fully open-sourced and absolutely free to use.';

        break;

      case 'server':
        embedMessage.setTitle('Discord Server Stats:');
        embedMessage.setColor('DarkBlue');
        embedMessage.setThumbnail(
          interaction.guild?.iconURL() as string | null
        );
        embedMessage.setImage(interaction.guild?.bannerURL() as string | null);

        description = interaction.guild?.description as string | null;

        embedMessage.addFields([
          {
            name: '📍 Server ID:',
            value: `\`${interaction.guildId}\``,
            inline: true,
          },
          {
            name: '👥 Members:',
            value:
              `\`${interaction.guild?.memberCount || 'Unknown'} Total\n` +
              `👤 ${
                interaction.guild?.members.cache.filter((m) => !m.user.bot)
                  .size || 'Unknown'
              } Humans\n` +
              `🤖 ${
                interaction.guild?.members.cache.filter((m) => m.user.bot)
                  .size || 'Unknown'
              } Bots\``,
            inline: true,
          },
          {
            name: '📅 Created:',
            value: `<t:${Math.floor(
              (interaction.guild?.createdTimestamp || 0) / 1000
            )}:R>`,
            inline: true,
          },
          {
            name: '🛡️ Security:',
            value:
              `\`Verification: ${
                interaction.guild?.verificationLevel || 'Unknown'
              }\n` +
              `MFA Level: ${
                interaction.guild?.mfaLevel === 1 ? 'Enabled' : 'Disabled'
              }\n` +
              `Explicit Filter: ${interaction.guild?.explicitContentFilter}\``,
            inline: true,
          },
          {
            name: '👑 Owner:',
            value: interaction.guild?.ownerId
              ? `<@${interaction.guild.ownerId}> (\`${interaction.guild.ownerId}\`)`
              : 'Unknown',
            inline: true,
          },
          {
            name: '🏷️ Roles:',
            value: `\`${
              interaction.guild?.roles.cache.size || 'Unknown'
            } Total\``,
            inline: true,
          },
          {
            name: '💬 Channels:',
            value:
              `\`📊 Total: ${
                interaction.guild?.channels.cache.size || 'Unknown'
              }\n` +
              `💬 Text: ${
                interaction.guild?.channels.cache.filter(
                  (c) => c.type === ChannelType.GuildText
                ).size || 'Unknown'
              }\n` +
              `🔊 Voice: ${
                interaction.guild?.channels.cache.filter(
                  (c) => c.type === ChannelType.GuildVoice
                ).size || 'Unknown'
              }\``,
            inline: true,
          },
        ]);

        break;

      default:
        await interaction.editReply(`Unknown option. Please pick again.`);
        return;
    }

    embedMessage.setDescription(description);
    await interaction.followUp({
      embeds: [embedMessage],
      components: userChoice === 'bot' ? [buttonActionRow] : [],
      ephemeral: true,
    });
  },
};

export default command;
