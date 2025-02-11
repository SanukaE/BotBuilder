import { Client, APIApplicationCommandOption } from 'discord.js';
import CommandType from '#types/CommandType.js';

/**
 * Retrieves and formats registered Discord slash commands for a client
 * @param client - The Discord.js Client instance
 * @returns Promise containing array of formatted command objects conforming to CommandType
 * @throws Will throw an error if command fetching fails
 * 
 * @example
 * ```typescript
 * const commands = await getRegisteredCommands(discordClient);
 * console.log(commands); // Array of CommandType objects
 * ```
 */
export default async function (client: Client) {
  try {
    // Retrieve global commands
    const globalCommands = await client.application!.commands.fetch();

    // Convert global commands to CommandType array
    const slashCommands: CommandType[] = globalCommands.map((command) => ({
      id: command.id,
      name: command.name,
      description: command.description,
      options: command.options as APIApplicationCommandOption[],
    }));

    return slashCommands;
  } catch (error) {
    throw error;
  }
}
