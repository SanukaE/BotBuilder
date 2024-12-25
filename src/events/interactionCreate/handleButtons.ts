import { Client, Interaction, ButtonInteraction } from 'discord.js';
import config from '../../../config.json' assert { type: 'json' };
import { getActions, ActionTypes } from '#utils/getActions.js';
import ButtonType from '#types/ButtonType.js';
import { createLogger, LoggerOptions } from '#utils/createLogger.js';
import getErrorSolution from '#utils/getErrorSolution.js';

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isButton()) return;
  const { developmentGuildID, isMaintenanceEnabled } = config;

  await interaction.deferReply({ ephemeral: true });

  if (isMaintenanceEnabled && interaction.guildId !== developmentGuildID) {
    await interaction.editReply('The bot is under maintenance.');
    return;
  }

  const buttons = (await getActions(ActionTypes.Buttons)) as ButtonType[];

  const button = buttons.find((button) => button.name === interaction.customId);

  if (!button) {
    await interaction.editReply('Unknown button.');
    return;
  }

  if (button.isDisabled) {
    await interaction.editReply('This button is currently disabled.');
    return;
  }

  if (button.isGuildOnly && !interaction.inGuild()) {
    await interaction.editReply('This button can only be used in a server.');
    return;
  }

  if (button.isDevOnly && interaction.guildId !== developmentGuildID) {
    await interaction.editReply(
      'This button is currently under development. Please try again later.'
    );
    return;
  }

  if (button.permissions) {
    for (const permission of button.permissions) {
      if (
        !interaction.member ||
        typeof interaction.member.permissions === 'string' ||
        !interaction.member.permissions.has(permission)
      ) {
        await interaction.editReply(
          'You do not have the right permissions to perform this action.'
        );
        return;
      }
    }
  }

  const debugLogger = createLogger(
    `${button.name}-button`,
    LoggerOptions.Debug,
    button.enableDebug
  );

  const buttonInteraction = interaction as ButtonInteraction;

  try {
    await button.script!(client, buttonInteraction, debugLogger);
  } catch (error) {
    await interaction.editReply(
      `There was an error while running the button:\`\`\`${error}\`\`\``
    );

    const errorLogger = createLogger(
      `${button.name}-button`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error as string);
    errorLogger.close();

    const solution = await getErrorSolution(button, ActionTypes.Buttons);

    if (solution) {
      await interaction.followUp({
        content:
          solution.length > 2000 ? solution.slice(0, 1998) + '...' : solution,
        ephemeral: true,
      });
    } else if (button.isDevOnly && button.enableDebug) {
      await interaction.followUp({
        content: 'No possible fix found.',
        ephemeral: true,
      });
    }
  } finally {
    debugLogger.close();
  }
}
