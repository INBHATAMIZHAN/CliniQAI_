import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";

const getApiKey = () => {
  // Try process.env (injected by Vite define)
  const fromProcess = process.env.GEMINI_API_KEY;
  if (fromProcess && fromProcess !== "undefined" && fromProcess !== "null") {
    return fromProcess.trim();
  }
  
  // Try import.meta.env (standard Vite way)
  const fromMeta = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (fromMeta && fromMeta !== "undefined" && fromMeta !== "null") {
    return fromMeta.trim();
  }

  return "";
};

const apiKey = getApiKey();

if (!apiKey) {
  console.warn("[GeminiService] GEMINI_API_KEY is missing or empty in both process.env and import.meta.env.");
} else {
  const maskedKey = apiKey.length > 8 
    ? apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
    : "***";
  console.log(`[GeminiService] API Key detected: "${maskedKey}" (Length: ${apiKey.length})`);
  
  if (!apiKey.startsWith("AIza")) {
    console.error(`[GeminiService] CRITICAL: API Key does not start with "AIza". It starts with: "${apiKey.substring(0, 4)}"`);
  }
}

const ai = new GoogleGenAI({ apiKey });

export const testAIConnection = async () => {
  if (!apiKey) return { success: false, error: "API Key missing in environment" };
  if (!apiKey.startsWith("AIza")) return { success: false, error: "Invalid key format (should start with AIza)" };
  
  try {
    // Try with the SDK first
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: "ping" }] }],
    });
    return { success: !!response.text, error: null };
  } catch (error: any) {
    console.error("[GeminiService] SDK Connection Test Failed:", error);
    
    // Try with direct fetch to get exact error from Google
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const fetchResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
      });
      const data = await fetchResponse.json();
      
      if (!fetchResponse.ok) {
        const googleError = data.error?.message || "Unknown Google API error";
        console.error("[GeminiService] Google API Error:", googleError);
        
        if (googleError.includes("API key not valid")) {
          return { 
            success: false, 
            error: "The API key you provided is invalid. Please generate a new one at aistudio.google.com/app/apikey" 
          };
        }
        
        return { success: false, error: googleError };
      }
    } catch (fetchError: any) {
      console.error("[GeminiService] Network error during test:", fetchError);
    }
    
    return { success: false, error: error.message || "Connection failed" };
  }
};

export const extractPrescriptionData = async (base64Image: string) => {
  if (!base64Image) {
    console.error("No image data provided to extractPrescriptionData");
    return {};
  }
  
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extract medical info from this prescription: 
    - Patient Name (Search for "Name", "Patient", "Mr/Ms/Mrs", "Name of Patient")
    - Phone, Age, Blood Group, BP, Symptoms, Doctor, Date
    - Medicines (Name, Dosage, Frequency, Duration).
    Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image
            }
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING },
            phone: { type: Type.STRING, description: "Patient phone number if mentioned" },
            age: { type: Type.NUMBER },
            bloodGroup: { type: Type.STRING, description: "Blood group if mentioned, e.g. O+, A-" },
            bp: { type: Type.STRING, description: "Blood pressure if mentioned, e.g. 120/80" },
            symptoms: { type: Type.STRING },
            doctorName: { type: Type.STRING },
            date: { type: Type.STRING },
            medicines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  frequency: { type: Type.STRING },
                  duration: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Error in extractPrescriptionData:", error);
    if (error.message?.includes("API key not valid")) {
      throw new Error("Invalid Gemini API Key. Please check your AI Studio Secrets.");
    }
    throw error;
  }
};

export const extractMedicalDocumentData = async (base64Image: string) => {
  if (!base64Image) {
    console.error("No image data provided to extractMedicalDocumentData");
    return {};
  }
  
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extract info from this medical doc (lab report, prescription, or ID). Identify type and extract: 
    - Patient Name (Search for "Name", "Patient", "Mr/Ms/Mrs", "Name of Patient")
    - Lab results (Test names, values, units, reference ranges)
    - Medicines (Name, Dosage, Frequency)
    - BP, Age, Phone.
    Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image
            }
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING, description: "Lab Report, Prescription, ID Card, or Other" },
            patientInfo: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                age: { type: Type.NUMBER },
                bloodGroup: { type: Type.STRING, description: "Blood group if mentioned" },
                phone: { type: Type.STRING },
                bp: { type: Type.STRING, description: "Blood pressure if mentioned" }
              }
            },
            extractedData: {
              type: Type.OBJECT,
              description: "Flexible object containing the specific data found in the document"
            },
            summary: { type: Type.STRING, description: "A brief summary of the document's content" }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Error in extractMedicalDocumentData:", error);
    if (error.message?.includes("API key not valid")) {
      throw new Error("Invalid Gemini API Key. Please check your AI Studio Secrets.");
    }
    throw error;
  }
};

