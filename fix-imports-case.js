const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "src");
console.log("__dirname ", __dirname);
//console.log("ROOT ", ROOT);
const FIXES = [
  [/PricingEngine/g, "pricingEngine"],
  [/PromotionUtils/g, "promotionUtils"],
  [/FormatCurrency/g, "formatCurrency"],
];

// Extensiones a revisar
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (EXTENSIONS.includes(path.extname(file))) {
        results.push(filePath);
      }
    }
  });

  return results;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let original = content;

  FIXES.forEach(([regex, correct]) => {
    content = content.replace(regex, correct);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log("✔ Fixed:", filePath);
  }
}

function run() {
  const files = walk(ROOT);
  files.forEach(fixFile);
  console.log("\n✅ Import fix completed");
}

run();
