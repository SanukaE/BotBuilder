import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import CommandType from '#types/CommandType.js';
import config from '../../../../config.json' assert { type: 'json' };
import createEmbed from '#utils/createEmbed.js';

const command: CommandType = {
  name: 'server',
  description: 'Get status of a minecraft server.',
  options: [
    {
      name: 'address',
      description: 'Address of the server.',
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'bedrock',
      description: 'Is the server bedrock?',
      type: ApplicationCommandOptionType.Boolean,
    },
  ],

  async script(client, interaction, debugLogger) {
    debugLogger.write(
      'Getting minecraftServerIP & isMinecraftServerBedrock from config.json...'
    );
    const { minecraftServerIP, isMinecraftServerBedrock } = config;
    debugLogger.write(`minecraftServerIP: ${minecraftServerIP}`);
    debugLogger.write(`isMinecraftServerBedrock: ${isMinecraftServerBedrock}`);

    debugLogger.write('Getting data from command options:');
    const address =
      interaction.options.getString('address') || minecraftServerIP;
    let isBedrock = interaction.options.getBoolean('bedrock');
    debugLogger.write(`address: ${address}`);
    debugLogger.write(`isBedrock: ${isBedrock}`);

    debugLogger.write('Checking if address  is valid or not...');
    if (!address) {
      debugLogger.write('address is not valid, replying back to user...');
      await interaction.editReply('Please mention an address.');
      debugLogger.write('Reply sent!');
      return;
    }
    debugLogger.write('address is valid!');

    //to prevent user from entering isBedrock while forgetting to add an address
    debugLogger.write(
      'Checking if isBedrock is a boolean & address = minecraftServerIP...'
    );
    if (typeof isBedrock === 'boolean' && address === minecraftServerIP) {
      isBedrock = isMinecraftServerBedrock;
      debugLogger.write(
        'The condition came out to be true, isBedrock is now equal to isMinecraftServerBedrock.'
      );
    } else debugLogger.write('Condition is false!');

    debugLogger.write('Creating apiEndPoint...');
    const apiEndPoint = (isBedrock ? `/bedrock/3/` : `/3/`) + address;
    debugLogger.write(`Endpoint: ${apiEndPoint}`);

    debugLogger.write('Making a request...');
    const response = await fetch('https://mcsrvstats.com/' + apiEndPoint);
    debugLogger.write(
      `Response received with status (${response.status}) & OK (${response.ok}).`
    );

    debugLogger.write('Checking if response was ok...');
    if (!response.ok) throw new Error('Server response was not ok.');
    debugLogger.write('Response was ok!');

    debugLogger.write('Getting data from response...');
    const responseData = await response.json();
    debugLogger.write('Data received!');

    debugLogger.write('Checking if online...');
    if (!responseData?.online) {
      debugLogger.write(
        `!responseData?.online (${!responseData?.online}) was true, sending reply...`
      );
      await interaction.editReply(
        `The server \`${address}\` is currently offline.`
      );
      debugLogger.write('Reply sent!');
      return;
    }

    debugLogger.write('Server is online, creating embed message...');
    const embedMessage = createEmbed(undefined, client)
      .setColor('Green')
      .setTitle(responseData.hostname || address)
      .setDescription(
        responseData.motd?.clean[0]?.trim + responseData.motd?.clean[1]?.trim ||
          ''
      )
      .setThumbnail(`https://api.mcsrvstat.us/icon/${address}`);
    debugLogger.write('Embed message created! Adding fields...');

    const unwantedFields = [
      'online',
      'debug',
      'protocol',
      'icon',
      'map',
      'eula_blocked',
      'motd',
      'info',
      'hostname',
    ];
    for (const [key, value] of Object.entries(responseData)) {
      if (unwantedFields.includes(key)) continue;

      debugLogger.write(`Adding field: ${key}`);
      const fieldName = key[0].toUpperCase + key.slice(1);

      switch (key) {
        case 'players':
          embedMessage.addFields({
            name: fieldName,
            value: `\`${(value as { online: number }).online}/${
              (value as { max: number }).max
            }\``,
            inline: true,
          });
          break;

        case 'plugins':
        case 'mods':
          embedMessage.addFields({
            name: fieldName,
            value: `\`${(value as []).length}\``,
            inline: true,
          });
          break;

        default:
          embedMessage.addFields({
            name: (key === 'ip' ? fieldName.toUpperCase : fieldName) + ':',
            value: `\`${value}\``,
            inline: true,
          });
      }

      debugLogger.write('Field added!');
    }

    debugLogger.write('Creating button...');
    const button = new ButtonBuilder({
      style: ButtonStyle.Link,
      label: 'View on mcsrvstat.us',
      url: isBedrock
        ? `https://mcsrvstat.us/bedrock/${address}`
        : `https://mcsrvstat.us/server/${address}`,
    });
    debugLogger.write('Button created! Creating action-row...');
    const buttonRow = new ActionRowBuilder<ButtonBuilder>({
      components: [button],
    });

    debugLogger.write(
      'Action-row was created! Replying back with embed message & button...'
    );
    await interaction.followUp({
      embeds: [embedMessage],
      components: [buttonRow],
      ephemeral: true,
    });
    debugLogger.write('Replied!');
  },
};

export default command;
