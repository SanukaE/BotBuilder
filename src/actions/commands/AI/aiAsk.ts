import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType } from 'discord.js';
import Gemini from '#libs/Gemini.js';
import { GenerateContentResult } from '@google/generative-ai';

const command: CommandType = {
  name: 'ai-ask',
  description: 'Ask the AI a question',
  enableDebug: true,
  isDevOnly: true,
  options: [
    {
      name: 'question',
      description: 'The question you want to ask the AI',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'file',
      description: 'The file you want to use for the AI',
      type: ApplicationCommandOptionType.Attachment,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Initializing AI...');
    const { enabled, model, fileManager } = Gemini();

    if (!enabled) {
      debugStream.write('AI is not enabled! Sending reply...');
      await interaction.editReply('AI is not enabled');
      debugStream.write('Reply sent!');
      return;
    }

    if (!model || !fileManager) {
      debugStream.write('AI is not initialized! Sending reply...');
      await interaction.editReply('AI is not initialized');
      debugStream.write('Reply sent!');
      return;
    }

    debugStream.write('AI initialized! Getting data from interaction...');

    const question = interaction.options.getString('question')!;
    const file = interaction.options.getAttachment('file');

    debugStream.write('Data received! Processing data...');

    if (file) {
      const mimeType = file.contentType;
      if (
        !mimeType ||
        !(
          mimeType.startsWith('image/') ||
          mimeType.startsWith('video/') ||
          mimeType.startsWith('audio/') ||
          mimeType.startsWith('text/') ||
          mimeType.startsWith('application/')
        )
      ) {
        debugStream.write('File is not an image or video! Sending reply...');
        await interaction.editReply(
          'Please provide an image, video or audio file'
        );
        debugStream.write('Reply sent!');
        return;
      }
    }

    debugStream.write('Data processed! Asking AI...');

    let result: GenerateContentResult;

    if (file) {
      debugStream.write(`Attempting to fetch file from URL: ${file.url}`);

      const fileResponse = await fetch(file.url);
      const fileBuffer = await fileResponse.arrayBuffer();

      debugStream.write('File fetched successfully, uploading to AI...');

      result = await model.generateContent([
        `In less than 2000 characters answer: ${question}`,
        {
          inlineData: {
            data: Buffer.from(fileBuffer).toString('base64'),
            mimeType: file.contentType!,
          },
        },
      ]);
    } else result = await model.generateContent(question);

    const solution = result.response.text();
    let answer = solution || 'No response from AI';

    if (solution.length > 1972) answer = solution.slice(0, 1972) + '...';

    debugStream.write('AI replied! Sending reply...');
    await interaction.followUp({
      content: answer + '\n-# AI can make mistakes.',
      ephemeral: true,
    });
    debugStream.write('Reply sent!');
  },
};

export default command;
