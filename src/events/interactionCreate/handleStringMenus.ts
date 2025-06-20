import { Client, Interaction, StringSelectMenuInteraction } from 'discord.js';
import getConfig from '#utils/getConfig.js';
import { getActions, ActionTypes } from '#utils/getActions.js';
import StringMenuType from '#types/StringMenuType.js';
import { createLogger, LoggerOptions } from '#utils/createLogger.js';
import getErrorSolution from '#utils/getErrorSolution.js';

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId.endsWith('collector')) return;

  const { developmentGuildID, isMaintenanceEnabled } = getConfig("application") as { developmentGuildID: string; isMaintenanceEnabled: boolean };

  await interaction.deferReply({ ephemeral: true });

  if (isMaintenanceEnabled && interaction.guildId !== developmentGuildID) {
    await interaction.editReply('The bot is under maintenance.');
    return;
  }

  const stringMenus = (await getActions(
    ActionTypes.StringMenus
  )) as StringMenuType[];

  const stringMenu = stringMenus.find((stringMenu) =>
    interaction.customId.startsWith(stringMenu.customID)
  );

  if (!stringMenu) {
    await interaction.editReply('Unknown menu.');
    return;
  }

  if (stringMenu.isDisabled) {
    await interaction.editReply('This menu is currently disabled.');
    return;
  }

  if (stringMenu.isGuildOnly && !interaction.inGuild()) {
    await interaction.editReply('This menu can only be used in a server.');
    return;
  }

  if (stringMenu.isDevOnly && interaction.guildId !== developmentGuildID) {
    await interaction.editReply(
      'This menu is currently under development. Please try again later.'
    );
    return;
  }

  if (stringMenu.permissions) {
    for (const permission of stringMenu.permissions) {
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
    `${stringMenu.customID}-stringMenu`,
    LoggerOptions.Debug,
    stringMenu.enableDebug
  );

  const stringMenuInteraction = interaction as StringSelectMenuInteraction;

  try {
    await stringMenu.script(client, stringMenuInteraction, debugLogger);
    debugLogger.close();
  } catch (error) {
    debugLogger.close();

    if (stringMenu.isDevOnly) console.log(error);

    await interaction.editReply(
      `There was an error while running the stringMenu:\`\`\`${error}\`\`\``
    );

    const errorLogger = createLogger(
      `${stringMenu.customID}-stringMenu`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error);
    errorLogger.close();

    const solution = await getErrorSolution(stringMenu, ActionTypes.Buttons);

    if (solution) {
      await interaction.followUp({
        content:
          solution.length > 2000 ? solution.slice(0, 1998) + '...' : solution,
        ephemeral: true,
      });
    } else if (stringMenu.isDevOnly && stringMenu.enableDebug) {
      await interaction.followUp({
        content: 'No possible fix found.',
        ephemeral: true,
      });
    }
  }
}
