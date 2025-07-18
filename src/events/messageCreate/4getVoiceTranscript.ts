import getConfig from "#utils/getConfig.js";
import Gemini from "#libs/Gemini.js";
import createTempDataFile from "#utils/createTempDataFile.js";
import {
  createPartFromUri,
  createUserContent,
  Schema,
  Type,
} from "@google/genai";
import { Client, Message, OmitPartialGroupDMChannel } from "discord.js";
import { translate } from "bing-translate-api";

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.inGuild()) return;

  const { voiceMessageTranscript, defaultLanguage, geminiModel } = getConfig(
    "application",
    "misc",
    "ai"
  ) as {
    voiceMessageTranscript: boolean;
    defaultLanguage: string;
    geminiModel: string;
  };
  if (!voiceMessageTranscript) return;

  if (!message.deletable) return;
  if (message.author.id === client.user?.id) return;

  const voiceMessageFile = message.attachments.first();
  if (!voiceMessageFile || !voiceMessageFile.contentType?.startsWith("audio"))
    return;

  const gemini = Gemini();
  if (!gemini.enabled) return;

  try {
    if (!gemini.model || !gemini.fileManager) return;

    const fileRes = await fetch(voiceMessageFile.url).then((res) =>
      res.arrayBuffer()
    );

    createTempDataFile(
      `voiceMsg-${message.author.id}.mp3`,
      Buffer.from(fileRes)
    );

    const transcriptSchema: Schema = {
      description: "The transcript object.",
      type: Type.OBJECT,
      properties: {
        origin: {
          description: "The language code of the voice message",
          type: Type.STRING,
        },
        transcript: {
          description: "The transcript of the voice message",
          type: Type.STRING,
        },
      },
      required: ["origin", "transcript"],
      example: { origin: "en", transcript: "Hello world!" },
    };

    const fileUploadResult = await gemini.fileManager.upload({
      file: `temp/voiceMsg-${message.author.id}.mp3`,
      config: { displayName: "Voice Message", mimeType: "audio/mp3" },
    });

    const transcriptResult = await gemini.model.generateContent({
      model: geminiModel || "gemini-2.5-flash",
      contents: createUserContent([
        createPartFromUri(fileUploadResult.uri!, fileUploadResult.mimeType!),
        "Get the transcript of audio file.",
      ]),
      config: {
        responseJsonSchema: transcriptSchema,
        responseMimeType: "application/json",
      },
    });

    if (!transcriptResult.text) throw new Error("Failed to get transcript.");

    const transcriptData: { origin: string; transcript: string } = JSON.parse(
      transcriptResult.text
    );

    if (transcriptData.origin === defaultLanguage) return;
    else {
      const translateResult = await translate(
        transcriptData.transcript,
        undefined,
        defaultLanguage,
        true
      );

      if (translateResult)
        transcriptData.transcript = translateResult.correctedText
          ? translateResult.correctedText
          : translateResult.translation;
    }

    await message.channel.sendTyping();

    await message.reply({
      content:
        "> Voice Transcript\n\n" +
        (transcriptData.transcript.length > 1975
          ? transcriptData.transcript.slice(0, 1975) + "..."
          : transcriptData.transcript),
      allowedMentions: {
        repliedUser: false,
      },
    });
  } catch (error: any) {
    console.log(
      `[Error] Failed to process voice message from ${
        message.author.username
      }: ${error.message || error}`
    );
  }
}