export const analyzeDrugSafety = async (medicines: any[], patientHistory: any) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following medicines for a patient with the given medical history.
    Check for:
    1. Drug-Drug Interactions
    2. Duplicate medicines (same class or active ingredient)
    3. Overdose risks
    4. Allergy conflicts (based on patient history)
    
    Medicines: ${JSON.stringify(medicines)}
    Patient History: ${JSON.stringify(patientHistory)}
    
    Return a list of safety alerts if any risks are found.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "Interaction, Duplicate, Allergy, or Overdose" },
            severity: { type: Type.STRING, description: "High, Medium, Low" },
            message: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const predictHealthRisks = async (vitals: any[], history: any[]) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze patient vitals and history to predict early health risks like Diabetes, Hypertension, or Anemia.
    Vitals: ${JSON.stringify(vitals)}
    History: ${JSON.stringify(history)}
    
    Return predicted risks and confidence levels.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            risk: { type: Type.STRING },
            confidence: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            prevention: { type: Type.STRING }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const speechToRecord = async (audioBase64: string) => {
  if (!audioBase64) {
    console.error("No audio data provided to speechToRecord");
    return {};
  }
  
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Convert this spoken medical prescription into a structured digital record.
    Extract: Patient Name, Phone, BP (Blood Pressure), Medicines (Name, Dosage, Frequency).
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "audio/wav",
              data: audioBase64
            }
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING },
            phone: { type: Type.STRING },
            bp: { type: Type.STRING },
            medicines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  frequency: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error in speechToRecord:", error);
    return {};
  }
};

export const explainPrescriptionSimple = async (medicines: any[], language: string) => {
  if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
    return "No medicines found to explain.";
  }
  
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Explain the following prescription in very simple, easy-to-understand language for a patient.
    The explanation must be in ${language}.
    Focus on:
    1. What each medicine is for.
    2. How and when to take it.
    3. Any important precautions.
    
    Medicines: ${JSON.stringify(medicines)}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "Could not generate explanation.";
  } catch (error: any) {
    console.error("Error in explainPrescriptionSimple:", error);
    if (error.message?.includes("API key not valid")) {
      throw new Error("Invalid Gemini API Key. Please check your AI Studio Secrets.");
    }
    return "Error generating explanation.";
  }
};

export const chatWithAssistant = async (message: string, history: any[], language: string) => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are a helpful and empathetic AI Health Assistant for ClinIQ AI.
    Your goal is to help patients understand their health, medications, and dosages.
    Always respond in ${language}.
    Keep your answers simple, accurate, and supportive.
    If asked for medical advice beyond general information, advise the patient to consult their doctor.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction,
    }
  });

  return response.text;
};

export const analyzeClinicalRisk = async (prescription: any, history: any[]) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following new prescription against the patient's medical history.
    Check for:
    1. Overdose risk (e.g. too much Paracetamol in 24h)
    2. Drug interactions with current medications
    3. Repeat antibiotic usage (e.g. same antibiotic multiple times recently)
    4. Chronic disease pattern conflicts
    
    New Prescription: ${JSON.stringify(prescription)}
    Patient History: ${JSON.stringify(history)}
    
    Return a list of specific clinical alerts.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            severity: { type: Type.STRING },
            message: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const detectDiseasePatterns = async (history: any[]) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this patient's visit history for recurring symptoms or disease patterns.
    Look for:
    - Repeat fevers
    - Symptom recurrence
    - Pattern suggesting specific conditions (e.g. Typhoid, Diabetes, Malaria)
    
    History: ${JSON.stringify(history)}
    
    Return a list of pattern detections and suggested risks.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pattern: { type: Type.STRING },
            suggestedRisk: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            nextSteps: { type: Type.STRING }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const voicePrescriptionToDigital = async (transcript: string) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert medical transcriptionist. Convert the following doctor's spoken prescription into a structured digital record.
    The transcript may be messy or contain filler words. Focus on extracting the medical intent.
    
    Extract:
    - Patient Name: If mentioned (e.g., "For Mr. Sharma...").
    - Phone: Patient phone number if mentioned.
    - BP: Blood pressure if mentioned (e.g., "120 over 80").
    - Medicines: An array of objects, each containing:
      - name: The medication name (e.g., "Paracetamol").
      - dosage: The strength or amount (e.g., "650mg", "5ml").
      - frequency: How often to take it (e.g., "twice a day", "every 8 hours", "SOS").
      - instructions: Any specific notes (e.g., "after food", "before bed").
    
    Transcript: "${transcript}"
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          patientName: { type: Type.STRING },
          phone: { type: Type.STRING },
          bp: { type: Type.STRING },
          medicines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING },
                instructions: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateSpeech = async (text: string) => {
  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};
