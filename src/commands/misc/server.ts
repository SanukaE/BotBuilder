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

    const apiURL = isBedrock
      ? `https://api.mcsrvstat.us/bedrock/3/${address}`
      : `https://api.mcsrvstat.us/3/${address}`;

    try {
      const response = await fetch(apiURL);

      if (!response.ok) throw new Error('Server response was not ok.');

      const data = await response.json();

      if (!data?.online) {
        await interaction.editReply(
          `The server \`${address}\` is currently offline.`
        );
        return;
      }

      const embedMessage = new EmbedBuilder({
        color: 0o7770,
        title: data.hostname || address,
        description:
          data.motd?.clean[0]?.trim() + data.motd?.clean[1]?.trim() || '',
        thumbnail: { url: `https://api.mcsrvstat.us/icon/${address}` },
        footer: {
          text: 'Made with ❤ by ItzSanuka',
          iconURL: 'https://i.postimg.cc/htzSdpnj/current-pfp.jpg',
        },
        fields: [
          { name: 'IP:', value: data.ip + ':' + data.port },
          { name: 'Version:', value: data.version },
          {
            name: 'Player Count:',
            value: data.players.online + '/' + data.players.max,
          },
        ],
      });

      if (data.software)
        embedMessage.addFields([{ name: 'Software:', value: data.software }]);
      if (data.plugins)
        embedMessage.addFields([
          { name: 'Plugins Used:', value: data.plugins.length },
        ]);
      if (data.mods)
        embedMessage.addFields([
          { name: 'Mods Used:', value: data.mods.length },
        ]);
      if (isBedrock)
        embedMessage.addFields([
          { name: 'Gamemode:', value: data.gamemode },
          { name: 'Server ID:', value: data.serverid },
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
