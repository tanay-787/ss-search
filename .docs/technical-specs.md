## Overview

A mobile application that enables users to search their screenshot library using natural language queries. All processing occurs on-device using the Gemma 3n vision-language model. No screenshot data, search queries, or metadata ever leaves the user's device.

---

## Core Requirements

- **Privacy-first**: Zero cloud processing of screenshots or queries after initial model setup
- **Natural language search**: Users can type queries like "Uber receipts from last month" or "that Twitter thread about AI"
- **Screenshot focus**: Optimized for mobile UI recognition, text extraction, and app identification
- **Offline functionality**: Full search capability without network connectivity
- **Cross-platform**: iOS and Android via Expo

---

## Architecture Components

### Model Layer

**Model**: Gemma 3n E2B Int4 (~1.3 GB active memory)

**Runtime**: LiteRT-LM via react-native-litert-lm, bridged through Nitro Modules for zero-copy JSI performance

**Deployment**: Downloaded once at first launch, cached permanently in app-local storage. Not bundled with app binary due to store size limits.

**Authentication**: Requires free HuggingFace account and read token for initial model download. Token stored in platform secure storage (encrypted keychain/keystore).

**Backends**: GPU delegate on Android, Metal on iOS, with CPU fallback. NPU acceleration where hardware supports it.

---

### Vision Processing Pipeline

**Input**: Screenshots from device photo library, accessed via read-only media library permissions

**Preprocessing**: Images resized to 512×512 pixels before model ingestion to balance detail and memory usage

**Inference**: Multimodal prompt sent to model combining:
- The screenshot image
- Structured instructions requesting app identification, visible text extraction, UI element detection, user intent inference, and language detection

**Output**: Structured metadata including app name, screen type, extracted text snippets, detected UI components, inferred user activity, confidence level, and primary language

---

### Data Storage

**Screenshot Registry**: Local SQLite database tracking screenshot URIs, dimensions, creation timestamps, and indexing status

**Search Index**: Separate table storing extracted metadata per screenshot, with dedicated columns for app names, screen types, visible text, UI elements, and user intent descriptions

**Vector Embeddings**: Semantic representations of screenshot content stored as binary vectors, enabling similarity-based search beyond exact keyword matching

**Cache Management**: Model files stored in platform-appropriate cache directories that persist across launches but remain eligible for system cleanup under storage pressure

---

### Search System

**Keyword Search**: Direct text matching against extracted visible text, app names, and user intent fields. Supports time-range filtering via screenshot creation timestamps.

**Semantic Search**: Query text converted to vector embedding using the same model or lightweight local embedder, then matched against indexed screenshot embeddings via cosine similarity.

**Hybrid Ranking**: Results ranked by combining keyword relevance scores with semantic similarity scores, prioritizing exact matches while surfacing conceptually related screenshots.

**Query Interpretation**: The model can handle implicit references ("that app with the blue bird icon" → Twitter/X, "my flight booking confirmation" → airline app receipts).

---

### Background Processing

**Indexing Strategy**: Incremental batch processing of screenshot library, prioritizing recent additions. Processes screenshots in small chunks to avoid memory pressure and system termination.

**Resume Capability**: Indexing state persisted between sessions. Interrupted batches resume from last completed item.

**Resource Awareness**: Monitors device memory, thermal state, and battery level. Pauses or throttles processing during low-memory conditions, high temperatures, or battery saver mode.

**Scheduling**: Foreground processing during active app usage, with optional background task scheduling for completion when app returns to foreground.

---

### User Experience Flow

**Onboarding**:
- Privacy promise explanation emphasizing local-only processing
- HuggingFace token input with guidance on free account creation
- Model download initiation with Wi-Fi recommendation and progress indication
- Storage permission request for screenshot library access

**Main Interface**:
- Search bar with natural language input
- Results grid displaying matching screenshots
- Filter chips for common categories (apps, time ranges, screen types)
- Indexing progress indicator showing processed vs total screenshots

**Settings**:
- Model management (delete and re-download, check cache status)
- Index rebuild trigger
- Storage usage breakdown
- Privacy audit log showing zero network calls

---

## Platform Considerations

### iOS
- Minimum version 15.0, ARM64 architecture
- Extended Virtual Addressing entitlement not required for Gemma 3n E2B (under 2GB threshold)
- Memory warnings handled via library's built-in low-memory detection
- Background execution limited to 30-second chunks for indexing

### Android
- Minimum API 26, ARM64-v8a architecture
- GPU delegate available for supported Adreno and Mali GPUs
- Various OEM memory management behaviors require defensive chunking
- Foreground service option for sustained indexing on some OEM skins

---

## Privacy Guarantees

| Data Type | Handling |
|---|---|
| Screenshots | Read-only local access, never transmitted |
| Search queries | Processed on-device, never logged externally |
| Extracted metadata | Stored in app sandbox, excluded from cloud backup |
| Model download | Single authenticated fetch, then zero network |
| HuggingFace token | Encrypted platform storage, used once for download |

**Verifiability**: App functions fully in airplane mode after initial setup. No analytics, telemetry, or crash reporting services integrated.

---

## Performance Targets

| Metric | Target |
|---|---|
| Time to first search result | Under 2 seconds for keyword, under 4 seconds for semantic |
| Screenshot indexing rate | 2-4 screenshots per minute (varies by device) |
| Model load time | Under 10 seconds on flagship devices |
| Search result relevance | Top-3 results contain target screenshot in 90%+ of queries |
| App memory footprint | Under 2.5 GB peak during inference |

---

## Failure Modes and Mitigations

| Scenario | Mitigation |
|---|---|
| Model download interrupted | Resumable download with progress persistence |
| Insufficient storage for model | Pre-flight check with user-facing error and cleanup suggestions |
| Device too old/slow for E2B | Graceful degradation message, suggest cloud alternative apps |
| Indexing killed by OS | Chunked processing with resume checkpointing |
| Model returns malformed metadata | Retry with adjusted prompt, fallback to partial index |
| HF token invalid or revoked | Clear token, prompt re-entry, preserve cached model if available |

---

## Dependencies and Ecosystem

- **Expo SDK**: Core framework with prebuild workflow for native module integration
- **react-native-litert-lm**: On-device LLM inference via LiteRT-LM
- **Nitro Modules**: JSI bridge enabling zero-copy native communication
- **expo-file-system**: Resumable model downloads and cache management
- **expo-secure-store**: Encrypted credential storage
- **expo-media-library**: Read-only screenshot library access
- **SQLite + sqlite-vec**: Local relational and vector database
- **expo-background-fetch**: Optional periodic indexing resumption

---

## Future Considerations

- **Incremental indexing**: Real-time indexing of new screenshots via photo library change observers
- **Cross-device sync**: Optional encrypted local network sync between user's devices, never touching cloud
- **Custom fine-tuning**: User-specific app taxonomy improvement via on-device LoRA adaptation
- **Query suggestions**: Local history-based autocomplete without external services

---