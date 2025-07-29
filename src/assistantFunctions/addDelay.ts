import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "delay",
  description:
    "Wait for a specified amount of time before continuing execution.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      duration: {
        type: Type.NUMBER,
        description: "The amount of time to wait in milliseconds.",
        example: 5000,
      },
      unit: {
        type: Type.STRING,
        description:
          "The time unit for the duration. Options: 'milliseconds', 'seconds', 'minutes'.",
        example: "seconds",
      },
      message: {
        type: Type.STRING,
        description:
          "Optional message to include in the response about what we're waiting for.",
        example: "Waiting for Discord rate limits to reset",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["duration"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          delayDuration: {
            type: Type.NUMBER,
            description:
              "The actual delay duration in milliseconds that was executed.",
            example: 5000,
          },
          unit: {
            type: Type.STRING,
            description: "The time unit that was used.",
            example: "seconds",
          },
          message: {
            type: Type.STRING,
            description: "The message about what was being waited for.",
            example: "Waiting for Discord rate limits to reset",
          },
          startedAt: {
            type: Type.STRING,
            description: "The timestamp when the delay started.",
          },
          completedAt: {
            type: Type.STRING,
            description: "The timestamp when the delay completed.",
          },
        },
        required: ["delayDuration", "unit", "startedAt", "completedAt"],
      },
    },
  },
};

export const script = async (
  client: Client,
  channelID: string,
  userID: string,
  functionResults: {
    functionName: string;
    success: boolean;
    data: any;
    callIndex?: number;
  }[],
  data: any
) => {
  const functionName = "delay";

  try {
    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    // Validate duration
    if (
      typeof updatableData.duration !== "number" ||
      updatableData.duration < 0
    ) {
      return {
        functionName,
        success: false,
        data: "Duration must be a positive number",
      };
    }

    // Convert duration to milliseconds based on unit
    let delayMs = updatableData.duration;
    const unit = updatableData.unit || "milliseconds";

    switch (unit.toLowerCase()) {
      case "seconds":
        delayMs = updatableData.duration * 1000;
        break;
      case "minutes":
        delayMs = updatableData.duration * 60 * 1000;
        break;
      case "milliseconds":
        delayMs = updatableData.duration;
        break;
      default:
        return {
          functionName,
          success: false,
          data: `Invalid unit: ${unit}. Use 'milliseconds', 'seconds', or 'minutes'`,
        };
    }

    // Validate maximum delay (prevent extremely long delays)
    const maxDelayMs = 10 * 60 * 1000; // 10 minutes
    if (delayMs > maxDelayMs) {
      return {
        functionName,
        success: false,
        data: `Delay duration exceeds maximum allowed time of ${maxDelayMs}ms (10 minutes)`,
      };
    }

    const startedAt = new Date();

    // Execute the delay
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const completedAt = new Date();

    return {
      functionName,
      success: true,
      data: {
        delayDuration: delayMs,
        unit: unit,
        message:
          updatableData.message ||
          `Waited for ${updatableData.duration} ${unit}`,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      functionName,
      success: false,
      data: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
