// src/ai/rag/vector.store.ts

export type EmbeddedChunk = {
  text: string;
  embedding: number[];
};

/**
 * In-memory vector store đơn giản.
 * Phù hợp cho: 1 PDF, < 1000 chunks, single instance.
 * Không phù hợp cho: multi-instance (PM2 cluster), tài liệu lớn.
 */
export class InMemoryVectorStore {
  private store: EmbeddedChunk[] = [];

  add(chunks: EmbeddedChunk[]): void {
    this.store.push(...chunks);
  }

  /**
   * Tìm top K chunks có cosine similarity cao nhất với queryEmbedding.
   *
   * Linear scan O(n) — chấp nhận được khi n < 10,000.
   * Nếu n lớn hơn, cần dùng HNSW index (Qdrant, Weaviate hỗ trợ).
   */
  search(queryEmbedding: number[], topK = 4): string[] {
    return this.store
      .map((chunk) => ({
        text: chunk.text,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => r.text);
  }

  /**
   * Dùng để serialize ra file JSON, tránh re-embed mỗi lần restart.
   */
  dump(): EmbeddedChunk[] {
    return this.store;
  }

  load(chunks: EmbeddedChunk[]): void {
    this.store = chunks;
  }

  get size(): number {
    return this.store.length;
  }
}

/**
 * Cosine Similarity = (A · B) / (|A| × |B|)
 *
 * Đo góc giữa 2 vector thay vì khoảng cách.
 * Kết quả: 1.0 = giống hệt, 0.0 = không liên quan, -1.0 = đối lập.
 *
 * Tại sao không dùng Euclidean distance?
 * Vì text dài hơn có vector magnitude lớn hơn, làm lệch kết quả.
 * Cosine loại bỏ ảnh hưởng của độ dài, chỉ đo hướng ngữ nghĩa.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}