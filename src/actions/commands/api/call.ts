import { ApplicationCommandOptionType } from 'discord.js';
import CommandType from '../../../utils/CommandType.js';

const command: CommandType = {
  name: 'api-call',
  description: "Make a call to BotBuilder's API.",
  enableDebug: true,
  isDevOnly: true,
  options: [
    {
      name: 'endpoint',
      description: 'The API endpoint. (eg: "/discord/users")',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    //TODO: Make a fetch to the given endpoint
  },
};

export default command;
