import categories from "./categoryImagePrompts.json" with { type: "json" };
import { buildCategoryImagePrompt } from "./buildCategoryImagePrompt.js";

const category = categories[0];
console.log("------");
console.log(category);
const promptFinal = buildCategoryImagePrompt(category);

console.log(promptFinal);
