import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import createTempDataFile from "#utils/createTempDataFile.js";
import getConfig from "#utils/getConfig.js";
import { GenerateVideosOperation } from "@google/genai";
import { ApplicationCommandOptionType, AttachmentBuilder } from "discord.js";
import path from "path";

const gemini = Gemini();

const command: CommandType = {
  name: "ai-video",
  description: "Generate a video with the help of AI.",
  isDisabled: !gemini.enabled,
  options: [
    {
      name: "prompt",
      description: "Describe what the AI should create.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "image",
      description: "An image to help the AI start with.",
      type: ApplicationCommandOptionType.Attachment,
    },
  ],

  async script(client, interaction, debugStream) {
    const { videoModel } = getConfig("ai") as { videoModel: string };

    const prompt = interaction.options.getString("prompt", true);
    const image = interaction.options.getAttachment("image");

    if (image) {
      const mimeType = image.contentType;
      if (!mimeType || !mimeType.startsWith("image/")) {
        await interaction.editReply("Please provide an image file");
        return;
      }
    }

    let operation: GenerateVideosOperation;

    if (image) {
      const fileResponse = await fetch(image.url);
      const fileBlob = await fileResponse.blob();

      const userFile = await gemini.fileManager!.upload({
        file: fileBlob,
        config: {
          mimeType: image.contentType || "image/jpeg",
        },
      });

      operation = await gemini.model!.generateVideos({
        model: videoModel || "veo-2.0-generate-001",
        prompt,
        image: {
          mimeType: userFile.mimeType,
          gcsUri: userFile.uri,
        },
      });
    } else
      operation = await gemini.model!.generateVideos({
        model: videoModel || "veo-2.0-generate-001",
        prompt,
      });

    while (!operation.done) {
      await interaction.followUp("Generating your masterpiece...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await gemini.genAI!.operations.getVideosOperation({
        operation,
      });
    }

    if (
      operation.response &&
      operation.response.generatedVideos &&
      operation.response.generatedVideos.length > 0 &&
      operation.response.generatedVideos[0].video
    ) {
      const video = operation.response.generatedVideos[0].video;

      try {
        const videoResponse = await fetch(video.uri!);

        if (!videoResponse.ok) {
          await interaction.followUp("Failed to retrieve the generated video.");
          return;
        }

        const videoBuffer = await videoResponse.arrayBuffer();

        // Create a temporary file for the video
        const videoFileName = `ai_video_${Date.now()}.mp4`;
        createTempDataFile(videoFileName, Buffer.from(videoBuffer));

        // Create the file path for Discord attachment
        const tempFilePath = path.join(process.cwd(), "temp", videoFileName);

        // Create Discord attachment
        const videoAttachment = new AttachmentBuilder(tempFilePath, {
          name: videoFileName,
          description: `AI-generated video: ${prompt.substring(0, 100)}${
            prompt.length > 100 ? "..." : ""
          }`,
        });

        await interaction.followUp({
          content: "🎬 Your AI-generated video is ready!",
          files: [videoAttachment],
        });
      } catch (error) {
        debugStream?.write(`Error processing video: ${error}\n`);
        await interaction.followUp(
          "An error occurred while processing the generated video."
        );
      }
    } else {
      await interaction.followUp(
        "No video was generated. Please try again with a different prompt."
      );
    }
  },
};

export default command;
