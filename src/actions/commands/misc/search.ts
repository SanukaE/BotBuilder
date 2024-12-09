import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import createEmbed from '../../../utils/createEmbed.js';

const command: CommandType = {
  name: 'search',
  description: 'Make a quick google search.',
  options: [
    {
      name: 'query',
      description: 'The query you want to search for.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    debugStream.write('Deferring reply...');
    await interaction.deferReply({ ephemeral: true });
    debugStream.write('Deferred reply!');

    debugStream.write('Getting query from command options...');
    const query = interaction.options.getString('query')!;
    debugStream.write(`query: ${query}`);

    debugStream.write('Creating embed message...');
    const embedMessage = createEmbed();

    embedMessage.setTitle(`Google Search Result:`);
    embedMessage.setDescription(query);
    embedMessage.setThumbnail(
      `https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_120x44dp.png`
    );
    embedMessage.setURL(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`
    );
    debugStream.write('Embed created!');

    debugStream.write('Creating button...');
    const resultButton = new ButtonBuilder({
      emoji: '🌐',
      label: 'View search result',
      style: ButtonStyle.Link,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [resultButton],
    });
    debugStream.write('Button Created!');

    debugStream.write('Sending reply...');
    await interaction.editReply({
      embeds: [embedMessage],
      components: [actionRow],
    });
    debugStream.write('Reply sent!');
  },
};

export default command;
