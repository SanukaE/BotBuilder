import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { createPageButtons, getPageData } from '#utils/getPageData.js';
import {
  ApplicationCommandOptionType,
  Colors,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';

const command: CommandType = {
  name: 'mcstats-player-sessions',
  description: "Get a specific player's sessions.",
  options: [
    {
      name: 'username',
      description: 'In game name of the player.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const playerIGN = interaction.options.getString('username', true);

    debugStream.write(`playerIGN: ${playerIGN}`);

    debugStream.write('Fetching data...');

    const redisResult = await Redis.get(`mcstatistics-sessions-${playerIGN}`);

    let sessions: any[] = [];

    if (redisResult) sessions = JSON.parse(redisResult);
    else {
      const response = await fetch(
        `https://api.mcstatistics.org/v1/player/${playerIGN}/sessions`,
        {
          headers: {
            'X-MCStatistics-Secret': process.env.MCSTATISTICS_SECRET!,
          },
        }
      );

      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from MCStatistics code ${responseData.code} & message ${responseData.message}`
        );

      sessions = responseData.sessions;

      await Redis.set(
        `mcstatistics-sessions-${playerIGN}`,
        JSON.stringify(sessions),
        {
          EX: 60,
        }
      );
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.Blue,
      title: `${playerIGN}'s Sessions`,
      description:
        sessions.length > 1
          ? 'Use the buttons attached below to navigate each session.'
          : '',
      thumbnail: { url: `https://mineskin.eu/avatar/${playerIGN}` },
      fields: getFields(sessions[0]),
    });

    debugStream.write('Embed created! Creating components...');

    const buttonIds = [
      'mcstatistics-sessions-previous-end-collector',
      'mcstatistics-sessions-previous-collector',
      'mcstatistics-sessions-pages-collector',
      'mcstatistics-sessions-next-collector',
      'mcstatistics-sessions-next-end-collector',
    ];

    const actionRow = createPageButtons(buttonIds, sessions);

    debugStream.write('Components created! Sending follow up...');

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Follow up sent!');

    if (!(sessions.length > 1)) return;

    debugStream.write('Creating collector...');

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
    });

    let currentPageIndex = 0;

    collector.on('collect', async (i) => {
      const result = getPageData(
        sessions,
        currentPageIndex,
        i.customId,
        actionRow
      );

      currentPageIndex = result.currentPageIndex;
      const pageData = result.data;

      embedMessage.setFields(getFields(pageData));

      await i.update({
        embeds: [embedMessage],
        components: [actionRow],
      });
    });

    debugStream.write('Collector created!');
  },
};

function getFields(data: any) {
  return [
    {
      name: `⏳ Start:`,
      value: `<t:${data.session_start}>`,
      inline: true,
    },
    {
      name: `⌛ End:`,
      value: `<t:${data.session_end}>`,
      inline: true,
    },
    {
      name: `🎮 Play Time:`,
      value: `<t:${data.play_time}>`,
      inline: true,
    },
    {
      name: `🖥 IP:`,
      value: `\`${data.ip}\``,
      inline: true,
    },
    {
      name: `⚙ Version:`,
      value: `\`${data.version}\``,
      inline: true,
    },
  ];
}

export default command;
