import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { createPageButtons, getPageData } from '#utils/getPageData.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';

const command: CommandType = {
  name: 'mcstats-players',
  description: 'Get a list of all the players registered on your server.',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get('mcstatistics-players');

    let players: any[] = [];

    if (redisResult) players = JSON.parse(redisResult);
    else {
      const response = await fetch('https://api.mcstatistics.org/v1/players', {
        headers: { 'X-MCStatistics-Secret': process.env.MCSTATISTICS_SECRET! },
      });

      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from MCStatistics code ${responseData.code} & message ${responseData.message}`
        );

      players = responseData.players;

      await Redis.set('mcstatistics-players', JSON.stringify(players), {
        EX: 60,
      });
    }

    if (!players.length) {
      debugStream.write('No players registered! Sending reply...');

      await interaction.editReply('No players have being registered yet.');

      debugStream.write('Reply sent!');
      return;
    }

    debugStream.write('Data fetched! Creating embed...');

    const firstPlayer = players[0];

    const embedMessage = createEmbed({
      title: firstPlayer.username,
      description: `UUID:\`\`\`${firstPlayer.uuid}\`\`\``,
      color: Colors.Blue,
      fields: [
        {
          name: `🕖 First Join:`,
          value: `<t:${firstPlayer.firstjoin_date}>`,
        },
        {
          name: `🕖 Last Join:`,
          value: `<t:${firstPlayer.lastjoin_date}>`,
        },
      ],
      thumbnail: {
        url: `https://mineskin.eu/avatar/${firstPlayer.username}`,
      },
    });

    debugStream.write('Embed created! Creating components...');

    const buttonIds = [
      'mcstats-players-previous-end-collector',
      'mcstats-players-previous-collector',
      'mcstats-players-pages-collector',
      'mcstats-players-next-collector',
      'mcstats-players-next-end-collector',
    ];

    const actionRow = createPageButtons(buttonIds, players);

    debugStream.write('Components created! Sending follow up...');

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Follow up sent!');

    if (!(players.length > 1)) return;

    debugStream.write('Creating collectors...');

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
    });

    let pageIndex = 0;

    collector.on('collect', async (i) => {
      const result = getPageData(players, pageIndex, i.customId, actionRow);

      pageIndex = result.currentPageIndex;
      const player = result.data;

      embedMessage.setTitle(player.username);
      embedMessage.setDescription(`UUID:\`\`\`${player.uuid}\`\`\``);
      embedMessage.setFields([
        {
          name: `🕖 First Join:`,
          value: `<t:${player.firstjoin_data}>`,
        },
        {
          name: `🕖 Last Join:`,
          value: `<t:${player.lastjoin_data}>`,
        },
      ]);
      embedMessage.setThumbnail(
        `https://mineskin.eu/avatar/${player.username}`
      );

      await i.update({
        embeds: [embedMessage],
        components: [actionRow],
      });
    });

    debugStream.write('Collectors created!');
  },
};

export default command;
