import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  MessageFlags,
} from "discord.js";

const command: CommandType = {
  name: "misc-botbuilder",
  description: "Get information on BotBuilder.",

  async script(_, interaction, debugStream) {
    debugStream.write("Creating embed...");

    const embedMessage = createEmbed({
      author: {
        name: "Sanuka",
        icon_url: "https://i.postimg.cc/90cLGHGH/Current-Pfp.jpg",
        url: "https://github.com/SanukaE",
      },
      color: Colors.Blue,
      title: "🤖 About The Project",
      description:
        "**BotBuilder** is your ultimate All-In-One (A.I.O) Discord bot, crafted to empower server owners with an extensive suite of features designed to enhance and streamline server management. Whether you're managing a small community or running a large-scale server, **BotBuilder** has got you covered. Our primary mission is to support the **Minecraft** community, enabling server owners to bring their dream servers to life in just weeks. From custom commands to integrated APIs, **BotBuilder** is built to make server management effortless, efficient, and enjoyable.",
      thumbnail: { url: "https://i.postimg.cc/wB6FR8PP/Bot-Builder-Logo.webp" },
      footer: {
        text: "A project by Sanuka.",
        icon_url: "",
      },
    });

    debugStream.write("Embed created! Creating buttons...");

    const downloadBtn = new ButtonBuilder({
      emoji: "🤖",
      label: "Get BotBuilder",
      style: ButtonStyle.Link,
      url: "https://builtbybit.com/resources/botbuilder.59151/",
    });

    const supportBtn = new ButtonBuilder({
      emoji: "❤",
      label: "Support The Project",
      style: ButtonStyle.Link,
      url: "https://buy.stripe.com/28oeVWcQX6881Hi6oo",
    });

    const row = new ActionRowBuilder<ButtonBuilder>({
      components: [downloadBtn, supportBtn],
    });

    debugStream.write("Buttons created! Sending follow up...");

    await interaction.followUp({
      embeds: [embedMessage],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    debugStream.write("Follow up sent!");
  },
};

export default command;
