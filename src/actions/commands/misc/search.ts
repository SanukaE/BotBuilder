import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Colors,
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
    debugStream.write('Getting query from command options...');
    const query = interaction.options.getString('query')!;
    debugStream.write(`query: ${query}`);

    debugStream.write('Creating embed message...');
    const embedMessage = createEmbed({
      color: Colors.Aqua,
      description: query,
      title: 'Google Search',
      thumbnail: {
        url: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_120x44dp.png',
      },
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
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
    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
      ephemeral: true,
    });
    debugStream.write('Reply sent!');
  },
};

export default command;
