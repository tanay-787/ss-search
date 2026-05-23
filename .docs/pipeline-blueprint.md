# Blueprint — Android-Optimized AI Screenshot Search Pipeline Design

## Project Objective

Design a production-grade Android-first AI pipeline for a React Native (Expo Prebuild) application that enables:

* semantic screenshot search
* local/private inference
* offline functionality
* scalable indexing
* low-latency retrieval
* hybrid OCR + embedding search
* efficient operation on 6GB–8GB Android devices

This document defines:

* the complete sequential pipeline
* processing stages
* runtime behavior
* model lifecycle management
* Android-specific optimization strategies
* retrieval architecture
* memory orchestration
* background execution design

This is the authoritative pipeline blueprint.

---

# 1. SYSTEM DESIGN PRINCIPLES

Before defining stages, the system must obey these principles.

---

# Principle 1 — Retrieval First

The app is:

# a multimodal retrieval engine

NOT:

# a conversational AI system.

Meaning:

* embeddings are primary
* OCR is critical
* LLMs are auxiliary

---

# Principle 2 — Deferred Intelligence

Heavy AI tasks must:

* run asynchronously
* run incrementally
* run opportunistically

Never synchronously block the UI.

---

# Principle 3 — Android Thermal Awareness

The system must assume:

* CPU throttling
* background restrictions
* memory pressure
* app lifecycle interruptions

as normal operating conditions.

---

# Principle 4 — Model Isolation

No multiple large-model concurrency.

Only one major AI model may remain active at a time.

---

# Principle 5 — Searchable Memory Representation

The system searches:

# processed representations

NOT:

# raw screenshots.

---

# 2. HIGH-LEVEL PIPELINE

```text id="ogubk8"
Screenshot Capture
        ↓
Ingestion Queue
        ↓
Metadata Extraction
        ↓
OCR Processing
        ↓
Thumbnail Normalization
        ↓
Embedding Generation
        ↓
Hybrid Index Persistence
        ↓
Deferred Semantic Enrichment
        ↓
Searchable Memory Unit
        ↓
Hybrid Retrieval Engine
        ↓
Semantic Reranking
        ↓
Final User Results
```

---

# 3. PIPELINE STAGE 1 — SCREENSHOT INGESTION

# Objective

Efficiently detect and enqueue screenshots without triggering expensive AI work immediately.

---

# Android Strategy

## Components

| Component           | Responsibility          |
| ------------------- | ----------------------- |
| MediaStore observer | detect new screenshots  |
| Expo Media Library  | metadata access         |
| Kotlin service      | ingestion orchestration |

---

# Workflow

```text id="gkr9ll"
Screenshot created
        ↓
MediaStore event fires
        ↓
Path + metadata collected
        ↓
Deduplication hash generated
        ↓
Ingestion queue entry created
```

---

# Critical Optimizations

## A. NO immediate AI processing

Incorrect:

```text id="qq2c7u"
Screenshot → OCR immediately
```

Correct:

```text id="3e8xjz"
Screenshot → Queue
```

Reason:

* avoids UI stalls
* avoids thermal spikes
* survives Android process death

---

## B. Deduplication

Generate:

* SHA256
* perceptual hash

Avoid:

* duplicate screenshots
* repeated embedding generation

---

# Queue Table

```sql id="hjnfdb"
ingestion_queue (
  id TEXT,
  screenshot_id TEXT,
  stage INTEGER,
  priority INTEGER,
  created_at INTEGER,
  retry_count INTEGER,
  state INTEGER
)
```

---

# 4. PIPELINE STAGE 2 — METADATA EXTRACTION

# Objective

Extract lightweight searchable metadata before expensive inference.

---

# Extracted Metadata

| Field         | Purpose              |
| ------------- | -------------------- |
| timestamp     | temporal filtering   |
| resolution    | preprocessing        |
| app package   | contextual filtering |
| folder/source | grouping             |
| orientation   | normalization        |

---

# App Detection Strategy

Infer originating app using:

* Android package heuristics
* screenshot naming conventions
* OCR app signatures

Example:

* WhatsApp green header
* YouTube UI patterns
* Amazon checkout elements

---

# Why Early Metadata Matters

Metadata retrieval is:

* nearly free
* extremely effective
* battery efficient

Many queries resolve via metadata alone.

---

# 5. PIPELINE STAGE 3 — OCR EXTRACTION

# Objective

Convert screenshots into searchable text memories.

---

# Runtime

## Recommended Engine

# Google ML Kit OCR

Reason:

* Android optimized
* lightweight
* GPU/NPU aware
* low memory overhead

---

# OCR Processing Flow

```text id="5fijgq"
Queued Screenshot
        ↓
Bitmap decode
        ↓
Downscale if necessary
        ↓
ML Kit OCR
        ↓
Structured text extraction
        ↓
Persist OCR artifacts
```

---

