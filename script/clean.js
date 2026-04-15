const fs = require("fs");
const path = require("path");

const IGNORE_DIRS = ["node_modules", ".next", ".git", "dist", "build"];
const EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".css"];

function removeComments(content) {
  let result = "";
  let isSingleLineComment = false;
  let isMultiLineComment = false;
  let isString = false;
  let stringChar = "";

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (
      !isSingleLineComment &&
      !isMultiLineComment &&
      (char === '"' || char === "'" || char === "`")
    ) {
      if (!isString) {
        isString = true;
        stringChar = char;
      } else if (char === stringChar && content[i - 1] !== "\\") {
        isString = false;
      }
    }

    // 2. Comments ki shuruat check karna
    if (!isString) {
      if (!isMultiLineComment && char === "/" && nextChar === "/") {
        isSingleLineComment = true;
        i++;
        continue;
      }
      if (!isSingleLineComment && char === "/" && nextChar === "*") {
        isMultiLineComment = true;
        i++;
        continue;
      }
    }

    // 3. Comments ka khatma check karna
    if (isSingleLineComment && (char === "\n" || char === "\r")) {
      isSingleLineComment = false;
    }
    if (isMultiLineComment && char === "*" && nextChar === "/") {
      isMultiLineComment = false;
      i++;
      continue;
    }

    // 4. Character add karna agar wo comment ka hissa nahi hai
    if (!isSingleLineComment && !isMultiLineComment) {
      result += char;
    }
  }
  return result;
}

function processFiles(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) processFiles(fullPath);
    } else if (EXTENSIONS.includes(path.extname(fullPath))) {
      const content = fs.readFileSync(fullPath, "utf8");
      const cleaned = removeComments(content);
      if (content !== cleaned) {
        fs.writeFileSync(fullPath, cleaned);
        console.log(`✅ Cleaned: ${file}`);
      }
    }
  });
}

processFiles("./");
