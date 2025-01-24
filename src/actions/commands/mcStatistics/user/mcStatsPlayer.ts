import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import formatFieldName from '#utils/formatFieldName.js';
import { ApplicationCommandOptionType, Colors } from 'discord.js';

const command: CommandType = {
  name: 'mcstats-player',
  description: 'Get information on a player.',
  options: [
    {
      name: 'username',
      description: 'In game name of the player.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data form interaction...');

    const playerIGN = interaction.options.getString('username', true);

    debugStream.write(`playerIGN: ${playerIGN}`);

    debugStream.write('Fetching data...');

    const redisResult = await Redis.get(`mcstatistics-player-${playerIGN}`);

    let player: any;

    if (redisResult) player = JSON.parse(redisResult);
    else {
      const response = await fetch(
        `https://api.mcstatistics.org/v1/player/${playerIGN}`,
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

      player = responseData;

      await Redis.set(
        `mcstatistics-player-${playerIGN}`,
        JSON.stringify(player),
        { EX: 60 }
      );
    }

    debugStream.write('Data fetched! Creating embed...');

    const unWantedFields = [
      '_id',
      'username',
      'uuid',
      'registered',
      'last_seen',
      'last_ip',
      'play_time',
      'last_version_protocol',
      'last_version',
      'last_server',
    ];

    const embedMessage = createEmbed({
      color: Colors.Blue,
      title: player.username,
      description: `🆔 UUID: \`${player.uuid}\`\n🕖 Registered: <t:${player.registered}>\n⏳ Last Seen: <t:${player.last_seen}>\n🕹 Play Time: <t:${player.play_time}>\n\n🎮 Last Played: \`${player.last_server.name}\`\n⚙ Last Version: \`${player.last_version}\``,
      thumbnail: { url: `https://mineskin.eu/avatar/${player.username}` },
      fields: Object.entries(player)
        .filter(([key, value]) => !unWantedFields.includes(key))
        .map(([key, value]) => ({
          name: `${formatFieldName(key)}:`,
          value: `\`${value}\``,
          inline: true,
        })),
    });

    debugStream.write('Embed created! Sending follow up...');

    await interaction.followUp({ embeds: [embedMessage] });

    debugStream.write('Follow up sent!');
  },
};

export default command;
