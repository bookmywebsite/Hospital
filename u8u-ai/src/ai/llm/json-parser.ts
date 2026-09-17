
export function safeJsonParse<T = Record<string, unknown>>(
  jsonString: string,
  fallback?: T
): T {
  if (!jsonString?.trim()) {
    return (fallback || {}) as T;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn("[JsonParser] Direct parse failed, trying cleanup");
  }

  try {
    let cleaned = jsonString;
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
      const content = match.replace(/```(?:json)?|```/g, "").trim();
      return content || "{}";
    });
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
    cleaned = cleaned.trim();

    if (!cleaned.startsWith("{")) {
      const startIdx = cleaned.indexOf("{");
      if (startIdx !== -1) {
        cleaned = cleaned.slice(startIdx);
      }
    }
    if (!cleaned.endsWith("}")) {
      const endIdx = cleaned.lastIndexOf("}");
      if (endIdx !== -1) {
        cleaned = cleaned.slice(0, endIdx + 1);
      }
    }

    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("[JsonParser] Failed to parse JSON:", jsonString, error);
    return (fallback || {}) as T;
  }
}
