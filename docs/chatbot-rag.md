# Chatbot RAG — Từ Prompt Thẳng đến Retrieval-Augmented Generation

> Tài liệu này giải thích toàn bộ quá trình nâng cấp chatbot từ kiến trúc cũ (prompt trực tiếp) sang RAG, bao gồm lý do tại sao, thuật ngữ chuyên ngành, và ví dụ code đầy đủ.

---

## Mục lục

1. [Kiến trúc cũ — Plain Prompt](#1-kiến-trúc-cũ--plain-prompt)
2. [Vấn đề của kiến trúc cũ](#2-vấn-đề-của-kiến-trúc-cũ)
3. [Kiến trúc mới — RAG](#3-kiến-trúc-mới--rag)
4. [Thuật ngữ chuyên ngành](#4-thuật-ngữ-chuyên-ngành)
   - [Chunk / Chunking](#41-chunk--chunking)
   - [Embedding](#42-embedding)
   - [Vector Store](#43-vector-store)
   - [Cosine Similarity](#44-cosine-similarity)
   - [Retrieval](#45-retrieval)
   - [Augmented Generation](#46-augmented-generation)
5. [So sánh cũ vs mới](#5-so-sánh-cũ-vs-mới)
6. [Implementation đầy đủ](#6-implementation-đầy-đủ)
   - [pdf.chunker.ts](#61-pdfchunkerts)
   - [vector.store.ts](#62-vectorstorets)
   - [gemini.service.ts](#63-geminiservicets)
   - [ai.controller.ts](#64-aicontrollerts)
7. [Những điều nên biết thêm](#7-những-điều-nên-biết-thêm)
   - [Tại sao lưu index ra file JSON](#71-tại-sao-lưu-index-ra-file-json)
   - [Chunk size tuning](#72-chunk-size-tuning)
   - [Tại sao dùng Gemini embed thay OpenAI](#73-tại-sao-dùng-gemini-embed-thay-openai)
   - [Giới hạn của in-memory vector store](#74-giới-hạn-của-in-memory-vector-store)
   - [Khi nào cần vector DB thật](#75-khi-nào-cần-vector-db-thật)
8. [Checklist production](#8-checklist-production)

---

## 1. Kiến trúc cũ — Plain Prompt

```
User: "Dự án có bao nhiêu microservice?"
         ↓
    [TRAIN_AI_GEMINI env var + câu hỏi]
         ↓
       Gemini
         ↓
    LLM đoán mò từ kiến thức chung
```

Code cũ ở controller:

```typescript
// ai.controller.ts (cũ)
@Post('ask')
async ask(@Body() body: AskAiRequest) {
  if (!body.tinNhan) return "Không thể xử lí tin nhắn của bạn";
  return this.geminiService.chatCompletion(body.tinNhan);
}
```

Code cũ ở service:

```typescript
// gemini.service.ts (cũ) — đơn giản hoá
async chatCompletion(prompt: string) {
  const systemPrompt = process.env.TRAIN_AI_GEMINI ?? 'Trả lời ngắn gọn:';

  const fullPrompt = `${systemPrompt}\nUser: "${prompt}"`;

  const result = await this.generateWithFallback(fullPrompt);
  return { message: result.response.text() };
}
```

LLM nhận được:

```
Câu này là câu train: Bạn được tạo ra bởi hải đăng, câu sau sẽ là câu
user hỏi bạn, trả lời cực ngắn gọn đủ các ý chính và k dài dòng:
User: "Dự án có bao nhiêu microservice?"
```

---

## 2. Vấn đề của kiến trúc cũ

### LLM không biết gì về dự án của bạn

LLM được train đến một thời điểm cố định với dữ liệu internet chung. Nó không biết:
- Dự án của bạn có bao nhiêu service
- Schema database của bạn là gì
- Business logic cụ thể như thế nào
- Các quyết định thiết kế bạn đã đưa ra

Kết quả: LLM **hallucinate** — bịa ra câu trả lời trông có vẻ hợp lý nhưng sai hoàn toàn.

### Nhét cả PDF vào prompt không scale

```
Gemini 2.0 Flash: context window ~1,000,000 tokens
PDF 50 trang ≈ 25,000 tokens  ← vẫn vừa, nhưng...
```

Vấn đề không phải token limit mà là **chất lượng trả lời**. Khi prompt quá dài, LLM bị "lost in the middle" — nó mất tập trung, bỏ sót thông tin ở giữa văn bản.

Ngoài ra: mỗi request gửi đi 25,000 tokens → tốn quota gấp 50 lần so với chỉ gửi 500 tokens liên quan.

---

## 3. Kiến trúc mới — RAG

RAG = **R**etrieval-**A**ugmented **G**eneration

Hai giai đoạn độc lập:

### Giai đoạn 1: Indexing (chạy 1 lần khi khởi động)

```
PDF
 ↓ đọc toàn bộ text
"Lorem ipsum dolor... [10,000 từ]"
 ↓ cắt thành chunks
chunk_01: "Service A xử lý auth..."    (500 từ)
chunk_02: "...JWT expire 7 ngày..."    (500 từ)
chunk_03: "Database schema gồm..."     (500 từ)
 ↓ embed từng chunk (gọi Gemini Embedding API)
chunk_01 → [0.12, -0.87, 0.34, 0.91, ...]  (768 số)
chunk_02 → [0.13, -0.88, 0.33, 0.89, ...]
chunk_03 → [0.74,  0.21, -0.55, 0.12, ...]
 ↓ lưu vào in-memory vector store
{ text: "...", embedding: [...] }[]
```

### Giai đoạn 2: Query (mỗi lần user hỏi)

```
User: "JWT expire bao lâu?"
 ↓ embed câu hỏi
[0.12, -0.88, 0.35, 0.90, ...]
 ↓ so sánh cosine similarity với tất cả chunks
chunk_01: similarity = 0.91  ✅
chunk_02: similarity = 0.99  ✅ ← top
chunk_03: similarity = 0.18  ❌
 ↓ lấy top 4 chunks liên quan nhất
 ↓ build prompt
[system prompt]
Tài liệu dự án:
---
chunk_02: "JWT expire sau 7 ngày. Refresh token..."
chunk_01: "Service A dùng JWT để authenticate..."
---
Câu hỏi: "JWT expire bao lâu?"
 ↓ Gemini đọc tài liệu thật → trả lời đúng
"JWT trong dự án expire sau 7 ngày, sau đó client cần dùng refresh token để..."
```

---

## 4. Thuật ngữ chuyên ngành

### 4.1 Chunk / Chunking

**Chunk** là một đoạn văn bản nhỏ được cắt ra từ tài liệu gốc.

**Tại sao phải cắt?**

Embed cả file PDF thành 1 vector duy nhất sẽ mất chi tiết — vector đó đại diện cho "toàn bộ tài liệu" thay vì "đoạn nói về JWT". Khi search, bạn luôn tìm thấy file đó nhưng không biết phần nào liên quan.

```
BAD: 1 file PDF → 1 vector → search luôn trả về file đó, không có ích

GOOD: 1 file PDF → 20 chunks → 20 vectors → search trả về đúng 4 đoạn liên quan
```

**Overlap** là số từ được lặp lại giữa 2 chunk liền kề:

```
chunk_1: [từ 1 ... từ 500 | từ 451-500 là overlap]
chunk_2:              [từ 451-500 là overlap | từ 501 ... từ 950]
```

Nếu không có overlap, câu quan trọng nằm ở ranh giới sẽ bị cắt đứt mất nghĩa.

---

### 4.2 Embedding

**Embedding** là quá trình dịch text sang vector số trong không gian nhiều chiều (thường 768 hoặc 1536 chiều).

Kết quả là một mảng số float — "tọa độ" của đoạn text đó trong không gian ngữ nghĩa:

```
"JWT expire sau 7 ngày"  → [0.12, -0.87, 0.34, 0.91, -0.22, ...] (768 số)
"token hết hạn 7 ngày"  → [0.11, -0.85, 0.36, 0.89, -0.20, ...] (768 số) ← gần
"công thức nấu phở"     → [0.74,  0.21, -0.67, 0.03,  0.88, ...] (768 số) ← xa
```

---

#### 768 chiều là gì

"Chiều" ở đây là số chiều của không gian vector — giống tọa độ (x, y, z) trong không gian 3D, nhưng là 768 chiều:

```
1 chiều  → [0.12]
2 chiều  → [0.12, -0.87]
3 chiều  → [0.12, -0.87, 0.34]
768 chiều → [0.12, -0.87, 0.34, 0.91, -0.22, 0.55, ...]  (768 số)
```

Quan trọng: **không phải mỗi chiều đại diện cho 1 khái niệm cụ thể**. Không ai quy định "chiều 1 = bảo mật", "chiều 2 = database". Tất cả 768 số **cùng nhau** mới biểu diễn ngữ nghĩa của câu. Model tự học cách sắp xếp các con số này — con người không hiểu từng chiều nghĩa là gì.

Tại sao cần 768 chiều thay vì ít hơn? Ngôn ngữ cực kỳ phức tạp. 2-3 chiều không đủ "chỗ" để phân biệt hàng triệu khái niệm khác nhau. 768 chiều cho phép model đặt mỗi khái niệm vào một vị trí riêng biệt đủ chính xác — "JWT authentication", "OAuth2", "session cookie" đều liên quan đến auth nhưng có vị trí khác nhau trong không gian 768 chiều đó.

---

#### Model học cách tạo vector như thế nào

Model embedding được train trên hàng tỷ câu từ internet bằng kỹ thuật **contrastive learning**:

```
Cho model 3 câu:
  A = "JWT dùng để xác thực"
  B = "token authentication"    ← positive pair (cùng nghĩa)
  C = "công thức nấu phở"       ← negative pair (khác nghĩa)

Loss function phạt model nếu:
  - vector(A) xa vector(B)  → kéo lại gần nhau
  - vector(A) gần vector(C) → đẩy ra xa nhau

Lặp lại hàng tỷ lần với hàng tỷ cặp câu
→ model tự học được cách "sắp xếp" 768 số
   sao cho câu cùng nghĩa thì vector gần nhau
```

Model không được lập trình cứng "JWT = [0.12, ...]". Nó học được **cách tính** — nhìn vào text, qua nhiều lớp neural network, ra 768 số phản ánh ngữ nghĩa. Khi bạn gọi `embedText("JWT expire bao lâu?")`, model không tra bảng, nó tính toán ra vector dựa trên hàng tỷ pattern đã học.

Kết quả sau training: câu nào **cùng nghĩa** dù khác ngôn ngữ cũng có vector gần nhau:

```
"JWT dùng để xác thực người dùng"  → vector A
"JSON Web Token authenticates users" → vector B  ← gần A dù khác ngôn ngữ
"Cách làm bánh mì"                 → vector C  ← xa A
```

---

#### Việc của dev sau khi có vector: tính góc

Đây là phần dev thực sự làm — **không cần hiểu bên trong model**. Chỉ cần biết: model đã đảm bảo câu cùng nghĩa thì vector có góc nhỏ với nhau. Dev chỉ việc đo góc đó.

```
câu hỏi "JWT expire bao lâu?"    → vector Q
chunk "JWT expire sau 7 ngày..." → vector A  → góc Q-A = 5°   → gần
chunk "PostgreSQL schema..."     → vector B  → góc Q-B = 110°  → xa
```

Đo góc trực tiếp thì phức tạp. Thay vào đó dùng **cosine của góc** — kết quả nằm trong [-1, 1], dễ so sánh hơn:

```
cos(5°)   = 0.996  → gần 1  → liên quan cao  ✅
cos(90°)  = 0.0    → = 0    → không liên quan
cos(110°) = -0.34  → âm     → đối lập
```

Góc càng nhỏ → cos càng gần 1 → score càng cao → chunk càng liên quan. Dev lấy top K chunk có score cao nhất là xong phần retrieval.

```typescript
// Đây là toàn bộ "việc của dev" trong vector search
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);       // tích vô hướng
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0)); // độ dài vector A
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0)); // độ dài vector B
  return dot / (normA * normB);                                   // cos(góc)
}

// Tại sao chia cho normA * normB?
// Để loại bỏ ảnh hưởng của độ dài vector (text dài có vector lớn hơn).
// Chỉ giữ lại thông tin về "hướng" = ngữ nghĩa, không quan tâm "độ lớn" = độ dài text.
```

Tóm lại phân công trách nhiệm:

```
Embedding model chịu trách nhiệm:
  → Đảm bảo câu cùng nghĩa thì vector có góc nhỏ

Dev chịu trách nhiệm:
  → Tính cosine similarity (= cos của góc đó)
  → Lấy top K chunk có score cao nhất
  → Nhét vào prompt
```

---

### 4.3 Vector Store

Nơi lưu trữ các cặp `(text, embedding)`. Khi search, vector store nhận vào 1 embedding của câu hỏi và trả về các embedding gần nhất.

**In-memory** (dùng trong implementation này): lưu trong RAM, mất khi restart. Phù hợp cho dự án nhỏ, 1 PDF, vài trăm chunks.

**Vector Database** (Pinecone, Weaviate, Qdrant): lưu persistent, hỗ trợ index để search nhanh hơn. Cần thiết khi có hàng triệu vectors.

---

### 4.4 Cosine Similarity

Embedding model đã đảm bảo câu cùng nghĩa thì vector có góc nhỏ. Cosine similarity là cách **đo góc đó** và chuyển thành score dễ so sánh.

```
similarity = cos(θ) = (A · B) / (|A| × |B|)

Kết quả nằm trong [-1, 1]:
  1.0  → góc = 0°   → hoàn toàn giống nhau
  0.0  → góc = 90°  → không liên quan
 -1.0  → góc = 180° → đối lập nhau
```

Tại sao không dùng khoảng cách Euclidean (đường thẳng giữa 2 điểm)? Vì text dài hơn tạo ra vector có magnitude lớn hơn — khoảng cách bị ảnh hưởng bởi độ dài text chứ không chỉ ngữ nghĩa. Cosine loại bỏ yếu tố độ dài bằng cách chia cho `|A| × |B|`, chỉ giữ lại "hướng" của vector = ngữ nghĩa thuần túy.

Trong thực tế RAG, chunk liên quan thường có similarity > 0.8.

---

### 4.5 Retrieval

Bước tìm kiếm: nhận câu hỏi đã được embed, so sánh với tất cả chunks, trả về top K chunk có similarity cao nhất.

```typescript
// K = 4 là phổ biến. Tăng K → nhiều context hơn nhưng
// prompt dài hơn và có thể thêm noise.
const relevantChunks = vectorStore.search(queryEmbedding, topK = 4);
```

---

### 4.6 Augmented Generation

Sau khi có chunks liên quan, nhét chúng vào prompt **trước khi hỏi LLM**. LLM lúc này được "augment" với tài liệu thật, không phải đoán mò.

```
[Không có RAG]
Prompt: "JWT expire bao lâu?"
LLM: "Thường là 15 phút đến 1 giờ" ← hallucinate, đúng chung chung nhưng sai với dự án

[Có RAG]
Prompt: "Tài liệu: JWT expire sau 7 ngày... \n Câu hỏi: JWT expire bao lâu?"
LLM: "JWT trong dự án expire sau 7 ngày" ← đúng với tài liệu thật
```

---

## 5. So sánh cũ vs mới

| Tiêu chí | Kiến trúc cũ | Kiến trúc RAG |
|---|---|---|
| Nguồn kiến thức | Kiến thức chung của LLM | Tài liệu thật của dự án |
| Độ chính xác với dự án | Thấp, hay hallucinate | Cao, dựa vào tài liệu |
| Token mỗi request | Nhỏ (chỉ câu hỏi) | Trung bình (~500-2000 tokens context) |
| Cần cập nhật khi thay đổi | Không | Cần re-index PDF |
| Độ phức tạp setup | Thấp | Trung bình |
| Scale khi tài liệu lớn | Không scale (nhét hết vào prompt) | Scale tốt |

---

## 6. Implementation đầy đủ

Cấu trúc thư mục:

```
src/
  ai/
    rag/
      pdf.chunker.ts
      vector.store.ts
    gemini.service.ts
    ai.controller.ts
    ai.module.ts
docs/
  project.pdf       ← file tài liệu dự án
  index.json        ← cache embeddings (tự sinh, không commit lên git)
```

---

### 6.1 pdf.chunker.ts

```typescript
// src/ai/rag/pdf.chunker.ts
import pdfParse from 'pdf-parse';
import fs from 'fs';

/**
 * Đọc PDF và cắt thành các chunks nhỏ.
 *
 * @param filePath  Đường dẫn đến file PDF
 * @param chunkSize Số từ mỗi chunk (default 500)
 * @param overlap   Số từ overlap giữa 2 chunk liền kề (default 50)
 *
 * Tại sao overlap?
 * Nếu câu quan trọng nằm ở ranh giới giữa chunk_1 và chunk_2,
 * không có overlap thì câu đó bị cắt đứt, mất ngữ nghĩa.
 * Overlap đảm bảo câu đó xuất hiện đầy đủ trong ít nhất 1 chunk.
 */
export async function chunkPdf(
  filePath: string,
  chunkSize = 500,
  overlap = 50,
): Promise<string[]> {
  const buffer = fs.readFileSync(filePath);
  const { text } = await pdfParse(buffer);

  // Tách theo whitespace để đếm "từ"
  // Với tài liệu kỹ thuật tiếng Việt/Anh lẫn lộn thì đây đủ dùng
  const words = text.split(/\s+/).filter(Boolean);

  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
    i += chunkSize - overlap; // tiến lên chunkSize - overlap từ
  }

  return chunks;
}
```

**Ví dụ thực tế:**

```
Input PDF text (giản lược):
"Service gateway xử lý routing. JWT dùng để auth. Token expire 7 ngày.
Database là PostgreSQL. Schema có bảng users, characters, inventories..."

chunkSize=10, overlap=2 (ví dụ nhỏ để dễ hiểu):

chunk_1: "Service gateway xử lý routing. JWT dùng để"
chunk_2: "JWT dùng để auth. Token expire 7 ngày."       ← "JWT dùng để" lặp lại
chunk_3: "Token expire 7 ngày. Database là PostgreSQL."
...
```

---

### 6.2 vector.store.ts

```typescript
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
```

---

### 6.3 gemini.service.ts

```typescript
// src/ai/gemini.service.ts
import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { chunkPdf } from './rag/pdf.chunker';
import { InMemoryVectorStore, EmbeddedChunk } from './rag/vector.store';

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly vectorStore = new InMemoryVectorStore();

  // Model dùng để generate text (có fallback khi 429)
  private readonly CHAT_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-flash-latest',
  ];

  // Model dùng để embed — chỉ 1 model, không cần fallback
  // vì embedding không tốn quota như generation
  private readonly EMBED_MODEL = 'text-embedding-004';

  // Path đến PDF tài liệu và file cache embeddings
  private readonly PDF_PATH = path.join(process.cwd(), 'docs', 'project.pdf');
  private readonly INDEX_PATH = path.join(process.cwd(), 'docs', 'index.json');

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  /**
   * NestJS gọi hàm này tự động sau khi module khởi tạo xong.
   * Đây là nơi thực hiện indexing — chỉ chạy 1 lần.
   */
  async onModuleInit() {
    await this.loadOrBuildIndex();
  }

  /**
   * Nếu index.json đã tồn tại → load lên, không cần embed lại.
   * Nếu chưa có → đọc PDF, embed, lưu index.json.
   *
   * Tại sao cần cache ra file?
   * Embed 200 chunks tốn ~10-30 giây và tiêu quota API.
   * Mỗi lần restart PM2 mà phải embed lại là waste.
   * index.json lưu embeddings đã tính sẵn → load tức thì.
   *
   * LƯU Ý: Khi cập nhật PDF, xóa index.json để force re-index.
   */
  private async loadOrBuildIndex() {
    if (fs.existsSync(this.INDEX_PATH)) {
      const saved: EmbeddedChunk[] = JSON.parse(
        fs.readFileSync(this.INDEX_PATH, 'utf-8'),
      );
      this.vectorStore.load(saved);
      this.logger.log(`[RAG] Loaded ${this.vectorStore.size} chunks from index.json`);
      return;
    }

    this.logger.log('[RAG] index.json not found — building from PDF...');
    await this.indexPdf(this.PDF_PATH);
    fs.writeFileSync(this.INDEX_PATH, JSON.stringify(this.vectorStore.dump()));
    this.logger.log(`[RAG] Indexed and saved ${this.vectorStore.size} chunks`);
  }

  /**
   * Đọc PDF → cắt chunks → embed từng chunk → lưu vào vector store.
   *
   * Delay 200ms giữa các lần embed để tránh rate limit API.
   * Gemini embedding API ít bị 429 hơn generation, nhưng vẫn có limit.
   */
  private async indexPdf(filePath: string) {
    const chunks = await chunkPdf(filePath);
    this.logger.log(`[RAG] ${chunks.length} chunks to embed...`);

    const embeddedChunks: EmbeddedChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embedText(chunks[i]);
      embeddedChunks.push({ text: chunks[i], embedding });

      if (i % 10 === 0) {
        this.logger.log(`[RAG] Embedded ${i + 1}/${chunks.length}`);
      }

      // Tránh rate limit
      await new Promise((r) => setTimeout(r, 200));
    }

    this.vectorStore.add(embeddedChunks);
  }

  /**
   * Flow chính mỗi khi user gửi câu hỏi:
   * 1. Check cache — nếu đã hỏi câu này rồi thì trả về luôn
   * 2. Embed câu hỏi
   * 3. Retrieve top 4 chunks liên quan
   * 4. Build prompt có context
   * 5. Gọi LLM
   * 6. Cache kết quả
   */
  async chatCompletion(prompt: string) {
    const cacheKey = `ai:${this.hashKey(prompt)}`;
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) return { message: cached };

    // Bước 2: embed câu hỏi
    const queryEmbedding = await this.embedText(prompt);

    // Bước 3: retrieve
    const relevantChunks = this.vectorStore.search(queryEmbedding, 4);
    const context = relevantChunks.join('\n\n---\n\n');

    // Bước 4: build prompt
    const systemPrompt =
      process.env.TRAIN_AI_GEMINI ??
      'Bạn là trợ lý dự án. Trả lời ngắn gọn, đủ ý, không dài dòng.';

    const ragPrompt = `
${systemPrompt}

Tài liệu dự án liên quan đến câu hỏi:
---
${context}
---

Câu hỏi của user: ${prompt}

Hướng dẫn trả lời:
- Chỉ dựa vào tài liệu phía trên để trả lời
- Nếu tài liệu không đề cập, nói rõ: "Tài liệu không có thông tin về vấn đề này"
- Không bịa thêm thông tin ngoài tài liệu
- Trả lời ngắn gọn, bullet points nếu nhiều ý
    `.trim();

    // Bước 5: gọi LLM
    const result = await this.generateWithFallback(ragPrompt);
    if (!result) {
      return { message: 'AI đang quá tải. Vui lòng thử lại sau ~1 phút.' };
    }

    const message = result.response.text();

    // Bước 6: cache 5 phút
    await this.cacheManager.set(cacheKey, message, 300 * 1000);
    return { message };
  }

  /**
   * Gọi Gemini Embedding API để chuyển text → vector.
   * Trả về mảng số float (768 chiều với text-embedding-004).
   */
  private async embedText(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: this.EMBED_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  /**
   * Thử lần lượt các model, bỏ qua nếu 429 (hết quota).
   * Nếu tất cả đều 429 → trả về null, controller xử lý.
   */
  private async generateWithFallback(prompt: string) {
    for (const modelName of this.CHAT_MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        return await model.generateContent(prompt);
      } catch (err: any) {
        if (err?.status === 429) {
          this.logger.warn(`[RAG] ${modelName} quota exceeded, trying next...`);
          continue;
        }
        throw err;
      }
    }
    return null;
  }

  private hashKey(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}
```

---

### 6.4 ai.controller.ts

```typescript
// src/ai/ai.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GeminiService } from './gemini.service';
import { OpenAIService } from './openai.service';
import { AskAiRequest } from './dto/ask-ai.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly openAIService: OpenAIService,
  ) {}

  @Post('ask')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hỏi AI về tài liệu dự án (RAG)' })
  @ApiBody({ type: AskAiRequest })
  async ask(@Body() body: AskAiRequest) {
    if (!body.tinNhan) return { message: 'Không thể xử lí tin nhắn của bạn' };

    if (process.env.LLM_PROVIDER === 'gemini') {
      return this.geminiService.chatCompletion(body.tinNhan);
    }
    return this.openAIService.chatCompletion(body.tinNhan);
  }
}
```

---

## 7. Những điều nên biết thêm

### 7.1 Tại sao lưu index ra file JSON

PM2 cluster mode restart service thường xuyên. Mỗi lần restart mà phải embed lại 200 chunks × 200ms delay = ~40 giây khởi động chậm + tốn quota. Lưu ra `index.json` thì load lại tức thì.

```bash
# Workflow khi cập nhật tài liệu:
rm docs/index.json   # xóa cache cũ
pm2 restart all      # restart → tự động re-index từ PDF mới
```

Không commit `index.json` lên git (file lớn, generated):

```gitignore
# .gitignore
docs/index.json
```

---

### 7.2 Chunk size tuning

Không có con số "đúng" — phụ thuộc vào loại tài liệu:

```
Tài liệu kỹ thuật (API docs, schema): chunkSize = 300-400
  → Thông tin dense, cần chunk nhỏ để tìm chính xác

Tài liệu mô tả (business logic, quy trình): chunkSize = 600-800
  → Cần nhiều context để hiểu đủ ý

Tài liệu hỗn hợp (dự án thông thường): chunkSize = 500
  → Starting point phổ biến nhất
```

Dấu hiệu chunk size sai:

```
Trả lời thiếu context → tăng chunkSize hoặc tăng topK
Trả lời bị nhiễu, lạc đề → giảm chunkSize hoặc giảm topK
```

---

### 7.3 Tại sao dùng Gemini embed thay OpenAI

Gemini `text-embedding-004` miễn phí với quota cao. OpenAI `text-embedding-3-small` tính tiền theo số token. Với dự án portfolio chạy 24/7 free tier, Gemini embed là lựa chọn hợp lý.

Quan trọng hơn: **phải dùng cùng 1 model để embed cả lúc index lẫn lúc query**. Nếu index bằng Gemini embed mà query bằng OpenAI embed, kết quả cosine similarity sẽ vô nghĩa vì 2 model tạo ra vector trong không gian khác nhau.

---

### 7.4 Giới hạn của in-memory vector store

| Vấn đề | Triệu chứng | Giải pháp |
|---|---|---|
| Mất data khi restart | Phải load lại từ index.json | Đã xử lý bằng file cache |
| Không share giữa các PM2 instance | Mỗi instance có vector store riêng, tốn RAM × số instance | Acceptable với 1 PDF nhỏ |
| Search chậm khi data lớn | O(n) linear scan | Dùng vector DB với HNSW index |

Với 1 PDF ~50 trang (~200 chunks), linear scan hoàn toàn chấp nhận được — search < 5ms.

---

### 7.5 Khi nào cần vector DB thật

Upgrade lên vector DB (Qdrant self-hosted hoặc Weaviate) khi:

- Có nhiều hơn 1 tài liệu (nhiều PDF, nhiều nguồn)
- Cần filter theo metadata (chỉ tìm trong "tài liệu API" thay vì tất cả)
- Số chunks vượt ~10,000 (search bắt đầu chậm)
- Cần persistent mà không muốn dùng file JSON

Qdrant là lựa chọn tốt nhất để tự host — Docker image nhỏ, REST API đơn giản, hiệu năng tốt.

---

## 8. Checklist production

```
Setup:
  ☐ docs/project.pdf tồn tại và readable
  ☐ docs/ được tạo nếu chưa có
  ☐ docs/index.json trong .gitignore
  ☐ GEMINI_API_KEY trong .env
  ☐ TRAIN_AI_GEMINI trong .env (system prompt tùy chỉnh)

Monitoring:
  ☐ Log khi indexing bắt đầu/kết thúc
  ☐ Log số chunks đã index
  ☐ Log khi fallback sang model khác (429)
  ☐ Alert khi tất cả models đều 429

Vận hành:
  ☐ Khi cập nhật PDF: xóa index.json → restart
  ☐ Kiểm tra response quality định kỳ với câu hỏi mẫu
  ☐ Theo dõi Gemini API quota dashboard
```

---

*Tài liệu này được viết cho dự án MMORPG backend — NestJS/TypeScript, PM2 cluster, production quality.*