# OCR Persistence Model

```json id="2uhgln"
{
  "raw_text": "...",
  "tokens": [...],
  "blocks": [...],
  "language": "en",
  "confidence": 0.94
}
```

---

# Android Optimization Rules

## A. Resize before OCR

Never OCR:

* 4K originals directly

Instead:

* scale intelligently

Target:

# ~1080p max dimension

---

## B. Batch OCR

Correct:

```text id="40n0bz"
5 screenshots
→ OCR batch
→ sleep
```

Incorrect:

```text id="n52a56"
5000 continuous OCR jobs
```

---

# OCR Importance

OCR solves:

* exact retrieval
* OTP lookup
* URLs
* usernames
* receipts
* error messages

Without OCR:
retrieval quality collapses.

---

# 6. PIPELINE STAGE 4 — IMAGE NORMALIZATION

# Objective

Prepare screenshots for efficient embedding generation.

---

# Core Principle

# NEVER embed full-resolution screenshots

---

# Correct Pipeline

```text id="th6xjp"
Original Screenshot
        ↓
Thumbnail generation
        ↓
Aspect ratio preserved
        ↓
Center padded if needed
        ↓
224x224 normalized image
```

---

# Target Format

Optimized for:

# SigLIP2 Base Patch16 224

---

# Why This Matters

Without normalization:

* embedding consistency degrades
* inference latency spikes
* RAM usage increases dramatically

---

# 7. PIPELINE STAGE 5 — EMBEDDING GENERATION

# Objective

Create semantic vector representations for retrieval.

---

# Runtime

## Package

# `react-native-siglip`

---

# Model

# `google/siglip2-base-patch16-224`

---

# Why This Variant

| Property         | Importance           |
| ---------------- | -------------------- |
| ViT-B scale      | mobile feasible      |
| 224 input        | fast inference       |
| strong alignment | screenshot retrieval |
| multilingual     | OCR synergy          |
| moderate RAM     | Android safe         |

---

# Embedding Flow

```text id="ww3r40"
224 thumbnail
        ↓
SigLIP image encoder
        ↓
Embedding vector generated
        ↓
Persist vector blob
```

---

# Query Embedding Flow

```text id="z59pxd"
User query
        ↓
SigLIP text encoder
        ↓
Query embedding
```

---

# Important Retrieval Principle

SigLIP becomes:

# the primary semantic retrieval engine.

NOT the LLM.

---

# Android Runtime Constraints

## NEVER run large embedding batches continuously

Correct:

```text id="wz0uws"
batch 20
→ persist
→ yield CPU
```

Incorrect:

```text id="wmp1xb"
embed 5000 continuously
```

---

# Estimated Device Behavior

| Device   | Throughput |
| -------- | ---------- |
| Midrange | 1–3/sec    |
| Flagship | 5–10/sec   |

---

# 8. PIPELINE STAGE 6 — HYBRID INDEX PERSISTENCE

# Objective

Persist searchable memory representations.

---

# Database Strategy

## SQLite-first architecture

---

# Components

| Layer      | Technology   |
| ---------- | ------------ |
| metadata   | SQLite       |
| OCR search | FTS5         |
| embeddings | blob vectors |
| future ANN | sqlite-vec   |

---

# Core Memory Representation

```json id="r0p5m2"
{
  "id": "...",
  "ocr": "...",
  "embedding": [...],
  "summary": "...",
  "topics": [...],
  "app": "...",
  "timestamp": "...",
  "thumbnail": "..."
}
```

---

# Important Design Principle

The searchable unit is:

# the memory representation

NOT the image file.

---

# 9. PIPELINE STAGE 7 — DEFERRED SEMANTIC ENRICHMENT

# Objective

Enhance retrieval quality asynchronously.

---

# Runtime

## `react-native-litert-lm`

---

# Model

# Gemma 3n E2B Quantized

---

# Responsibilities ONLY

| Task             | Allowed |
| ---------------- | ------- |
| captioning       | yes     |
| summaries        | yes     |
| topic extraction | yes     |
| reranking        | yes     |

---

# NOT Allowed

| Task             | Reason       |
| ---------------- | ------------ |
| continuous chat  | thermal cost |
| agents           | unnecessary  |
| autonomous loops | battery risk |

---

# Enrichment Flow

```text id="8lc9q6"
OCR + metadata + image
        ↓
Gemma enrichment
        ↓
summary generated
        ↓
topics extracted
        ↓
entities extracted
```

---

# Example

```json id="ch4xti"
{
  "summary": "WhatsApp discussion about frontend interviews",
  "topics": [
    "react",
    "interviews",
    "frontend"
  ]
}
```

---

# Why Deferred?

Because:

* LLM inference is expensive
* embeddings already enable retrieval
* enrichment improves quality later

This creates:

# fast initial usability.

---

# 10. PIPELINE STAGE 8 — BACKGROUND EXECUTION ORCHESTRATION

