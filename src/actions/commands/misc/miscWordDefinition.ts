import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import { ApplicationCommandOptionType } from "discord.js";

const command: CommandType = {
  name: "misc-word-definition",
  description: "Get word definitions",
  options: [
    {
      name: "word",
      description: "The word you want to get the definition of.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    const word = interaction.options.getString("word", true);

    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    if (!response.ok) throw new Error("Response was not ok");

    const wordData = await response.json();
    const entry = wordData[0]; // Get the first entry

    // Build phonetics section
    let phoneticsText = "";
    if (entry.phonetic) {
      phoneticsText = `**1. Main:** ${entry.phonetic}`;
    }

    if (entry.phonetics && entry.phonetics.length > 0) {
      phoneticsText += "\n**2. All:**";
      entry.phonetics.forEach((phonetic: any, index: any) => {
        if (phonetic.text) {
          phoneticsText += `${index + 1}. ${phonetic.text}`;
          if (phonetic.audio) {
            phoneticsText += ` [🎵 Audio](${phonetic.audio})`;
          }
          phoneticsText += "\n";
        }
      });
    }

    // Build meanings section
    let meaningsText = "";
    if (entry.meanings && entry.meanings.length > 0) {
      entry.meanings.forEach((meaning: any, meaningIndex: any) => {
        meaningsText += `\n**${
          meaningIndex + 1
        }. ${meaning.partOfSpeech.toUpperCase()}**`;

        if (meaning.definitions && meaning.definitions.length > 0) {
          meaning.definitions.forEach((def: any, defIndex: any) => {
            meaningsText += `${defIndex + 1}. ${def.definition}\n`;

            if (def.example) {
              meaningsText += `   💡 *Example: "${def.example}"*\n`;
            }

            if (def.synonyms && def.synonyms.length > 0) {
              meaningsText += `   ✅ *Synonyms: ${def.synonyms.join(", ")}*\n`;
            }

            if (def.antonyms && def.antonyms.length > 0) {
              meaningsText += `   ❌ *Antonyms: ${def.antonyms.join(", ")}*\n`;
            }
          });
        }
      });
    }

    // Build origin section
    let originText = "";
    if (entry.origin) {
      originText = `📚 **Etymology:** ${entry.origin}`;
    }

    // Build source URLs section
    let sourceText = "";
    if (entry.sourceUrls && entry.sourceUrls.length > 0) {
      sourceText = entry.sourceUrls
        .map(
          (url: any, index: any) =>
            `${index + 1}. [Source ${index + 1}](${url})`
        )
        .join("\n");
    }

    // Build license section
    let licenseText = "";
    if (entry.license) {
      licenseText = entry.license.name;
      if (entry.license.url) {
        licenseText += ` ([View License](${entry.license.url}))`;
      }
    }

    const embedMessage = createEmbed({
      title: `📖 Definition: ${entry.word}`,
      description: `Here's everything about the word **"${entry.word}"**`,
      color: 0x3498db,
      thumbnail: { url: "https://i.postimg.cc/J44Bfkpn/Dictionary.png" },
      fields: [
        ...(phoneticsText
          ? [
              {
                name: "🔊 Pronunciation",
                value: phoneticsText,
                inline: false,
              },
            ]
          : []),
        ...(meaningsText
          ? [
              {
                name: "📝 Meanings & Definitions",
                value:
                  meaningsText.length > 1024
                    ? meaningsText.substring(0, 1021) + "..."
                    : meaningsText,
                inline: false,
              },
            ]
          : []),
        ...(originText
          ? [
              {
                name: "📚 Origin",
                value: originText,
                inline: false,
              },
            ]
          : []),
        ...(sourceText
          ? [
              {
                name: "🔗 Sources",
                value: sourceText,
                inline: false,
              },
            ]
          : []),
        ...(licenseText
          ? [
              {
                name: "📄 License",
                value: licenseText,
                inline: false,
              },
            ]
          : []),
      ],
    });

    await interaction.followUp({ embeds: [embedMessage] });
  },
};

export default command;
