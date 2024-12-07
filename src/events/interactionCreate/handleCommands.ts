import { Client, Interaction, ChatInputCommandInteraction } from 'discord.js';
import config from '../../../config.json' assert { type: 'json' };
import { getActions, ActionTypes } from '../../utils/getActions.js';
import CommandType from '../../utils/CommandType.js';
import { createLogger, LoggerOptions } from '../../utils/createLogger.js';

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;
  const { developmentGuildID, isMaintenanceEnabled } = config;

  if (isMaintenanceEnabled && interaction.guildId !== developmentGuildID) {
    await interaction.reply({
      content: 'The bot is under maintenance.',
      ephemeral: true,
    });
    return;
  }

  const localCommands = (await getActions(
    ActionTypes.Commands
  )) as CommandType[];

  const command = localCommands.find(
    (command) => command.name === interaction.commandName
  );
  if (!command) {
    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    return;
  }

  if (command.isDevOnly && interaction.guildId !== developmentGuildID) {
    await interaction.reply({
      content: 'The command is under development.',
      ephemeral: true,
    });
    return;
  }

  if (command.permissions) {
    for (const permission of command.permissions) {
      if (
        !interaction.member ||
        typeof interaction.member.permissions === 'string' ||
        !interaction.member.permissions.has(permission)
      ) {
        await interaction.reply({
          content:
            'You do not have the right permissions to perform this command.',
          ephemeral: true,
        });
        return;
      }
    }
  }

  const debugLogger = createLogger(
    `${command.name}-command`,
    LoggerOptions.Debug,
    command.enableDebug
  );

  const chatInteraction = interaction as ChatInputCommandInteraction;

  try {
    await command.script!(client, chatInteraction, debugLogger);
  } catch (error) {
    await interaction.followUp({
      content: `There was an error while running the command:\`\`\`${error}\`\`\``,
      ephemeral: true,
    });

    const errorLogger = createLogger(
      `${interaction.commandName}-command`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error as string);
    errorLogger.close();
  } finally {
    debugLogger.close();
  }
}
