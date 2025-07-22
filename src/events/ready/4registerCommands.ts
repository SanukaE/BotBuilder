import { Client } from "discord.js";
import { getActions, ActionTypes } from "#utils/getActions.js";
import getRegisteredCommands from "#utils/getRegisteredCommands.js";
import areCommandsDifferent from "#utils/areCommandsDifferent.js";
import CommandType from "#types/CommandType.js";

export default async function (client: Client) {
  console.log("[System] Registering slash commands...");

  try {
    const localCommands = (await getActions(
      ActionTypes.Commands
    )) as CommandType[];
    const registeredCommands = await getRegisteredCommands(client);

    for (const localCommand of localCommands) {
      const registeredCommand = registeredCommands.find(
        (command) => command.name === localCommand.name
      );

      if (registeredCommand) {
        if (localCommand.isDisabled) {
          await client.application!.commands.delete(registeredCommand.id!);
          continue;
        }

        if (areCommandsDifferent(localCommand, registeredCommand)) {
          console.log(
            `[System] Updating command: ${localCommand.name} (${localCommand.description})`
          );
          await client.application!.commands.delete(registeredCommand.id!);
          await client.application!.commands.create(localCommand);
        }
      } else {
        if (localCommand.isDisabled) continue;

        await client.application!.commands.create(localCommand);
      }
    }

    const deletedCommands = registeredCommands.filter((registeredCommand) => {
      if (
        localCommands.find((command) => command.name === registeredCommand.name)
      )
        return false;
      return true;
    });

    for (const deletedCommand of deletedCommands) {
      await client.application!.commands.delete(deletedCommand.id!);
    }

    console.log("[System] All slash commands are updated.");
  } catch (error: any) {
    console.error(
      `[Error] Failed to register commands: ${error.message || error}`
    );
  }
}
