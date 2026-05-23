# Architecture Document — AI-Powered Screenshot Semantic Search Application

## Executive Summary

This document outlines a production-grade architecture for a mobile-first AI application that enables users to search their screenshot library using natural language queries.

Example queries:

* “Show me the screenshot about React closures”
* “Find the payment confirmation from Amazon”
* “That WhatsApp chat about interview prep”
* “Linux boot error screenshot”
* “Pricing page I saved last month”

The proposed system is:

* privacy-first
* mobile-optimized
* offline-capable
* scalable to tens of thousands of screenshots
* designed around multimodal retrieval best practices

The recommendation is based on:

* current multimodal retrieval systems
* production search architectures
* GUI retrieval research
* CLIP/SigLIP ecosystem maturity
* mobile deployment constraints
* community benchmarking patterns
* commercial product analysis

Research strongly indicates:

> successful multimodal search systems are retrieval systems first, and LLM systems second. ([Reddit][1])

---

# 1. Product Requirements

## Functional Requirements

The application should:

* index screenshots automatically
* support natural language search
* work on-device
* support offline querying
* scale efficiently
* retrieve screenshots semantically
* understand UI/screenshots
* support OCR-heavy images
* understand chats, code, receipts, settings pages, browser screenshots

---

## Non-Functional Requirements

| Requirement                | Priority |
| -------------------------- | -------- |
| Low latency                | Critical |
| Privacy-first              | Critical |
| Battery efficiency         | Critical |
| Offline operation          | High     |
| Low RAM usage              | High     |
| Incremental indexing       | High     |
| Cross-platform portability | Medium   |
| Explainable retrieval      | Medium   |

---

# 2. Key Industry Insight

The most important architectural realization:

## Screenshot Search ≠ Traditional Image Search

Screenshots are fundamentally different from photos.

They contain:

* dense OCR text
* structured layouts
* UI hierarchies
* app-specific patterns
* mixed visual/text semantics

Traditional CLIP pipelines optimized for photography are insufficient alone.

Research on GUI retrieval demonstrates that GUI-aware multimodal representations significantly outperform generic visual retrieval systems for screenshot-style interfaces. ([arXiv][2])

---

# 3. Recommended System Architecture

```text
┌────────────────────┐
│ Screenshot Capture │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Preprocessing Layer│
└─────────┬──────────┘
          ↓
┌────────────────────────────────────┐
│ Understanding Pipeline             │
│                                    │
│ OCR                               │
│ App Detection                     │
│ UI Parsing                        │
│ Caption Generation                │
│ Topic Extraction                  │
│ Embedding Generation              │
└─────────┬──────────────────────────┘
          ↓
┌────────────────────┐
│ Hybrid Index Store │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Retrieval Engine   │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Semantic Reranker  │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Conversational UX  │
└────────────────────┘
```

---

# 4. Recommended Layered Design

# Layer 1 — Screenshot Ingestion

## Responsibilities

* detect new screenshots
* deduplicate
* normalize image sizes
* compress thumbnails
* extract metadata

---

## Pipeline

```text
Screenshot
   ↓
Hashing
   ↓
Metadata Extraction
   ↓
Thumbnail Generation
   ↓
Queue for AI Processing
```

---

## Recommendations

### Metadata to store

* timestamp
* app source
* screen resolution
* image hash
* EXIF
* folder/source

---

# Layer 2 — OCR & Structural Understanding

This layer is extremely important.

Most screenshot retrieval quality comes from OCR quality.

---

## Recommended OCR Stack

| Model            | Recommendation                |
| ---------------- | ----------------------------- |
| PaddleOCR        | Best balance                  |
| Apple Vision OCR | Excellent on iOS              |
| Google ML Kit    | Excellent Android integration |
| Tesseract        | Fallback only                 |

---

## Why OCR Matters

For screenshots:

* exact text retrieval dominates many queries
* embeddings alone are insufficient

Example:

> “Find the OTP screenshot”

Pure embeddings fail often.
OCR succeeds instantly.

Commercial systems heavily rely on OCR augmentation. ([SnapStash AI][3])

---

# Layer 3 — Embedding Generation (Core Retrieval Layer)

This is the most important AI layer.

NOT the LLM layer.

---

# Recommended Embedding Models

## Primary Recommendation

### SigLIP 2

Recommended because:

* excellent image-text alignment
* strong OCR-adjacent semantics
* good UI/screenshot performance
* efficient inference
* strong multilingual capability

SigLIP-based retrieval systems are increasingly used in multimodal search pipelines. ([exquisitor.org][4])

---

## Secondary Candidates

