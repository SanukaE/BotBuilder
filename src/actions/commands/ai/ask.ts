import {
  Client,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
} from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import Replicate from 'replicate';
import 'dotenv/config';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const command: CommandType = {
  name: 'ask',
  description: 'Get an answer to a question with AI.',
  options: [
    {
      name: 'question',
      description: 'The question you want an answer to.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  script: async (client: Client, interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const usersQuestion = interaction.options.getString('question');

    const input = {
      prompt: usersQuestion,
    };

    const output: any = await replicate.run('meta/meta-llama-3-8b-instruct', {
      input,
    });
    let aiAnswer = output.join('');

    if (aiAnswer.length === 0) {
      await interaction.editReply(
        `I could not find an answer to your question. Sorry :(`
      );
      return;
    }

    aiAnswer +=
      "\n\n-# AI can make mistakes too. It's always good to double check any impotent information.";

    await interaction.editReply(aiAnswer);
  },
};

export default command;
