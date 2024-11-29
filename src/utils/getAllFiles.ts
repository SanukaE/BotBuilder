import fs from 'fs';
import path from 'path';

export default function (directory: string, isFoldersOnly = false) {
  let fileNames: string[] = [];

  const files = fs.readdirSync(directory, { withFileTypes: true });

  files.forEach((file) => {
    const filePath = path.join(directory, file.name);

    if (isFoldersOnly) {
      if (file.isDirectory()) {
        fileNames.push(filePath);
      }
    } else {
      if (file.isFile()) {
        fileNames.push(filePath);
      }
    }
  });

  return fileNames;
}
