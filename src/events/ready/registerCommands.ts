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
        if (localCommand.isToDelete) {
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
        if (localCommand.isToDelete) continue;

        await client.application!.commands.create(localCommand);
      }
    }

    console.log('All slash commands are up to date!');
  } catch (error) {
    console.log(error);
  }
}
