import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "response",
  description:
    "Send a response message to the user via the command interaction.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: {
        type: Type.STRING,
        description: "The message to send to the user.",
        example: "Task completed successfully!",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
        example: false,
      },
    },
    required: ["message"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          responseMessage: {
            type: Type.STRING,
            description: "The response message to be sent to the user.",
            example: "Task completed successfully!",
          },
          processedAt: {
            type: Type.STRING,
            description: "The timestamp when the response was processed.",
          },
        },
        required: ["responseMessage", "processedAt"],
      },
    },
  },
};

export const script = async (
  client: Client,
  channelID: string,
  userID: string,
  functionResults: { functionName: string; success: boolean; data: any }[],
  data: any
) => {
  const functionName = "response";

  try {
    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    const responseMessage = updatableData.message;

    return {
      functionName,
      success: true,
      data: {
        responseMessage,
        processedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return {
      functionName,
      success: false,
      data: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