# Objective

Prevent Android from killing the app during indexing.

---

# Core Technology

## Android WorkManager

---

# Worker Types

| Worker           | Responsibility |
| ---------------- | -------------- |
| OCRWorker        | OCR            |
| EmbeddingWorker  | SigLIP         |
| EnrichmentWorker | Gemma          |
| CleanupWorker    | cache cleanup  |

---

# Scheduling Strategy

## Priority Hierarchy

| Priority           | Rule               |
| ------------------ | ------------------ |
| recent screenshots | highest            |
| charging state     | heavy jobs         |
| thermal high       | pause              |
| low battery        | suspend enrichment |

---

# Critical Android Constraints

The system must survive:

* app swipes
* process death
* battery optimization
* screen-off state

WorkManager is essential.

---

# 11. PIPELINE STAGE 9 — SEARCH EXECUTION

# Objective

Perform efficient hybrid retrieval.

---

# Retrieval Flow

```text id="0vmcga"
User Query
        ↓
Parallel Retrieval:
    OCR FTS5
    Embedding Search
    Metadata Filters
        ↓
Candidate Merge
        ↓
Reranking
        ↓
Final Results
```

---

# Why Hybrid Search Wins

Different queries require different engines.

| Query            | Engine     |
| ---------------- | ---------- |
| “OTP screenshot” | OCR        |
| “Linux setup”    | embeddings |
| “Amazon receipt” | metadata   |
| “Interview prep” | hybrid     |

---

# 12. PIPELINE STAGE 10 — SEMANTIC RERANKING

# Objective

Improve precision after high-recall retrieval.

---

# Core Principle

Embeddings optimize:

# recall

Reranking optimizes:

# precision

---

# Flow

```text id="v9im5c"
Top 50 candidates
        ↓
Gemma reranking
        ↓
Top 5 final
```

---

# Why This Matters

Without reranking:

* visually similar screenshots dominate
* noisy OCR creates false positives

---

# 13. PIPELINE STAGE 11 — MODEL LIFECYCLE MANAGEMENT

# Objective

Prevent RAM crashes on 6GB Android devices.

---

# Critical Rule

# NEVER keep all models resident simultaneously

---

# Correct Lifecycle

```text id="s1ndw9"
OCR loaded
→ unload

SigLIP loaded
→ batch embed
→ unload

Gemma loaded only when required
→ unload
```

---

# Why

Concurrent residency causes:

* LMK kills
* ANRs
* thermal instability
* process eviction

---

# RAM Targets

| Component              | Target    |
| ---------------------- | --------- |
| RN app                 | 200–400MB |
| SigLIP active          | <700MB    |
| Gemma active           | <3GB      |
| Total safe working set | <3.5GB    |

---

# 14. PIPELINE STAGE 12 — THERMAL MANAGEMENT

# Objective

Prevent user-visible overheating.

---

# Rules

## Heavy processing only when:

* charging
* idle
* cool state

---

# Adaptive Strategy

```text id="q7x1mx"
Thermal high
→ reduce batch size

Thermal critical
→ pause enrichment

Charging
→ resume indexing
```

---

# Most Important Insight

Thermals, not FLOPS, become the limiting factor on Android.

---

# 15. PIPELINE STAGE 13 — MODEL DISTRIBUTION

# Objective

Avoid gigantic APKs.

---

# Strategy

## Downloadable AI Packs

---

# Initial Install

Only:

* UI
* SQLite
* OCR runtime

---

# User Downloads

| Pack   | Size       |
| ------ | ---------- |
| SigLIP | ~300MB     |
| Gemma  | ~1.2–1.8GB |

---

# Why

Avoid:

* Play Store rejection risk
* huge install friction
* update complexity

---

# 16. FINAL SYSTEM CHARACTERISTICS

| Property             | Expected |
| -------------------- | -------- |
| Offline capable      | yes      |
| Android optimized    | yes      |
| 6GB RAM support      | yes      |
| Expo compatible      | yes      |
| Hybrid retrieval     | yes      |
| Local-first          | yes      |
| Incremental indexing | yes      |
| Thermal-aware        | yes      |

---

# 17. FINAL ARCHITECTURAL CONCLUSION

The final system behaves fundamentally as:

# a local multimodal memory retrieval engine

comprised of:

* OCR memory extraction
* semantic embeddings
* hybrid retrieval
* deferred enrichment
* Android-aware orchestration

The most important engineering focus areas are:

1. indexing orchestration
2. retrieval quality
3. model lifecycle management
4. thermal management
5. background execution stability

NOT:

* giant models
* chatbot behavior
* autonomous AI workflows

This blueprint represents the most production-feasible Android-first architecture currently achievable within:

* Expo React Native constraints
* 6GB–8GB Android hardware
* fully local inference requirements
* consumer-grade UX expectations.
