import { Client } from 'discord.js';
import { getActions, ActionTypes } from '../../utils/getActions.js';
import getRegisteredCommands from '../../utils/getRegisteredCommands.js';
import areCommandsDifferent from '../../utils/areCommandsDifferent.js';
import CommandType from '../../utils/CommandType.js';

export default async function (client: Client) {
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
          await client.application!.commands.edit(
            registeredCommand.id!,
            localCommand
          );
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
  } catch (error) {
    console.log(error);
  }
}
