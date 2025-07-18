import {
  Client,
  Interaction,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import getConfig from "#utils/getConfig.js";
import { getActions, ActionTypes } from "#utils/getActions.js";
import CommandType from "#types/CommandType.js";
import { createLogger, LoggerOptions } from "#utils/createLogger.js";
import getErrorSolution from "#utils/getErrorSolution.js";

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;
  const { developmentGuildID, isMaintenanceEnabled } = getConfig(
    "application"
  ) as { developmentGuildID: string; isMaintenanceEnabled: boolean };

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (isMaintenanceEnabled && interaction.guildId !== developmentGuildID) {
    await interaction.editReply("The bot is under maintenance.");
    return;
  }

  const commands = (await getActions(ActionTypes.Commands)) as CommandType[];

  const command = commands.find(
    (command) => command.name === interaction.commandName
  );

  if (!command) {
    await interaction.editReply("Unknown command.");
    return;
  }

  if (command.isDisabled) {
    await interaction.editReply("This command is currently disabled.");
    return;
  }

  if (command.isGuildOnly && !interaction.inGuild()) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  if (command.isDevOnly && interaction.guildId !== developmentGuildID) {
    await interaction.editReply(
      "This command is currently under development. Please try again later."
    );
    return;
  }

  if (command.permissions) {
    for (const permission of command.permissions) {
      if (
        !interaction.member ||
        typeof interaction.member.permissions === "string" ||
        !interaction.member.permissions.has(permission)
      ) {
        await interaction.editReply(
          "You do not have the right permissions to perform this command."
        );
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
    debugLogger.close();
  } catch (error) {
    debugLogger.close();

    if (command.isDevOnly) console.log(error);

    await interaction.editReply(
      `There was an error while running the command:\`\`\`${error}\`\`\``
    );

    const errorLogger = createLogger(
      `${command.name}-command`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error);
    errorLogger.close();

    const solution = await getErrorSolution(command, ActionTypes.Commands);

    if (solution) {
      await interaction.followUp({
        content:
          solution.length > 2000 ? solution.slice(0, 1998) + "..." : solution,
        ephemeral: true,
      });
    } else if (command.isDevOnly && command.enableDebug) {
      await interaction.followUp({
        content: "No possible fix found.",
        ephemeral: true,
      });
    }
  }
}
