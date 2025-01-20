import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { Colors, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'mcstats-info',
  description: 'Get information on MCStatistics.',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get('mcstatistics-information');

    let servers: any | any[] = [];

    if (redisResult) servers = JSON.parse(redisResult);
    else {
      const response = await fetch(
        'https://api.mcstatistics.org/v1/information',
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

      servers = responseData;

      await Redis.set('mcstatistics-information', JSON.stringify(servers), {
        EX: 60_000,
      });
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.Blue,
      title: 'MCStatistics Information',
      description:
        typeof servers === 'undefined'
          ? 'There are no servers registered to view.'
          : '',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=mcstatistics.org&sz=128`,
      },
      fields:
        typeof servers === 'object'
          ? [
              {
                name: `🎮 ${servers.name}`,
                value: `🕗 Created: <t:${servers.created}>\n⏳ Last Ping: <t:${servers.last_ping}>`,
              },
            ]
          : servers.map((server: any) => ({
              name: `🎮 ${server.name}`,
              value: `🕗 Created: <t:${server.created}>\n⏳ Last Ping: <t:${server.last_ping}>`,
            })),
    });

    debugStream.write('Embed created! Sending follow up...');

    await interaction.followUp({ embeds: [embedMessage] });

    debugStream.write('Follow up sent!');
  },
};

export default command;
