
# Comprehensive Gap Analysis Report
**Date:** 2026-07-14
**Project:** Hospital RAG Voice AI
**Status:** Migration In Progress

---

## Executive Summary

The repository is mid-migration to an Agent + RAG architecture. Most core components (Planner, Memory, Tools, RAG) exist, but we're missing enterprise-grade abstractions (LLM service, Prompt service, Agent layer, etc.) and there are parallel implementations (old vs new architecture) that need unification.

---

## 1. Gap Analysis Checklist

### ✅ Already Implemented

| Item | Location | Status |
|------|----------|--------|
| **Planner** | `src/ai/planner/` | ✅ Complete |
| **Memory** | `src/ai/memory/` | ✅ Complete |
| **Tool Registry** | `src/ai/tools/` | ✅ Complete |
| **Retriever/RAG** | `src/ai/rag/` | ✅ Complete |
| **Conversation Memory** | `src/ai/memory/types.ts` | ✅ Complete |
| **KnowledgeChunk Model** | Prisma schema | ✅ Complete |
| **Appointment Tool** | `src/ai/tools/appointment.tool.ts` | ✅ Complete |
| **Doctor Tool** | `src/ai/tools/doctor.tool.ts` | ✅ Complete |
| **Transfer Tool** | `src/ai/tools/transfer.tool.ts` | ✅ Complete |
| **Slot Filling** | `src/ai/memory/` | ✅ Complete |
| **Prompts (Planner)** | `src/ai/prompts/planner.prompt.ts` | ✅ Complete |
| **Deepgram** | `src/lib/voice/deepgram-stt.ts` | ✅ Untouched |
| **Exotel** | `src/lib/communications/exotel.ts` | ✅ Untouched |
| **Sarvam TTS** | `src/lib/voice/sarvam-tts.ts` | ✅ Untouched |
| **Azure TTS** | `src/lib/voice/azure-tts.ts` | ✅ Untouched |
| **Redis/BullMQ** | `src/lib/queue/` | ✅ Untouched |
| **Prisma Models** | Schema | ✅ Untouched |
| **Existing APIs** | `src/app/api/` | ✅ Untouched |

---

### ❌ Missing Enterprise Pieces

#### 1. Agent Layer
- ❌ `src/ai/agent/agent.service.ts`
- ❌ `src/ai/agent/agent.factory.ts`
- ❌ `src/ai/agent/agent.types.ts`
- ❌ `src/ai/agent/response-generator.ts`
- **Issue:** `websocket-handler` still talks directly to Planner
- **Priority:** Critical

#### 2. Shared LLM Layer
- ❌ `src/ai/llm/llm.service.ts`
- ❌ `src/ai/llm/provider.interface.ts`
- ❌ `src/ai/llm/groq.provider.ts`
- ❌ `src/ai/llm/prompt.service.ts`
- ❌ `src/ai/llm/json-parser.ts`
- **Issue:** Multiple `new Groq(...)` instances in:
  - `src/ai/planner/planner.ts`
  - `src/lib/voice/groq-brain.ts`
- **Priority:** Critical

#### 3. Response Generator
- ❌ Separate module for converting Planner decisions → natural language
- **Issue:** Planner still directly returns `say` fields with wording
- **Priority:** High

#### 4. Entity Extraction Layer
- ❌ `src/ai/conversation/entity-extractor.ts`
- **Issue:** Planner still parses raw transcripts directly
- **Priority:** High

#### 5. Context Builder
- ❌ `src/ai/context/context.service.ts`
- **Issue:** Planner still builds prompt manually
- **Priority:** High

#### 6. Vector Abstraction
- ⚠️ Retriever depends directly on ChromaDB (check embeddings)
- ❌ `src/ai/vector/vector.service.ts`
- ❌ `src/ai/vector/chroma.service.ts`
- **Priority:** Medium

#### 7. Dependency Injection
- ❌ No `AgentFactory` to wire components
- **Issue:** Components are instantiated with `new X()`
- **Priority:** High

#### 8. Prompt Registry
- ❌ No centralized `PromptService`
- **Issue:** Prompts are scattered
- **Priority:** High

