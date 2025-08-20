export default function (
  functionResults: {
    functionName: string;
    success: boolean;
    data: any;
    callIndex?: number;
  }[],
  data: any
) {
  let updatableData = { ...data };

  // Validate that all required function results are available
  const validatePlaceholders = (value: any): string[] => {
    const missingPlaceholders: string[] = [];

    if (typeof value === "string") {
      const matches = value.match(/(\w+)::([^:]+)::(\d+)/g);
      if (matches) {
        matches.forEach((match) => {
          const [, functionName, dataPath, callIndexStr] = match.match(
            /(\w+)::([^:]+)::(\d+)/
          )!;
          const index = parseInt(callIndexStr);

          // Find all results with the same function name in execution order
          const matchingResults = functionResults.filter(
            (result) => result.functionName === functionName && result.success
          );

          // Sort by callIndex (execution order) to ensure consistent ordering
          matchingResults.sort(
            (a, b) => (a.callIndex || 0) - (b.callIndex || 0)
          );

          // Check if we have enough results for the requested index
          if (matchingResults.length <= index) {
            missingPlaceholders.push(
              `${functionName}[${index}] - only found ${matchingResults.length} results`
            );
          } else {
            // Validate the data path exists
            const targetResult = matchingResults[index];
            let actualPath = dataPath.startsWith("data.")
              ? dataPath.substring(5)
              : dataPath;
            const pathParts = actualPath.split(".");
            let extractedValue = targetResult.data;

            for (const part of pathParts) {
              if (extractedValue && typeof extractedValue === "object") {
                extractedValue = extractedValue[part];
              } else {
                extractedValue = undefined;
                break;
              }
            }

            if (extractedValue === undefined) {
              missingPlaceholders.push(
                `${functionName}[${index}].${actualPath} - path not found in result data`
              );
            }
          }
        });
      }
    }
    return missingPlaceholders;
  };

  // Check all string values recursively for missing placeholders
  const checkForMissingPlaceholders = (
    obj: any,
    path: string = ""
  ): string[] => {
    const missing: string[] = [];

    if (typeof obj === "string") {
      missing.push(...validatePlaceholders(obj));
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        missing.push(...checkForMissingPlaceholders(item, `${path}[${index}]`));
      });
    } else if (typeof obj === "object" && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        missing.push(
          ...checkForMissingPlaceholders(value, path ? `${path}.${key}` : key)
        );
      });
    }

    return missing;
  };

  // Validate all placeholders before processing
  const missingPlaceholders = checkForMissingPlaceholders(updatableData);
  if (missingPlaceholders.length > 0) {
    console.error("Missing placeholder dependencies:", missingPlaceholders); //!DEBUG
    console.error(
      "Available function results:",
      functionResults.map(
        (r, index) =>
          `${r.functionName}[${index}] (callIndex: ${
            r.callIndex || "undefined"
          }): ${JSON.stringify(Object.keys(r.data || {}))}`
      )
    ); //!DEBUG
    throw new Error(
      `Cannot resolve placeholders: ${missingPlaceholders.join(", ")}`
    );
  }

  const processValue = (value: any): any => {
    if (typeof value === "string") {
      // Use regex to find and replace all placeholder patterns in the string
      return value.replace(
        /(\w+)::([^:]+)::(\d+)/g,
        (match, functionName, dataPath, callIndex) => {
          const index = parseInt(callIndex);

          // Find all results with matching function name and success status
          const matchingResults = functionResults.filter(
            (result) => result.functionName === functionName && result.success
          );

          // Sort by callIndex (execution order) to ensure consistent ordering
          matchingResults.sort(
            (a, b) => (a.callIndex || 0) - (b.callIndex || 0)
          );

          if (matchingResults.length > index) {
            const targetResult = matchingResults[index];

            // The dataPath might include 'data.' prefix which should be removed
            let actualPath = dataPath;
            if (dataPath.startsWith("data.")) {
              actualPath = dataPath.substring(5);
            }

            // Navigate through nested object properties if actualPath contains dots
            const pathParts = actualPath.split(".");
            let extractedValue = targetResult.data;

            for (let i = 0; i < pathParts.length; i++) {
              const part = pathParts[i];
              if (extractedValue && typeof extractedValue === "object") {
                extractedValue = extractedValue[part];
              } else {
                extractedValue = undefined;
                break;
              }
            }

            if (extractedValue !== undefined) {
              console.log(`Resolved placeholder ${match} -> ${extractedValue}`); //!DEBUG
              return extractedValue;
            } else {
              console.error(
                `Failed to extract value from path: ${actualPath} in result:`,
                targetResult.data
              ); //!DEBUG
            }
          } else {
            console.error(
              `Not enough results for ${functionName}[${index}]. Available: ${matchingResults.length}`,
              matchingResults.map((r, i) => `[${i}] callIndex: ${r.callIndex}`)
            ); //!DEBUG
          }

          return match; // Return original if no match found
        }
      );
    }
    return value;
  };

  // Process all properties recursively
  const processObjectRecursively = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(processObjectRecursively);
    } else if (typeof obj === "object" && obj !== null) {
      const processed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = processObjectRecursively(value);
      }
      return processed;
    } else {
      return processValue(obj);
    }
  };

  updatableData = processObjectRecursively(updatableData);

  console.log(
    "Placeholder processing completed. Final data:",
    JSON.stringify(updatableData, null, 2)
  ); //!DEBUG

  return updatableData;
}
