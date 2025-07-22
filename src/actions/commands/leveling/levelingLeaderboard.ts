import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";

const experienceConfig = getConfig("experience") as any;

const command: CommandType = {
  name: "leveling-leaderboard",
  description: "View the leveling leaderboard for the server.",
  isDisabled: !experienceConfig.enableExperience,

  async script(client, interaction, debugStream) {
    await interaction.followUp(
      `Please visit the leaderboard at: http://${process.env.WEB_SERVER_IP}:${process.env.WEB_SERVER_PORT}/leveling/leaderboard/`
    );
  },
};

export default command;
