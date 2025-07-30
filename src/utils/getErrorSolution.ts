import getAllFiles from "./getAllFiles.js";
import path from "path";
import { fileURLToPath } from "url";
import getActionFile from "./getActionFile.js";
import Gemini from "#libs/Gemini.js";
import { ActionTypes } from "./getActions.js";
import CommandType from "#types/CommandType.js";
import ReactionType from "#types/ReactionType.js";
import ButtonType from "#types/ButtonType.js";
import ModalType from "#types/ModalType.js";
import StringMenuType from "#types/StringMenuType.js";
import getConfig from "./getConfig.js";
import { createPartFromUri, createUserContent } from "@google/genai";

const { enabled, model, fileManager } = Gemini();

/**
 * Analyzes error logs and debug information to generate a solution for action-related issues.
 * Utilizes Gemini AI to provide potential fixes based on error logs, debug logs, and action file contents.
 *
 * @param action - The action object that needs error analysis. Can be one of:
 *                 CommandType, ReactionType, RouteType, ButtonType, ModalType, or StringMenuType
 * @param actionType - The type of action being analyzed (from ActionTypes enum)
 *
 * @returns Promise<string | undefined> - Returns a generated solution string, or undefined if:
 *          - Gemini is not enabled or properly configured
 *          - Action is not in dev-only mode or debug is not enabled
 *          - Required log files are not found
 *          - Returns "No possible fix found" if necessary files are missing
 *
 * @requires Gemini AI configuration
 * @requires Action log files in specified directory structure
 * @requires Debug mode and dev-only mode enabled on action
 */
export default async function (
  action: CommandType | ReactionType | ButtonType | ModalType | StringMenuType,
  actionType: ActionTypes
) {
  const { geminiModel } = getConfig("ai") as { geminiModel: string };

  if (!enabled && (!model || !fileManager)) return;
  if (!action.isDevOnly || !action.enableDebug) return;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const errorFiles = getAllFiles(
    path.join(__dirname, "..", "..", "actionLogs", "errors")
  );
  const debugFiles = getAllFiles(
    path.join(__dirname, "..", "..", "actionLogs", "debugs")
  );

  let actionName = "N/A";

  switch (actionType) {
    case ActionTypes.Commands:
    case ActionTypes.Reactions:
      actionName = (action as CommandType | ReactionType).name;
      break;

    case ActionTypes.Buttons:
    case ActionTypes.Modals:
      actionName = (action as ButtonType | ModalType).customID;
      break;
  }

  const errorFile = errorFiles.find((errorFile) =>
    errorFile.endsWith(
      `${actionName}-${actionType.slice(0, actionType.length - 1)}.txt`
    )
  )!;
  const debugFile = debugFiles.find((debugFile) =>
    debugFile.endsWith(
      `${actionName}-${actionType.slice(0, actionType.length - 1)}.txt`
    )
  )!;
  const actionFile = await getActionFile(actionName, actionType)!;

  if (!errorFile || !debugFile || !actionFile) return "No possible fix found.";

  const result = await model!.generateContent({
    model: geminiModel || "gemini-2.5-flash",
    contents: createUserContent([
      "Summaries a fix for the error:",
      await fileToGenerativePart(errorFile, "text/plain"),
      await fileToGenerativePart(debugFile, "text/plain"),
      await fileToGenerativePart(actionFile, "text/typescript"),
    ]),
    config: { maxOutputTokens: 500 },
  });

  if (!result.text) throw new Error("Failed to fetch solution.");

  const solution = result.text;
  return solution;
}

async function fileToGenerativePart(path: string, mimeType: string) {
  const fileUpload = await fileManager!.upload({
    file: path,
    config: { mimeType },
  });

  return createPartFromUri(fileUpload.uri!, fileUpload.mimeType!);
}
