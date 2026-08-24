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
    // Gemini 2.0 — stable, ít 503, lên đầu
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',   // pinned version, ổn định hơn alias
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',

    // Gemini 2.5 — mạnh hơn nhưng hay 503
    'gemini-2.5-flash-lite',  // lite trước vì ít bị overload hơn
    'gemini-2.5-flash',

    // Gemini 3.x preview — thử cuối nếu tất cả trên fail
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
  ];

  // Model dùng để embed — chỉ 1 model, không cần fallback
  // vì embedding không tốn quota như generation
  private readonly EMBED_MODEL = 'gemini-embedding-001';

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
    try {
      const cacheKey = `ai:${this.hashKey(prompt)}`;

      // Redis có thể chết → catch để không crash cả request
      const cached = await this.cacheManager.get<string>(cacheKey).catch(() => null);
      if (cached) return { message: cached };

      // embedText có thể 404, 429, network error
      let queryEmbedding: number[];
      try {
        queryEmbedding = await this.embedText(prompt);
      } catch (err: any) {
        this.logger.error('[RAG] embedText failed:', err.message);
        return { message: 'Không thể xử lý câu hỏi lúc này, thử lại sau.' };
      }

      const relevantChunks = this.vectorStore.search(queryEmbedding, 4);
      const context = relevantChunks.join('\n\n---\n\n');

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

      const result = await this.generateWithFallback(ragPrompt);
      if (!result) {
        return { message: 'AI đang quá tải. Vui lòng thử lại sau ~1 phút.' };
      }

      const message = result.response.text();

      await this.cacheManager.set(cacheKey, message, 300 * 1000).catch(() => null);

      return { message };

    } catch (err: any) {
      this.logger.error('[RAG] chatCompletion unexpected error:', err.message);
      return { message: 'Có lỗi xảy ra, vui lòng thử lại.' };
    }
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
        // Catch tất cả lỗi
        this.logger.warn(`[RAG] ${modelName} failed (${err?.status ?? err?.message}), trying next...`);
        continue;
      }
    }
    return null;
  }

  private hashKey(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}