| Model              | Strength               |
| ------------------ | ---------------------- |
| MobileCLIP         | Best mobile efficiency |
| CLIP ViT-L/14      | Mature ecosystem       |
| Jina CLIP v2       | Strong retrieval       |
| Qwen VL embeddings | Promising but heavier  |

Community testing suggests MobileCLIP may outperform SigLIP under mobile constraints. ([Reddit][5])

---

# Important Architectural Principle

## Embeddings are NOT enough

Do not rely solely on vector similarity.

Pure embedding retrieval causes:

* false positives
* UI-layout confusion
* semantic drift
* OCR dominance issues

This is a known industry limitation. ([Reddit][1])

---

# Layer 4 — Semantic Enrichment

This layer dramatically improves retrieval quality.

---

## Purpose

Convert screenshots into:

* searchable semantic memories
* contextual summaries
* structured entities

---

# Recommended Semantic Model

## Gemma 4 E2B / E4B

Use for:

* caption generation
* semantic summaries
* entity extraction
* reranking
* conversational explanations

NOT for:

* primary retrieval

---

# Example Output

```json
{
  "summary": "WhatsApp conversation about frontend interview preparation",
  "entities": ["React", "Interview", "Rahul"],
  "topics": ["job prep", "frontend"],
  "app": "WhatsApp",
  "ocr_text": "...",
  "embedding": [...]
}
```

---

# Why This Layer Matters

Embeddings retrieve similarity.

Semantic enrichment retrieves meaning.

This solves queries like:

* “that thing about interviews”
* “pricing comparison page”
* “Linux setup notes”

Commercial screenshot systems use summaries + categorization extensively. ([SnapStash AI][3])

---

# Layer 5 — Hybrid Indexing System

This is where production systems differentiate themselves.

---

# Recommended Storage Architecture

## SQLite + Vector Extension

Recommended stack:

| Purpose          | Technology              |
| ---------------- | ----------------------- |
| Metadata         | SQLite                  |
| Vector Search    | sqlite-vss / sqlite-vec |
| Full-text Search | SQLite FTS5             |

---

# Why Hybrid Retrieval Wins

Use:

* OCR search
* metadata filters
* semantic vectors
* app filters
* timestamp filters

simultaneously.

---

# Retrieval Strategy

```text
Query
  ↓
Query Understanding
  ↓
Parallel Retrieval:
   - OCR search
   - Vector search
   - Metadata filtering
  ↓
Merge Candidates
  ↓
Reranking
  ↓
Final Results
```

This architecture consistently outperforms pure vector retrieval. ([Reddit][1])

---

# Layer 6 — Reranking Layer (Critical)

This is the hidden secret of high-quality retrieval systems.

---

# Why Reranking Matters

ANN/vector retrieval optimizes recall.

Reranking optimizes precision.

Without reranking:

* results feel random
* similar UIs cluster badly
* noisy screenshots dominate

---

# Recommended Flow

```text
Vector Search
   ↓
Top 50 Candidates
   ↓
Gemma Semantic Reranker
   ↓
Top 5 Final Results
```

Research strongly supports cascaded embedding + reranking systems. ([arXiv][6])

---

# Layer 7 — Conversational Search UX

Optional but highly differentiating.

---

# Example UX

User:

> “What was I researching about Linux last week?”

System:

* retrieves screenshots
* summarizes themes
* clusters related screenshots
* generates contextual response

This becomes:

## Personal Visual Memory

Not just image search.

---

# 5. Mobile Optimization Strategy

# Core Constraint

Mobile thermal throttling becomes the real bottleneck.

---

# Recommended Mobile Strategy

## On-device:

* OCR
* embeddings
* vector search
* lightweight reranking

## Deferred/background:

* summarization
* semantic enrichment
* clustering

---

# Quantization Recommendations

| Model     | Quantization |
| --------- | ------------ |
| SigLIP    | INT8         |
| Gemma E2B | Q4_K_M       |
| OCR       | FP16         |

---

# Recommended Runtime

| Runtime      | Recommendation        |
| ------------ | --------------------- |
| llama.cpp    | Best ecosystem        |
| MediaPipe    | Mobile-native         |
| ONNX Runtime | Excellent portability |
| CoreML       | Best iOS              |
| NNAPI        | Best Android          |

---

# 6. Privacy Architecture

This app’s strongest competitive advantage should be:

## fully local processing

---

# Recommended Policy

| Component  | Local |
| ---------- | ----- |
| OCR        | Yes   |
| Embeddings | Yes   |
| Search     | Yes   |
| Metadata   | Yes   |
| Vector DB  | Yes   |

