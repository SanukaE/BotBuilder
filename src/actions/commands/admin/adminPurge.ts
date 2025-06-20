import CommandType from '#types/CommandType.js';
import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import getConfig from '#utils/getConfig.js';

const command: CommandType = {
  name: 'admin-purge',
  description: 'Purge messages from the channel.',
  isGuildOnly: true,
  permissions: [PermissionFlagsBits.ManageMessages],
  options: [
    {
      name: 'amount',
      description: 'The amount of messages to delete.',
      type: ApplicationCommandOptionType.Number,
      max_value: 100,
      min_value: 1,
      required: true,
    },
    {
      name: 'include-bots',
      description: 'Include bots in the message purge.',
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: 'include-staff',
      description: 'Include staff members in the message purge.',
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: 'must-not-have-role',
      description: 'Only delete messages from users who do not have the role.',
      type: ApplicationCommandOptionType.Role,
    },
    {
      name: 'must-have-role',
      description: 'Only delete messages from users who have the role.',
      type: ApplicationCommandOptionType.Role,
    },
    {
      name: 'user',
      description: 'The user to delete messages from.',
      type: ApplicationCommandOptionType.User,
    },
    {
      name: 'include-pinned',
      description: 'Include pinned messages in the purge.',
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: 'include-edit',
      description: 'Include edited messages in the purge.',
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: 'include-embeds',
      description: 'Include embed messages in the purge.',
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: 'include-attachments',
      description: 'Include attachment messages in the purge.',
      type: ApplicationCommandOptionType.Boolean,
    },
  ],

  async script(client, interaction, debugStream) {
    const { staffRoleIDs } = getConfig("moderation") as { staffRoleIDs: string[] };

    debugStream.write('Getting data from interaction...');

    const amount = interaction.options.getNumber('amount', true);
    const includeBots = interaction.options.getBoolean('include-bots');
    const includeStaff = interaction.options.getBoolean('include-staff');
    const mustNotHaveRole = interaction.options.getRole('must-not-have-role');
    const mustHaveRole = interaction.options.getRole('must-have-role');
    const user = interaction.options.getUser('user');
    const includePinned = interaction.options.getBoolean('include-pinned');
    const includeEdit = interaction.options.getBoolean('include-edit');
    const includeEmbeds = interaction.options.getBoolean('include-embeds');
    const includeAttachments = interaction.options.getBoolean(
      'include-attachments'
    );

    debugStream.write(`amount: ${amount}`);
    debugStream.write(`includeBots: ${includeBots}`);
    debugStream.write(`includeStaff: ${includeStaff}`);
    debugStream.write(`mustNotHaveRole: ${mustNotHaveRole?.id}`);
    debugStream.write(`mustHaveRole: ${mustHaveRole?.id}`);
    debugStream.write(`user: ${user?.id}`);
    debugStream.write(`includePinned: ${includePinned}`);
    debugStream.write(`includeEdit: ${includeEdit}`);
    debugStream.write(`includeEmbeds: ${includeEmbeds}`);
    debugStream.write(`includeAttachments: ${includeAttachments}`);

    debugStream.write('Fetching messages...');

    const messages = await interaction.channel!.messages.fetch({
      limit: amount,
    });

    debugStream.write('Filtering messages...');

    const filteredMessages = messages.filter((message: any) => {
      if (includeBots === false && message.author.bot) return false;
      if (
        includeStaff === false &&
        staffRoleIDs.some((id) => message.member?.roles.cache.has(id))
      )
        return false;
      if (
        mustNotHaveRole &&
        message.member?.roles.cache.has(mustNotHaveRole.id)
      )
        return false;
      if (mustHaveRole && !message.member?.roles.cache.has(mustHaveRole.id))
        return false;
      if (user && message.author.id !== user.id) return false;
      if (includePinned === false && message.pinned) return false;
      if (includeEdit === false && message.editedTimestamp) return false;
      if (includeEmbeds === false && message.embeds.length) return false;
      if (includeAttachments === false && message.attachments.size)
        return false;
      return true;
    });

    debugStream.write(`Filtered messages: ${filteredMessages.size}`);

    debugStream.write('Deleting messages...');
    await (interaction.channel as TextChannel).bulkDelete(filteredMessages);
    debugStream.write('Messages deleted!');

    debugStream.write('Sending response...');
    await interaction.followUp({
      content: `Deleted ${filteredMessages.size} messages.`,
      ephemeral: true,
    });
    debugStream.write('Response sent!');
  },
};

export default command;
