import config from '#config' with { type: 'json' };
import Gemini from '#libs/Gemini.js';
import createTempDataFile from '#utils/createTempDataFile.js';
import { Schema, SchemaType } from '@google/generative-ai';
import { Client, Message, OmitPartialGroupDMChannel } from 'discord.js';
import { translate } from 'bing-translate-api';

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  const { enableVoiceMessageTranscript, translationLanguage } = config;
  if (!enableVoiceMessageTranscript) return;

  if (!message.deletable) return;
  if (message.author.id === client.user?.id) return;

  const voiceMessageFile = message.attachments.first();
  if (!voiceMessageFile || !voiceMessageFile.contentType?.startsWith('audio'))
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
      description: 'The transcript object.',
      type: SchemaType.OBJECT,
      properties: {
        origin: {
          description: 'The language code of the voice message',
          type: SchemaType.STRING,
        },
        transcript: {
          description: 'The transcript of the voice message',
          type: SchemaType.STRING,
        },
      },
      required: ['origin', 'transcript'],
      example: { origin: 'en', transcript: 'Hello world!' },
    };

    const fileUploadResult = await gemini.fileManager.uploadFile(
      `temp/voiceMsg-${message.author.id}.mp3`,
      {
        mimeType: 'audio/mp3',
        displayName: 'Voice Message',
      }
    );

    gemini.model.generationConfig.responseMimeType = 'application/json';
    gemini.model.generationConfig.responseSchema = transcriptSchema;

    const transcriptResult = await gemini.model.generateContent([
      {
        fileData: {
          fileUri: fileUploadResult.file.uri,
          mimeType: fileUploadResult.file.mimeType,
        },
      },
      'Get the transcript of audio file.',
    ]);

    const transcriptData: { origin: string; transcript: string } = JSON.parse(
      transcriptResult.response.text()
    );

    if (transcriptData.origin === translationLanguage) return;
    else {
      const translateResult = await translate(
        transcriptData.transcript,
        undefined,
        translationLanguage,
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
        '> Voice Transcript\n\n' +
        (transcriptData.transcript.length > 1975
          ? transcriptData.transcript.slice(0, 1975) + '...'
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
