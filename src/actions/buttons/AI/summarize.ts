import ButtonType from '#types/ButtonType.js';
import Gemini from '#libs/Gemini.js';

const button: ButtonType = {
  customID: 'ai-summarize',

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const messageContent = interaction.message.content;

    debugStream.write(
      `messageContent: ${
        messageContent.length > 100
          ? messageContent.slice(0, 100) + '...'
          : messageContent
      }`
    );

    debugStream.write('Initializing AI...');

    const { enabled, model } = Gemini();

    if (!enabled) throw new Error('AI is not enabled.');
    if (!model) throw new Error("AI model wasn't initialized.");

    debugStream.write('AI initialized! Summarizing...');

    const result = await model.generateContent(
      `Summarizing this in less than 2000 characters: ${messageContent}`
    );
    const responseText = result.response.text();

    const summary =
      responseText.length > 2000
        ? responseText.slice(0, 1972) + '...'
        : responseText;

    debugStream.write('AI summarized! Sending follow up...');

    await interaction.followUp({
      content: summary
        ? summary + '\n-# AI can make mistakes.'
        : 'No summary was generated.',
    });

    debugStream.write('Follow up sent!');
  },
};

export default button;
