import {
  Client,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import CommandType from '../../utils/CommandType.js';
import { Location, makeAPICall } from '../../utils/makeAPICall.js';

const command: CommandType = {
  name: 'server',
  description: 'Get status of a minecraft server.',
  options: [
    {
      name: 'address',
      description: 'Address of the server.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'bedrock',
      description: 'Is the server bedrock?',
      type: ApplicationCommandOptionType.Boolean,
    },
  ],

  script: async (client: Client, interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const address = interaction.options.getString('address');
    const isBedrock = interaction.options.getBoolean('bedrock');

    const apiEndPoint = isBedrock ? `/bedrock/3/${address}` : `/3/${address}`;

    try {
      const response = await makeAPICall(
        Location.MinecraftServerStats,
        apiEndPoint
      );

      if (!response.ok) throw new Error('Server response was not ok.');

      const responseData = await response.json();

      if (!responseData?.online) {
        await interaction.editReply(
          `The server \`${address}\` is currently offline.`
        );
        return;
      }

      const embedMessage = new EmbedBuilder({
        color: 0x00ff00,
        title: responseData.hostname || address,
        description:
          responseData.motd?.clean[0]?.trim() +
            responseData.motd?.clean[1]?.trim() || '',
        thumbnail: { url: `https://api.mcsrvstat.us/icon/${address}` },
        footer: {
          text: 'Made with ❤ by ItzSanuka',
          iconURL: 'https://i.postimg.cc/htzSdpnj/current-pfp.jpg',
        },
        fields: [
          {
            name: 'IP:',
            value: responseData.ip + ':' + responseData.port,
            inline: true,
          },
          { name: 'Version:', value: responseData.version, inline: true },
          {
            name: 'Player Count:',
            value: responseData.players.online + '/' + responseData.players.max,
            inline: true,
          },
        ],
      });

      if (responseData.software)
        embedMessage.addFields([
          { name: 'Software:', value: responseData.software, inline: true },
        ]);
      if (responseData.plugins)
        embedMessage.addFields([
          {
            name: 'Plugins Used:',
            value: responseData.plugins.length,
            inline: true,
          },
        ]);
      if (responseData.mods)
        embedMessage.addFields([
          { name: 'Mods Used:', value: responseData.mods.length, inline: true },
        ]);
      if (isBedrock)
        embedMessage.addFields([
          { name: 'Gamemode:', value: responseData.gamemode, inline: true },
          { name: 'Server ID:', value: responseData.serverid, inline: true },
        ]);

      const button = new ButtonBuilder({
        style: ButtonStyle.Link,
        label: 'View on mcsrvstat.us',
        url: isBedrock
          ? `https://mcsrvstat.us/bedrock/${address}`
          : `https://mcsrvstat.us/server/${address}`,
      });
      const buttonRow = new ActionRowBuilder<ButtonBuilder>({
        components: [button],
      });

      await interaction.editReply({
        embeds: [embedMessage],
        components: [buttonRow],
      });
    } catch (error) {
      await interaction.editReply(`An error occurred: ${error}`);
    }
  },
};

export default command;
