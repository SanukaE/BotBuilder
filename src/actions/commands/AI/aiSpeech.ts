import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import createTempDataFile from "#utils/createTempDataFile.js";
import { ApplicationCommandOptionType, AttachmentBuilder } from "discord.js";
import path from "path";

const gemini = Gemini();

const command: CommandType = {
  name: "ai-speech",
  description: "Generate a speech with the help of AI.",
  isDisabled: !gemini.enabled,
  options: [
    {
      name: "text",
      description: "What should the AI say?",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "voice",
      description: "The voice to generate the speech in.",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Zephyr -- Bright", value: "Zephyr" },
        { name: "Kore -- Firm", value: "Kore" },
        { name: "Autonoe -- Bright", value: "Autonoe" },
        { name: "Umbriel -- Easy-going", value: "Umbriel" },
        { name: "Erinome -- Clear", value: "Erinome" },
        { name: "Laomedeia -- Upbeat", value: "Laomedeia" },
        { name: "Schedar -- Even", value: "Schedar" },
        { name: "Achird -- Friendly", value: "Achird" },
        { name: "Sadachbia -- Lively", value: "Sadachbia" },
        { name: "Fenrir -- Excitable", value: "Fenrir" },
        { name: "Aoede -- Breezy", value: "Aoede" },
        { name: "Enceladus -- Breathy", value: "Enceladus" },
        { name: "Algieba -- Smooth", value: "Algieba" },
        { name: "Algenib -- Gravelly", value: "Algenib" },
        { name: "Gacrux -- Mature", value: "Gacrux" },
        { name: "Zubenelgenubi -- Casual", value: "Zubenelgenubi" },
        { name: "Sadaltager -- Knowledgeable", value: "Sadaltager" },
        { name: "Charon -- Informative", value: "Charon" },
        { name: "Leda -- Youthful", value: "Leda" },
        { name: "Despina -- Smooth", value: "Despina" },
        { name: "Rasalgethi -- Informative", value: "Rasalgethi" },
        { name: "Alnilam -- Firm", value: "Alnilam" },
        { name: "Pulcherrima -- Forward", value: "Pulcherrima" },
        { name: "Vindemiatrix -- Gentle", value: "Vindemiatrix" },
        { name: "Sulafat -- Warm", value: "Sulafat" },
      ],
      required: false,
    },
  ],

  async script(client, interaction, debugStream) {
    const text = interaction.options.getString("text", true);
    const voice = interaction.options.getString("voice") ?? "Kore";

    const response = await gemini.model!.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          parts: [
            {
              text,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const data =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!data) throw new Error("Failed to generate speech.");

    const audioBuffer = Buffer.from(data, "base64");
    const tempAudioFile = `ai_speech_${Date.now()}.wav`;
    const tempFilePath = path.join(process.cwd(), "temp", tempAudioFile);

    await createTempDataFile(tempAudioFile, audioBuffer, 60000, {
      isAudio: true,
    });

    const speech = new AttachmentBuilder(tempFilePath, {
      name: `${interaction.user.displayName}\'s Speech`,
      description: `AI-generated speech: ${text.substring(0, 100)}${
        prompt.length > 100 ? "..." : ""
      }`,
    });

    await interaction.followUp({ files: [speech] });
  },
};

export default command;
