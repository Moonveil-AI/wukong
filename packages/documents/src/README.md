# /packages/documents/src

Document processing, text extraction, and chunking for knowledge base ingestion.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package handles document ingestion into the knowledge base, including text extraction from various formats and intelligent chunking for embedding.

## File Structure

| Directory/File | Role | Purpose |
|----------------|------|---------|
| `index.ts` | Export | Exports public API |
| `types.ts` | Support | Type definitions for documents and chunks |
| `DocumentProcessor.ts` | Entry | Main document processing orchestrator |
| `extractors/` | Core | Format-specific text extractors |
| `chunking/` | Core | Text chunking strategies |

## Extractors

| File | Purpose |
|------|---------|
| `TextExtractor.ts` | Plain text file extraction |
| `MarkdownExtractor.ts` | Markdown with metadata extraction |
| `PDFExtractor.ts` | PDF text extraction |
| `CodeExtractor.ts` | Source code with syntax awareness |
| `JSONExtractor.ts` | JSON document processing |

## Chunking Strategies

| File | Purpose |
|------|---------|
| `SimpleChunker.ts` | Fixed-size chunks with overlap |
| `SemanticChunker.ts` | Semantic boundary-aware chunking |
| `CodeChunker.ts` | Code block and function-aware chunking |

## Key Files

### DocumentProcessor.ts
- **Purpose**: Main orchestrator for document processing pipeline
- **Exports**: `DocumentProcessor` class
- **Features**: Format detection, text extraction, chunking, metadata

### types.ts
- **Purpose**: Type definitions for documents, chunks, and extractors
- **Exports**: Document types, chunk types, extractor interfaces

