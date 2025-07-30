import getConfig from "./getConfig.js";

export default function (messageContent: string, boosterMultiplier: number) {
  const { baseXpPerChar, maxMessageLength } = getConfig("experience") as {
    baseXpPerChar: number;
    maxMessageLength: number;
  };

  const cleanMessage = messageContent.trim();
  const lengthFactor = Math.min(cleanMessage.length, maxMessageLength);
  const baseXP = lengthFactor * baseXpPerChar;
  const totalXP = boosterMultiplier ? baseXP * boosterMultiplier : baseXP;

  return Math.floor(totalXP); // Round down to keep it clean
}
