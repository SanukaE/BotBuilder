import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import createTempDataFile from "#utils/createTempDataFile.js";
import getConfig from "#utils/getConfig.js";
import { ApplicationCommandOptionType, AttachmentBuilder } from "discord.js";

const gemini = Gemini();

const command: CommandType = {
  name: "ai-image",
  description: "Generate a image with the help of AI.",
  isDisabled: !gemini.enabled,
  options: [
    {
      name: "prompt",
      description: "Describe what the AI should create.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "images",
      description: "Number of images to generate. Default is 4",
      type: ApplicationCommandOptionType.Number,
      max_value: 6,
      min_value: 1,
      required: false,
    },
  ],

  async script(client, interaction, debugStream) {
    const { imageModel } = getConfig("ai") as { imageModel: string };

    const prompt = interaction.options.getString("prompt", true);
    const noImages = interaction.options.getNumber("images") ?? 4;

    const response = await gemini.model!.generateImages({
      model: imageModel || "imagen-3.0-generate-002",
      prompt,
      config: { numberOfImages: noImages },
    });

    if (!response.generatedImages) throw new Error("Generation failed :(");

    let idx = 1;
    const images: AttachmentBuilder[] = [];

    for (const generatedImage of response.generatedImages) {
      const imgBytes = generatedImage.image!.imageBytes!;
      const buffer = Buffer.from(imgBytes, "base64");
      const filename = `ai_image_${idx}_${Date.now()}.png`;

      createTempDataFile(filename, buffer);

      const attachment = new AttachmentBuilder(buffer, { name: filename });
      images.push(attachment);

      idx++;
    }

    await interaction.followUp({ files: images });
  },
};

export default command;
