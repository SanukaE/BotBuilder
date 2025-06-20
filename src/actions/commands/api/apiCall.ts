import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
} from 'discord.js';
import CommandType from '#types/CommandType.js';
import getConfig from '#utils/getConfig.js';
import createEmbed from '#utils/createEmbed.js';
import MySQL from '#libs/MySQL.js';
import { RowDataPacket } from 'mysql2';
import generateAPIKey from '#utils/generateAPIKey.js';
import { ActionTypes, getActions } from '#utils/getActions.js';
import { RouteType } from '#types/RouteType.js';

const command: CommandType = {
  name: 'api-call',
  description:
    "Make a call to BotBuilder's API. Only for GET request endpoints.",
  options: [
    {
      name: 'endpoint',
      description: 'The API endpoint. (eg: "users")',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'value',
      description:
        'A value to pass when making an call. (eg: "729925442324398160")',
      type: ApplicationCommandOptionType.String,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const endpoint = interaction.options.getString('endpoint')!;
    const value = interaction.options.getString('value');
    debugStream.write(`endpoint: ${endpoint}`);
    debugStream.write(`value: ${value}`);

    debugStream.write('Getting config data...');
    const { webServerIP, webServerPort } = getConfig("application") as { webServerIP: string; webServerPort: number };
    debugStream.write(`webServerIP: ${webServerIP}`);
    debugStream.write(`webServerPort: ${webServerPort}`);

    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT * FROM api_keys WHERE userID = ?',
      [interaction.user.id]
    );

    let usersAPIKey: string;

    if (rows.length === 0) {
      debugStream.write('User does not have an API key. Generating one...');
      usersAPIKey = await generateAPIKey();

      debugStream.write('Inserting API key into database...');
      await MySQL.query('INSERT INTO api_keys (userID, apiKey) VALUES (?, ?)', [
        interaction.user.id,
        usersAPIKey,
      ]);
    } else {
      const userData = rows[0];

      if (userData.keyStatus === 'REVOKED')
        throw new Error(
          `API Key has been revoked. Reason: ${userData.statusNote || 'N/A'}`
        );

      usersAPIKey = userData.apiKey;
    }

    debugStream.write('Creating endpoint button...');
    const endpointBtn = new ButtonBuilder({
      label: 'Endpoints',
      style: ButtonStyle.Link,
      url: `http://${webServerIP}:${webServerPort}/`,
      emoji: '🔗',
    });

    const row = new ActionRowBuilder<ButtonBuilder>({
      components: [endpointBtn],
    });
    debugStream.write('Endpoint button created.');

    debugStream.write('Checking if endpoint is valid...');
    //Checking if endpoint is valid
    let isValid = false;
    const validRoutes = (
      (await getActions(ActionTypes.Routes)) as RouteType[]
    ).filter((route) => {
      !route.isDisabled && route.method === 'GET';
    });

    for (const route of validRoutes) {
      if (route.endpoint === endpoint) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      debugStream.write('Invalid endpoint.');
      await interaction.editReply({
        content: 'Invalid endpoint.',
        components: [row],
      });
      return;
    }

    debugStream.write('Endpoint is valid.');
    debugStream.write('Making request to API...');

    //Making request to API
    const url =
      `http://${webServerIP}:${webServerPort}/${endpoint.split(':')[0]}` +
      (value || '');

    const response = await fetch(url, {
      headers: {
        Authorization: usersAPIKey,
      },
    });
    const data = await response.json();

    debugStream.write('Request successful.');
    debugStream.write('Sending data to user...');

    const embedMessage = createEmbed({
      color: Colors.Green,
      title: 'API Response',
      description: `\`\`\`JSON\n${data}\`\`\``,
      thumbnail: { url: 'https://i.postimg.cc/wB6FR8PP/Bot-Builder.webp' },
    });

    await interaction.followUp({
      embeds: [embedMessage],
      components: [row],
    });

    debugStream.write('Data sent.');
  },
};

export default command;
