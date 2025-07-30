import CommandType from '#types/CommandType.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';

const command: CommandType = {
  name: 'admin-nuke',
  description:
    "Delete's the channel and creates a new one so pings are removed.",
  isGuildOnly: true,
  permissions: [PermissionFlagsBits.ManageChannels],

  async script(client, interaction, debugStream) {
    debugStream.write('Sending warning message...');

    if (!interaction.channel!.isSendable())
      throw new Error('Channel is not sendable!');

    const nukeChannelBtn = new ButtonBuilder({
      customId: 'admin-nuke-channel-true-collector',
      emoji: '💣',
      label: 'Nuke Channel',
      style: ButtonStyle.Danger,
    });

    const cancelNukeBtn = new ButtonBuilder({
      customId: 'admin-nuke-channel-false-collector',
      emoji: '🕊',
      label: 'Abort',
      style: ButtonStyle.Success,
    });

    const confirmationBtns = new ActionRowBuilder<ButtonBuilder>({
      components: [nukeChannelBtn, cancelNukeBtn],
    });

    await interaction.followUp({ content: '⚠ Confirmation required!' });

    const warningMessage = await interaction.channel!.send({
      content: `## Are you sure?\n\n${interaction.user.displayName} this will delete the current channel and create a new one. This will remove all pings and messages in the channel. Are you sure you want to continue?`,
      components: [confirmationBtns],
    });

    setTimeout(async () => {
      if (warningMessage.deletable) await warningMessage.delete();
    }, 40_000); // 60 seconds

    debugStream.write('Warning sent! Creating collector...');

    const collector = warningMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId.startsWith('admin-nuke-channel'),
      time: 30_000, // 30 seconds
    });

    collector.on('collect', async (i) => {
      const isNuke = i.customId.split('-')[3] === 'true';

      if (isNuke) {
        await i.update({
          content:
            '## Nuking Channel\n\nDeleting the current channel and creating a new one...',
          components: [],
        });

        const newChannel = await (i.channel as TextChannel).clone();

        await newChannel.sendTyping();
        await newChannel.send(`💣 Channel nuked by <@${interaction.user.id}>!`);

        await i.channel!.delete();
      } else {
        await i.update({
          content: '## Aborted\n\nThe channel will not be nuked.',
          components: [],
        });

        collector.stop('Decision made!');
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time' && warningMessage.editable) {
        await warningMessage.edit({
          content: `## Timed Out\n\n${interaction.user.displayName}, you took too long to make a decision.`,
          components: [],
        });
      }
    });

    debugStream.write('Collector created!');
  },
};

export default command;
