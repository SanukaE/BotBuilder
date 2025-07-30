import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType } from "discord.js";

const command: CommandType = {
  name: "game-coin-flip",
  description: "Flip a coin",
  options: [
    {
      name: "guess",
      description: "Your guess: heads or tails",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Heads", value: "Heads" },
        { name: "Tails", value: "Tails" },
      ],
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    const userChoice = interaction.options.getString("guess", true);
    debugStream.write(`userChoice: ${userChoice}`);

    const maxOptions = 2; //heads & tails
    const result = Math.floor(Math.random() * maxOptions) ? "Heads" : "Tails";
    debugStream.write(`result: ${result}`);

    const isCorrect = result === userChoice;

    await interaction.followUp(
      `${result === "Heads" ? "🪙" : "🪡"} ${result}! ${
        isCorrect ? "Lucky guess." : "Better luck next time."
      }`
    );
  },
};

export default command;
