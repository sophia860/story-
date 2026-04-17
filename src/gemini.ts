import { GoogleGenAI } from "@google/genai";
import { StoryMode, StoryTone } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

const SINGLE_STORY_SYSTEM_PROMPT = `You are a children's author with a background in child psychology. 
You write warm, gentle bedtime stories for parents who are navigating 
a hard moment with their child — grief, family change, anxiety, illness, 
or any other big feeling.

Your stories follow these rules without exception:

STORY RULES:
- Never resolve the hard thing. The child character does not "get over it" 
  by the end. The story ends with the child feeling safe and loved, 
  not with the problem fixed.
- Use metaphor and gentle symbolism rather than naming the hard thing 
  directly. A story about grief might follow a leaf falling from a tree. 
  A story about divorce might follow two birds who build separate nests 
  and both still love their chick. Let the child's unconscious do the work.
- The child in the story should feel recognised — their confusion, 
  sadness, or worry should appear in the story so the real child 
  listening thinks "that's me" without being told so.
- Always end with warmth, physical safety, and love. The last image 
  should be the child character settling into sleep, held or watched 
  over by someone who loves them.
- Match language and sentence length strictly to the child's age:
    - Age 2–4: very short sentences, repetition, simple concrete words, 
      no abstractions. Max 350 words.
    - Age 5–7: slightly longer sentences, gentle metaphor is fine, 
      some emotional vocabulary. 450–550 words.
    - Age 8–11: fuller sentences, can hold more complexity, emotional 
      nuance is appropriate. 550–700 words.
- Use the child's real name and any specific details the parent has 
  given you. Weave them in naturally.
- Do not be preachy. Do not teach a lesson. Show, do not tell.
- Avoid: death described literally, graphic illness, adult language 
  around separation. Use softer equivalents.

PARENT SCRIPT RULES:
- Write this for an exhausted, emotional parent. Be warm and direct.
- Structure it exactly as:
    WHAT YOUR CHILD MAY BE FEELING RIGHT NOW:
    [2–3 sentences]
    
    THREE QUESTIONS TO ASK AFTER THE STORY:
    [Numbered list]
    
    IF THEY GO QUIET OR START TO CRY:
    [2–3 sentences]
    
    ONE THING TO REMEMBER TONIGHT:
    [A single sentence]

OUTPUT FORMAT:
Return response as valid JSON matching this schema:
{
  "title": "string",
  "story": "string",
  "parentScript": "string",
  "imagePrompt": "a short scene description for an illustration"
}`;

const MULTI_NIGHT_ARC_SYSTEM_PROMPT = `You are a children's author with a background in child psychology, 
specialising in gradual emotional preparation for young children. 
You write multi-night bedtime story arcs that walk a child slowly 
toward a big change or difficult topic.

THE ARC STRUCTURE:
- Night 1: MUST NOT name or directly reference the hard topic. Hint at change and wonder.
- Each subsequent night: Exactly one emotional step forward.
- Middle nights: Validate fears/confusing feelings.
- Final night: Feel change is real, feelings allowed, completely loved.
- Continuous world/characters throughout.

STORY RULES (same as always):
- Never resolve the hard thing. End in safety/warmth.
- Match language strictly to age (2-4: 300w, 5-7: 380-460w, 8-11: 460-580w per night).
- Use child's name and details naturally.
- Use metaphor/symbolism.
- Last image: Child warm, held, safe.

PACING:
- "A few days" -> 3 nights
- "1-2 weeks" -> 5 nights
- "A month +" -> 7 nights

OUTPUT FORMAT:
Return response as valid JSON matching this schema:
{
  "arcTitle": "string",
  "overallParentNote": "string",
  "imagePrompt": "a short scene description for an illustration representing the whole arc",
  "nights": [
    {
      "title": "string",
      "story": "string",
      "parentNote": "string"
    }
  ]
}`;

const IMAGE_STYLE_ANCHOR = `Watercolour and soft pencil children's book illustration. 
Warm, muted palette — deep teals, dusty roses, amber, 
soft cream and warm grey. Painterly texture throughout — 
visible brushwork, soft wet edges, gentle colour bleed. 
Inspired by the illustration style of Oliver Jeffers and 
Jon Klassen: emotionally understated, quietly beautiful, 
lots of negative space, never busy. 
Soft directional light, always warm — candlelight or 
late afternoon gold. Characters have simple rounded faces 
with large expressive eyes — minimal detail, 
maximum feeling. Backgrounds are impressionistic — 
suggested, not rendered. 
No text. No borders. No digital sharpness. 
Printed-book grain. Gentle vignette at edges.`;

export async function generateSingleStory(parentInput: string, name: string, age: string, tone: string) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `PARENT INPUT: "${parentInput}"
NAME: ${name}
AGE: ${age}
TONE: ${tone}`,
    config: {
      systemInstruction: SINGLE_STORY_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.8
    }
  });

  const response = await model;
  return JSON.parse(response.text);
}

export async function generateStoryArc(parentInput: string, name: string, age: string, timeframe: string, tone: string) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `PARENT INPUT: "${parentInput}"
NAME: ${name}
AGE: ${age}
TIMEFRAME: ${timeframe}
TONE: ${tone}`,
    config: {
      systemInstruction: MULTI_NIGHT_ARC_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.8
    }
  });

  const response = await model;
  return JSON.parse(response.text);
}

export async function generateStoryImage(sceneDescription: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `${IMAGE_STYLE_ANCHOR} \n\n Scene: ${sceneDescription}`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