#### 9. Telemetry
- ❌ `src/ai/telemetry/` directory
- **Issue:** No structured tracking
- **Priority:** Medium

#### 10. Production Error Handling
- ⚠️ No typed errors, retries, or structured logging
- **Priority:** High

#### 11. Feature Flags
- ❌ No `AGENT_MODE=true` flag for incremental migration
- **Priority:** Critical

#### 12. Integration
- ⚠️ `websocket-handler` has partial migration
- **Priority:** Critical

#### 13. `groq-brain.ts` Refactor
- ⚠️ Still has full business logic
- **Priority:** Medium

#### 14. `hospital-brain.ts` Refactor
- ✅ Exists but needs separation into Prompt Builders
- **Priority:** Medium

#### 15. Remove Hardcoded Flow
- ⚠️ `session.step` still present (commented out but not fully removed)
- **Priority:** High

#### 16. Preserve Existing Business Logic
- ✅ Tools use Prisma, but check Appointment/Doctor services
- **Priority:** Medium

#### 17. Testing
- ❌ No test directory for AI components
- **Priority:** Medium

---

## 2. Parallel Implementations (Dual Architecture)

This is the most critical issue: **two AI architectures exist side-by-side**

### Old Architecture (`src/lib/agents/`, `src/lib/voice/groq-brain.ts`)
- `groq-brain.ts` (full business logic)
- `hospital-brain.ts`
- `brain.ts`
- `voice.ts`

### New Architecture (`src/ai/`)
- Planner, Memory, Tools, RAG

**Problem:** We need a single architecture only!

---

## 3. Implementation Priority Roadmap

### Phase 1: Critical (Unify Architecture)
1. **Feature Flags** (`AGENT_MODE`)
2. **Shared LLM Layer**
3. **Agent Layer**
4. **Integration with `websocket-handler`**

### Phase 2: High (Cleanup)
5. **Prompt Registry**
6. **Response Generator**
7. **Entity Extractor**
8. **Context Builder**
9. **Remove Hardcoded Flow**

### Phase 3: Medium (Enterprise)
10. **Dependency Injection/Factory**
11. **Vector Abstraction**
12. **Telemetry**
13. **Error Handling**
14. **Testing**

---

## 4. File-by-File Plan

### Files to **Create**
| File | Purpose |
|------|---------|
| `src/ai/llm/provider.interface.ts` | LLM provider interface |
| `src/ai/llm/groq.provider.ts` | Groq provider implementation |
| `src/ai/llm/llm.service.ts` | Central LLM service |
| `src/ai/llm/prompt.service.ts` | Prompt registry |
| `src/ai/llm/json-parser.ts` | Safe JSON parsing |
| `src/ai/agent/agent.types.ts` | Agent types |
| `src/ai/agent/agent.service.ts` | Core Agent orchestration |
| `src/ai/agent/agent.factory.ts` | DI factory |
| `src/ai/agent/response-generator.ts` | Response generation |
| `src/ai/conversation/entity-extractor.ts` | Entity extraction |
| `src/ai/context/context.service.ts` | Context building |
| `src/ai/telemetry/telemetry.service.ts` | Tracking |

### Files to **Modify**
| File | Changes |
|------|---------|
| `src/ai/planner/planner.ts` | Use LlmService, remove direct Groq, return only structured decisions |
| `src/ai/prompts/planner.prompt.ts` | Move to PromptService |
| `src/lib/voice/websocket-handler.ts` | Integrate AgentService, add feature flag |
| `src/lib/voice/groq-brain.ts` | Convert to thin LLM wrapper only |
| `.env.example` | Add `AGENT_MODE` flag |

### Files to **Leave Untouched**
- All telephony (Deepgram, Exotel, Sarvam, Azure)
- All Prisma models
- All APIs (except possible voice API if needed)
- Redis/BullMQ
- Frontend components

---

## 5. Next Steps

1. Start with Phase 1 (Critical)
2. Implement Feature Flag first
3. Build Shared LLM Layer
4. Build Agent Layer
5. Integrate
6. Cleanup old architecture

---

**End of Report**
