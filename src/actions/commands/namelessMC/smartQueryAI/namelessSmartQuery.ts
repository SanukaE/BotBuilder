import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType } from 'discord.js';

const command: CommandType = {
  name: 'nameless-smartquery-ask',
  description: 'Ask a question for SmartQuery',
  options: [
    {
      name: 'query',
      description: 'The question you want to ask',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  isDisabled: process.env.SMARTQUERYAI_API_KEY ? true : false,

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const query = interaction.options.getString('query', true);

    debugStream.write(
      `query: ${query.length > 10 ? query.slice(0, 10) + '...' : query}`
    );

    debugStream.write('Fetching data...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL + `chatbot/assets/endpoint.php`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({
          api_key: process.env.SMARTQUERYAI_API_KEY,
          prompt: query,
        }),
      }
    );

    debugStream.write(`Response Status: ${response.status}`);

    debugStream.write('Getting JSON data...');
    const responseData = await response.json();

    if (responseData.error)
      throw new Error(
        `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
          responseData.message ? 'Message :' + responseData.message : ''
        }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
      );

    debugStream.write('Data fetched! Sending follow up...');

    await interaction.followUp({
      content:
        responseData.message.length > 2000
          ? responseData.message.slice(0, 1997) + '...'
          : responseData.message,
      ephemeral: true,
    });

    debugStream.write('Follow up sent!');
  },
};

export default command;
