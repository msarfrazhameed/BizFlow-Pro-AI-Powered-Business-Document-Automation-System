import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { AnalysisResult, AgentStage, Classification, ExtractedField, Actions } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// --- Agent 1: Ingestion Agent ---
const runIngestionAgent = async (input: string | { base64: string; mimeType: string }): Promise<string> => {
  // If input is already text, we treat it as "extracted"
  if (typeof input === 'string') {
    return input;
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        {
          inlineData: {
            data: input.base64,
            mimeType: input.mimeType,
          },
        },
        { 
          text: `You are the Ingestion Agent for BizFlow Pro. 
Input may be a PDF, image, or text. 
If image/PDF, extract the text using OCR. 
Return only the raw text. 
Do not add any explanations.` 
        }
      ],
    },
  });

  if (!response.text) throw new Error("Ingestion Agent failed to extract text.");
  return response.text;
};

// --- Agent 2: Classification Agent ---
const runClassificationAgent = async (text: string): Promise<Classification> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "Document type (e.g., invoice, email, complaint, leave request, proposal)" },
      domain: { type: Type.STRING, description: "Business domain (e.g., HR, Finance, Support, Legal, Ops, Sales)" },
      urgency: { type: Type.INTEGER, description: "Urgency scale 1-5" },
      reason: { type: Type.STRING, description: "Reason for urgency classification" },
    },
    required: ["category", "domain", "urgency", "reason"],
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [{
        text: `You are the Classification Agent for BizFlow Pro.
Input: raw text from the Ingestion Agent.
Tasks:
1. Predict document type (invoice, email, complaint, leave request, proposal).
2. Predict business domain (HR, Finance, Support, Legal, Ops, Sales).
3. Predict urgency (1–5 scale).
Output: JSON only.

RAW TEXT:
${text.substring(0, 15000)}`
      }],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("Classification Agent failed.");
  return JSON.parse(response.text) as Classification;
};

// --- Agent 3: Extraction Agent ---
const runExtractionAgent = async (text: string, classification: Classification): Promise<ExtractedField[]> => {
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        field: { type: Type.STRING },
        value: { type: Type.STRING },
        confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
      },
      required: ["field", "value", "confidence"],
    },
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [{
        text: `You are the Extraction Agent for BizFlow Pro.
Input: document text + classification JSON.
Tasks:
- Extract structured fields based on document type.
- Include confidence scores (0–1) for each field.
Examples:
- Invoice: vendor, amount, due date
- Complaint: sender, issue category, sentiment
- Sales lead: lead score, product interest
Output JSON only.

CLASSIFICATION:
${JSON.stringify(classification)}

RAW TEXT:
${text.substring(0, 15000)}`
      }],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("Extraction Agent failed.");
  return JSON.parse(response.text) as ExtractedField[];
};

// --- Agent 4: Action Agent ---
// NOTE: Input is strictly Classification + Extraction. Raw text is NOT passed to this agent.
const runActionAgent = async (classification: Classification, extraction: ExtractedField[]): Promise<{ actions: Actions, summary: string }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      primary_action: { type: Type.STRING, description: "Primary recommended action (1 sentence)" },
      secondary_actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 secondary actions" },
      workflow: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Sequential workflow steps" },
      summary_text: { type: Type.STRING, description: "Short summary for text-to-speech (1-2 sentences)" },
      generated_actions: {
        type: Type.ARRAY,
        description: "List of actionable drafts for the user.",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "Button label, e.g., 'Send Email'" },
            action_type: { type: Type.STRING, enum: ['email', 'sheet', 'slack_message', 'save_pdf'] },
            enabled: { type: Type.BOOLEAN },
            tooltip: { type: Type.STRING },
            content: {
              type: Type.OBJECT,
              properties: {
                to: { type: Type.STRING },
                subject: { type: Type.STRING },
                body: { type: Type.STRING },
                headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                row: { type: Type.ARRAY, items: { type: Type.STRING } },
                message: { type: Type.STRING },
                recipient: { type: Type.STRING },
                channel: { type: Type.STRING },
              }
            }
          },
          required: ["label", "action_type", "enabled", "content"]
        }
      }
    },
    required: ["primary_action", "secondary_actions", "workflow", "summary_text", "generated_actions"],
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [{
        text: `You are the Action Agent for BizFlow Pro.
Input: structured fields JSON + classification JSON.
Tasks:
1. Recommend primary action (1 sentence).
2. Recommend secondary actions (2–3 items).
3. Generate sequential workflow steps.
4. Summarize in 1–2 sentences for voice output (TTS).
5. Generate ready-to-execute drafts ONLY IF EXPLICITLY RELEVANT based on the document context.
   - Email: Generate ONLY if the document implies sending an email (e.g., to a vendor for approval, replying to a complaint). If it is just an informational receipt or internal note, DO NOT generate an email draft.
   - Slack: Generate ONLY if the team needs to be alerted (e.g., high urgency, new lead).
   - Sheet: Generate if tabular data is extracted.
   - Save PDF: Always available.
   
   CRITICAL: Do not halluncinate email drafts for documents that don't need them.

Output JSON with "generated_actions" array containing specific drafts.

CLASSIFICATION:
${JSON.stringify(classification)}

EXTRACTION:
${JSON.stringify(extraction)}`
      }],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("Action Agent failed.");
  const data = JSON.parse(response.text);
  
  return {
    actions: {
      primary: data.primary_action,
      secondary: data.secondary_actions,
      workflow: data.workflow,
      generatedActions: data.generated_actions || [],
    },
    summary: data.summary_text
  };
};

// --- Helper: Voice Output (TTS) ---
export const generateVoiceSummary = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: {
      parts: [{ text }],
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("Failed to generate speech");
  return audioData;
};

// --- Main Orchestrator ---
export const analyzeDocument = async (
  input: string | { base64: string; mimeType: string },
  onProgress: (stage: AgentStage) => void
): Promise<AnalysisResult> => {
  try {
    // Step 1: Ingestion
    onProgress('ingestion');
    const rawText = await runIngestionAgent(input);

    // Step 2: Classification
    onProgress('classification');
    const classification = await runClassificationAgent(rawText);

    // Step 3: Extraction
    onProgress('extraction');
    const extraction = await runExtractionAgent(rawText, classification);

    // Step 4: Action Generation
    onProgress('action');
    const { actions, summary } = await runActionAgent(classification, extraction);

    onProgress('complete');
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      classification,
      extraction,
      actions,
      summary
    };

  } catch (error) {
    onProgress('error');
    console.error("Multi-agent system error:", error);
    throw error;
  }
};