Optional cloud:

* encrypted backup only

---

# 7. Retrieval Quality Improvements

# Important Enhancement Techniques

---

## A. Multi-Representation Indexing

Store:

* OCR text
* embeddings
* summaries
* app metadata
* topics
* entities

Never store only embeddings.

---

## B. Screenshot-Type Classification

Classify:

* chats
* receipts
* code
* settings
* browsers
* maps
* documents

Then use retrieval specialization.

---

## C. Temporal Context

Users often remember:

* time
* sequence
* session context

Support:

* “last week”
* “during travel”
* “around interview season”

---

## D. Clustering

Cluster screenshots into:

* sessions
* topics
* workflows

This improves exploratory recall significantly.

---

# 8. Scaling Strategy

# Recommended Tiers

| Screenshot Count | Strategy            |
| ---------------- | ------------------- |
| <10k             | Exact vector search |
| 10k–100k         | HNSW ANN            |
| 100k+            | IVF-PQ              |

---

# Recommended Vector DB Evolution

| Scale       | DB         |
| ----------- | ---------- |
| MVP         | sqlite-vss |
| Mid-scale   | Qdrant     |
| Large-scale | Milvus     |

---

# 9. Suggested MVP Scope

# Phase 1

Build:

* OCR
* embeddings
* vector retrieval
* basic reranking

Do NOT build:

* agents
* memory graphs
* advanced reasoning

---

# Phase 2

Add:

* summaries
* app understanding
* semantic clustering
* conversational search

---

# Phase 3

Add:

* timeline intelligence
* proactive memory surfacing
* cross-device synchronization
* multimodal RAG

---

# 10. Final Technology Recommendations

| Layer                  | Recommendation    |
| ---------------------- | ----------------- |
| OCR                    | PaddleOCR         |
| Embeddings             | SigLIP 2          |
| Lightweight mobile alt | MobileCLIP        |
| Semantic model         | Gemma 4 E2B       |
| Vector DB              | sqlite-vss        |
| Metadata DB            | SQLite            |
| Search                 | Hybrid            |
| Reranker               | Gemma             |
| Runtime                | llama.cpp         |
| Quantization           | Q4/INT8           |
| Mobile inference       | ONNX/CoreML/NNAPI |

---

# 11. Strategic Conclusions

## The Winning Insight

The best screenshot search systems are:

* retrieval systems
* not chatbot systems

---

# The Most Important Architectural Principle

## Search the MEMORY REPRESENTATION

Not the raw screenshot.

Each screenshot should become:

```json
{
  "ocr": "...",
  "summary": "...",
  "topics": [...],
  "entities": [...],
  "embedding": [...],
  "app": "...",
  "timestamp": "..."
}
```

This is the true searchable unit.

---

# Final Recommendation

## Best Current Architecture

```text
SigLIP 2
   ↓
Hybrid Retrieval
   ↓
Gemma Reranking
   ↓
Conversational UX
```

This architecture currently represents the best balance of:

* retrieval quality
* mobile feasibility
* privacy
* latency
* scalability
* implementation realism

for a production-grade screenshot semantic search application.

Sources referenced:

* GUI retrieval research ([arXiv][2])
* Cascaded retrieval/reranking systems ([arXiv][6])
* Commercial multimodal search implementations ([SnapStash AI][3])
* Local-first multimodal search architectures ([Clipwise][7])
* Community engineering discussions ([Reddit][1])

[1]: https://www.reddit.com/r/MachineLearning/comments/1hgwcb0?utm_source=chatgpt.com "[D] google photos like semantic search"
[2]: https://arxiv.org/abs/2405.00145?utm_source=chatgpt.com "GUing: A Mobile GUI Search Engine using a Vision-Language Model"
[3]: https://www.snapstash.app/?utm_source=chatgpt.com "SnapStash AI - AI Screenshot Organizer & Search App"
[4]: https://exquisitor.org/?utm_source=chatgpt.com "Exquisitor — Interactive Image and Video Search"
[5]: https://www.reddit.com/r/MLQuestions/comments/1n01m43/what_is_the_best_cliplike_model_for_video_search/?utm_source=chatgpt.com "What is the best CLIP-like model for video search right now?"
[6]: https://arxiv.org/abs/2512.12935?utm_source=chatgpt.com "Unified Interactive Multimodal Moment Retrieval via Cascaded Embedding-Reranking and Temporal-Aware Score Fusion"
[7]: https://clipwise.sourceforge.io/?utm_source=chatgpt.com "Clipwise — Local AI search for images & videos"
