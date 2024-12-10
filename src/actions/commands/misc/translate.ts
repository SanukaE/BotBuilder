import {
  ApplicationCommandOptionType,
  Client,
  ChatInputCommandInteraction,
} from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import config from '../../../../config.json' assert { type: 'json' };
import { LoggerType } from '../../../utils/createLogger.js';
import { translate } from 'bing-translate-api';

const command: CommandType = {
  name: 'translate',
  description: 'Translate any text to any language.',
  options: [
    {
      name: 'text',
      description: 'The text you want to be translated.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'language',
      description: 'The language you want the text to be translated to. Eg: en',
      type: ApplicationCommandOptionType.String,
    },
  ],

  script: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    debugStream: LoggerType
  ) => {
    debugStream.write('Getting language from config.json...');
    const { language } = config;
    debugStream.write(`language: ${language}`);

    debugStream.write('Getting data from command options:');
    const usersText = interaction.options.getString('text')!;
    debugStream.write(`usersText: ${usersText}`);
    const usersLanguage = interaction.options.getString('language') || language;
    debugStream.write(`usersLanguage: ${usersLanguage}`);

    debugStream.write('Getting translation...');
    const translationData = await translate(
      usersText,
      undefined,
      usersLanguage
    );
    debugStream.write(`translation: ${translationData?.translation}`);

    debugStream.write('Sending reply...');
    await interaction.followUp({
      content: `${usersText}\n> *${translationData?.translation}*`,
      ephemeral: true,
    });
    debugStream.write('Reply sent!');
  },
};

export default command;
