import { AutocompleteInteraction, Client, Interaction } from 'discord.js';
import { getActions, ActionTypes } from '#utils/getActions.js';
import CommandType from '#types/CommandType.js';

export default async function (client: Client, interaction: Interaction) {
  if (!interaction.isAutocomplete()) return;

  const commands = (await getActions(ActionTypes.Commands)) as CommandType[];

  const command = commands.find(
    (command) => interaction.commandName === command.name
  );

  if (!command) return;

  const focusedOption = interaction.options.getFocused();

  try {
    await command.handleAutoComplete!(
      client,
      interaction as AutocompleteInteraction,
      focusedOption
    );
  } catch (error) {
    null;
  }
}
