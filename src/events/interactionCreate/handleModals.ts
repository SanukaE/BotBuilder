import {
  Client,
  Interaction,
  MessageFlags,
  ModalSubmitInteraction,
} from "discord.js";
import getConfig from "#utils/getConfig.js";
import { getActions, ActionTypes } from "#utils/getActions.js";
import ModalType from "#types/ModalType.js";
import { createLogger, LoggerOptions } from "#utils/createLogger.js";
import getErrorSolution from "#utils/getErrorSolution.js";

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId.endsWith("collector")) return;

  const { developmentGuildID, isMaintenanceEnabled } = getConfig(
    "application"
  ) as { developmentGuildID: string; isMaintenanceEnabled: boolean };

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (isMaintenanceEnabled && interaction.guildId !== developmentGuildID) {
    await interaction.editReply("The bot is under maintenance.");
    return;
  }

  const modals = (await getActions(ActionTypes.Modals)) as ModalType[];

  const modal = modals.find((modal) =>
    interaction.customId.startsWith(modal.customID)
  );

  if (!modal) {
    await interaction.editReply("Unknown modal.");
    return;
  }

  if (modal.isDisabled) {
    await interaction.editReply("This modal is currently disabled.");
    return;
  }

  if (modal.isGuildOnly && !interaction.inGuild()) {
    await interaction.editReply("This modal can only be used in a server.");
    return;
  }

  if (modal.isDevOnly && interaction.guildId !== developmentGuildID) {
    await interaction.editReply(
      "This modal is currently under development. Please try again later."
    );
    return;
  }

  if (modal.permissions) {
    for (const permission of modal.permissions) {
      if (
        !interaction.member ||
        typeof interaction.member.permissions === "string" ||
        !interaction.member.permissions.has(permission)
      ) {
        await interaction.editReply(
          "You do not have the right permissions to perform this modal."
        );
        return;
      }
    }
  }

  const debugLogger = createLogger(
    `${modal.customID}-modal`,
    LoggerOptions.Debug,
    modal.enableDebug
  );

  const modalInteraction = interaction as ModalSubmitInteraction;

  try {
    await modal.script(client, modalInteraction, debugLogger);
    debugLogger.close();
  } catch (error) {
    debugLogger.close();

    if (modal.isDevOnly) console.log(error);

    await interaction.editReply(
      `There was an error while running the modal:\`\`\`${error}\`\`\``
    );

    const errorLogger = createLogger(
      `${modal.customID}-modal`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error);
    errorLogger.close();

    const solution = await getErrorSolution(modal, ActionTypes.Modals);

    if (solution) {
      await interaction.followUp({
        content:
          solution.length > 2000 ? solution.slice(0, 1998) + "..." : solution,
        ephemeral: true,
      });
    } else if (modal.isDevOnly && modal.enableDebug) {
      await interaction.followUp({
        content: "No possible fix found.",
        ephemeral: true,
      });
    }
  }
}
