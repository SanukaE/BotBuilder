import { Client, Interaction, ModalSubmitInteraction } from 'discord.js';
import config from '../../../config.json' assert { type: 'json' };
import { getActions, ActionTypes } from '#utils/getActions.js';
import ModalType from '#types/ModalType.js';
import { createLogger, LoggerOptions } from '#utils/createLogger.js';
import getErrorSolution from '#utils/getErrorSolution.js';

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isModalSubmit()) return;
  const { developmentGuildID, isMaintenanceEnabled } = config;

  await interaction.deferReply({ ephemeral: true });

  if (isMaintenanceEnabled && interaction.guildId !== developmentGuildID) {
    await interaction.editReply('The bot is under maintenance.');
    return;
  }

  const modals = (await getActions(ActionTypes.Modals)) as ModalType[];

  const modal = modals.find((modal) => modal.name === interaction.customId);

  if (!modal) {
    await interaction.editReply('Unknown modal.');
    return;
  }

  if (modal.isDisabled) {
    await interaction.editReply('This modal is currently disabled.');
    return;
  }

  if (modal.isGuildOnly && !interaction.inGuild()) {
    await interaction.editReply('This modal can only be used in a server.');
    return;
  }

  if (modal.isDevOnly && interaction.guildId !== developmentGuildID) {
    await interaction.editReply(
      'This modal is currently under development. Please try again later.'
    );
    return;
  }

  if (modal.permissions) {
    for (const permission of modal.permissions) {
      if (
        !interaction.member ||
        typeof interaction.member.permissions === 'string' ||
        !interaction.member.permissions.has(permission)
      ) {
        await interaction.editReply(
          'You do not have the right permissions to perform this modal.'
        );
        return;
      }
    }
  }

  const debugLogger = createLogger(
    `${modal.name}-modal`,
    LoggerOptions.Debug,
    modal.enableDebug
  );

  const modalInteraction = interaction as ModalSubmitInteraction;

  try {
    await modal.script!(client, modalInteraction, debugLogger);
  } catch (error) {
    await interaction.editReply(
      `There was an error while running the modal:\`\`\`${error}\`\`\``
    );

    const errorLogger = createLogger(
      `${modal.name}-modal`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error as string);
    errorLogger.close();

    const solution = await getErrorSolution(modal, ActionTypes.Modals);

    if (solution) {
      await interaction.followUp({
        content:
          solution.length > 2000 ? solution.slice(0, 1998) + '...' : solution,
        ephemeral: true,
      });
    } else if (modal.isDevOnly && modal.enableDebug) {
      await interaction.followUp({
        content: 'No possible fix found.',
        ephemeral: true,
      });
    }
  } finally {
    debugLogger.close();
  }
}
