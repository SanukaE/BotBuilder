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

  const processValue = (value: any): any => {
    if (typeof value === "string") {
      // Use regex to find and replace all placeholder patterns in the string
      return value.replace(
        /(\w+)::([^:]+)::(\d+)/g,
        (match, functionName, dataPath, callIndex) => {
          const index = parseInt(callIndex);

          // Find specific indexed call
          const matchingResults = functionResults.filter(
            (result) => result.functionName === functionName
          );
          const targetResult = matchingResults[index];

          if (targetResult && targetResult.success) {
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

            return extractedValue !== undefined ? extractedValue : match;
          }

          return match; // Return original if no match found
        }
      );
    }
    return value;
  };

  // Process all properties recursively
  for (const [key, value] of Object.entries(updatableData)) {
    if (Array.isArray(value)) {
      updatableData[key] = value.map((item) =>
        typeof item === "object"
          ? Object.fromEntries(
              Object.entries(item).map(([k, v]) => [k, processValue(v)])
            )
          : processValue(item)
      );
    } else {
      updatableData[key] = processValue(value);
    }
  }

  return updatableData;
}
