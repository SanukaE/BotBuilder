import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  MessageFlags,
} from "discord.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";

const command: CommandType = {
  name: "nameless-register",
  description:
    "Register for an account on the website linked with your discord account.",
  options: [
    {
      name: "email",
      description: "The email address you want to register with.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "username",
      description: "The username you want to register with.",
      type: ApplicationCommandOptionType.String,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write("Getting values from command...");
    const emailAddress = interaction.options.getString("email");
    const username =
      interaction.options.getString("username") || interaction.user.username;
    debugStream.write(`emailAddress: ${emailAddress}`);
    debugStream.write(`username: ${username}`);

    debugStream.write("Creating data object...");
    const data = {
      username,
      email: emailAddress,
      integrations: {
        Discord: {
          identifier: interaction.user.id,
          username: interaction.user.username,
        },
      },
    };
    debugStream.write("Data object created! Making request...");
    const response = await fetch(
      process.env.NAMELESSMC_API_URL + "/users/register",
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/JSON",
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
      }
    );
    debugStream.write("Request made! Getting JSON data...");
    const responseData = await response.json();
    debugStream.write("Data collected!");

    debugStream.write("Checking for any errors...");
    if (responseData.error) {
      debugStream.write("Error found!");
      throw new Error(
        `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
          responseData.message ? "Message :" + responseData.message : ""
        }, ${responseData.meta ? "Meta :" + responseData.meta : ""}`
      );
    } else debugStream.write("No errors found! Creating embed message...");

    const embedMessage = createEmbed({
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split("/")[2]
        }&sz=128`,
      },
      title: "Almost Done!",
      fields: [{ name: "NamelessMC Support:", value: "discord.gg/nameless" }],
      color: Colors.DarkGold,
    });
    debugStream.write(
      "Embed created! Checking if link in response data exist..."
    );

    if (responseData.link) {
      debugStream.write("Link found! Setting embed URL & description...");
      embedMessage.setURL(`${responseData.link}`);
      embedMessage.setDescription(
        "Your now a member of the community! To login to your brand new account you must set a password. If your facing any deficiencies please contact namelessmc support."
      );

      debugStream.write("Embed set! Creating setPasswordBtn...");
      const setPasswordBtn = new ButtonBuilder({
        emoji: "🔑",
        label: "Set Password",
        style: ButtonStyle.Link,
        url: `${responseData.link}`,
      });
      debugStream.write("Button created! Adding it to a action row...");
      const passwordBtnActionRow = new ActionRowBuilder<ButtonBuilder>({
        components: [setPasswordBtn],
      });
      debugStream.write("Button added! Sending follow up message...");

      await interaction.followUp({
        embeds: [embedMessage],
        components: [passwordBtnActionRow],
        flags: MessageFlags.Ephemeral,
      });
      debugStream.write("Message sent!");
    } else {
      debugStream.write("No link found! Setting embed description...");
      embedMessage.setDescription(
        `Your now a member of the community! To login please check your email (\`${emailAddress}\`) for a link to set your password. If your facing any deficiencies please contact namelessmc support.`
      );

      debugStream.write("Embed set! Sending follow up message...");
      await interaction.followUp({
        embeds: [embedMessage],
      });
      debugStream.write("Message sent!");
    }
  },
};

export default command;
