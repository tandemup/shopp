import { storage } from "@/src/storage/storage";

const STORAGE_KEY = "@shopping/healthy-recipes-v1";
const FORMAT = "shopp-healthy-recipes";
const VERSION = 1;

function makeId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanText(value, maximum = 500) {
  return String(value || "").trim().slice(0, maximum);
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map((tag) => cleanText(tag, 40)).filter(Boolean))].slice(0, 20);
}

export function normalizeRecipe(value = {}) {
  const now = Date.now();
  return {
    id: cleanText(value.id, 120) || makeId(),
    title: cleanText(value.title, 120),
    youtubeUrl: cleanText(value.youtubeUrl, 2048),
    productTags: normalizeTags(value.productTags),
    category: cleanText(value.category, 60),
    budget: ["económica", "media"].includes(value.budget)
      ? value.budget
      : "económica",
    servings: Math.max(0, Math.min(24, Number(value.servings) || 0)),
    minutes: Math.max(0, Math.min(600, Number(value.minutes) || 0)),
    notes: cleanText(value.notes, 1000),
    createdAt: Number(value.createdAt) || now,
    updatedAt: Number(value.updatedAt) || now,
  };
}

export async function loadRecipes() {
  const stored = await storage.getJSON(STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.map(normalizeRecipe).filter((recipe) => recipe.title);
}

export async function saveRecipes(recipes) {
  const normalized = Array.isArray(recipes)
    ? recipes.map(normalizeRecipe).filter((recipe) => recipe.title)
    : [];
  await storage.setJSON(STORAGE_KEY, normalized);
  return normalized;
}

export function buildRecipesExport(recipes) {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    recipes: (recipes || []).map(normalizeRecipe),
  };
}

export function parseRecipesImport(payload) {
  if (
    !payload ||
    payload.format !== FORMAT ||
    payload.version !== VERSION ||
    !Array.isArray(payload.recipes)
  ) {
    throw new Error("El fichero no contiene recetas compatibles de Shopp.");
  }
  return payload.recipes.map(normalizeRecipe).filter((recipe) => recipe.title);
}

export const RECIPES_STORAGE_KEY = STORAGE_KEY;
