"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    correctedText: { type: "string" },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["original", "corrected", "explanation"],
      },
    },
    vocabulary: { type: "array", items: { type: "string" } },
    nextQuestion: { type: "string" },
  },
  required: ["correctedText", "corrections", "vocabulary", "nextQuestion"],
};

export const correctDescription = action({
  args: {
    imageUrl: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Debes iniciar sesión para usar el tutor.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Falta configurar OPENAI_API_KEY en Convex.");

    const imageUrl = args.imageUrl.trim();
    const text = args.text.trim();
    if (!/^https:\/\//i.test(imageUrl)) throw new Error("La fotografía debe usar una URL https.");
    if (!text || text.length > 2000) throw new Error("La descripción debe tener entre 1 y 2000 caracteres.");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "none" },
        max_output_tokens: 700,
        instructions:
          "You are a friendly English tutor for a Spanish-speaking learner. Check whether the English description matches the photograph. Correct grammar and unnatural expressions. Explain every correction briefly in Spanish. Keep the answer concise and encouraging.",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `Correct this description: ${text}` },
              { type: "input_image", image_url: imageUrl, detail: "low" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "english_tutor_correction",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "OpenAI no pudo generar la corrección.");

    const outputText = payload.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;

    if (!outputText) throw new Error("OpenAI devolvió una respuesta vacía.");
    return JSON.parse(outputText);
  },
});
