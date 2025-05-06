import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Colors,
} from 'discord.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import Gemini from '#libs/Gemini.js';

const command: CommandType = {
  name: 'misc-search',
  description: 'Make a quick google search.',
  options: [
    {
      name: 'query',
      description: 'The query you want to search for.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting query from command options...');
    const query = interaction.options.getString('query')!;
    debugStream.write(`query: ${query}`);

    debugStream.write('Creating embed message...');
    const embedMessage = createEmbed({
      color: Colors.Aqua,
      title: 'Google Search',
      thumbnail: {
        url: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_120x44dp.png',
      },
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
    debugStream.write('Embed created!');

    debugStream.write('Enabling AI...');
    const { enabled, model } = Gemini();
    debugStream.write(`enabled: ${enabled}`);

    debugStream.write('Checking if AI is available...');
    if (enabled && model) {
      try {
        debugStream.write('Getting result from model...');
        const result = await model.generateContent(
          'Respond in less than 2000 charters:\n' + query
        );

        debugStream.write('Getting answer from result...');
        const answer = result.response.text();

        debugStream.write('Answer received! Setting embed description...');
        if (answer.length > 2000) {
          embedMessage.setDescription(answer.slice(0, 1998) + '...');
        } else embedMessage.setDescription(answer);
      }
      catch (err) {
        debugStream.write('Error getting answer from model!');
        debugStream.write(err as string);

        embedMessage.setDescription(
          query + '\n\n*An error occurred while trying to get an answer from AI. Sorry for the inconvience.*'
        );
      }
    } else {
      debugStream.write(
        'AI is not available! Setting query as embed description...'
      );
      embedMessage.setDescription(
        query + '\nAI is disabled because no API key was set.'
      );
    }
    debugStream.write('Description set!');

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
    });
    debugStream.write('Reply sent!');
  },
};

export default command;
