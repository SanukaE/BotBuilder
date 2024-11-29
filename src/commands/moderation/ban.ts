import {
  Client,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  PermissionsBitField,
} from 'discord.js';
import CommandType from '../../utils/CommandType.js';

const command: CommandType = {
  name: 'ban',
  description: 'Bans a user form the server.',
  options: [
    {
      name: 'user',
      description: 'The user you want to ban.',
      required: true,
      type: ApplicationCommandOptionType.User,
    },
    {
      name: 'reason',
      description: 'Reason for banning the user.',
      required: true,
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'duration',
      description: 'How long should the user be banned for (in days).',
      type: ApplicationCommandOptionType.Integer,
    },
  ],
  permissions: [PermissionsBitField.Flags.BanMembers],

  script: async (client: Client, interaction: ChatInputCommandInteraction) => {
    await interaction.reply('WIP');
  },
};

export default command;
