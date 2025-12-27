# /packages/embeddings/src

Vector embedding providers for knowledge base semantic search.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides implementations of vector embedding providers, used for converting text into semantic vectors for knowledge base retrieval.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Export | Exports public API |
| `types.ts` | Support | TypeScript interfaces for embedding providers |
| `OpenAIEmbeddings.ts` | Core | OpenAI text-embedding-ada-002 implementation |
| `LocalEmbeddings.ts` | Core | Local transformer-based embeddings |

## Key Files

### types.ts
- **Purpose**: Defines `IEmbeddingProvider` interface
- **Exports**: Interface for embedding providers

### OpenAIEmbeddings.ts
- **Purpose**: OpenAI embeddings API integration
- **Exports**: `OpenAIEmbeddings` class
- **Model**: text-embedding-ada-002
- **Dependencies**: `openai`

### LocalEmbeddings.ts
- **Purpose**: Local transformer-based embeddings (offline)
- **Exports**: `LocalEmbeddings` class
- **Dependencies**: `@xenova/transformers`
- **Use Case**: Privacy-sensitive or offline deployments

### index.ts
- **Purpose**: Public API exports
- **Exports**: All embedding provider implementations

