import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'; 

/**
 * Đọc file PDF và cắt thành các chunks nhỏ để phục vụ RAG pipeline.
 *
 * @param filePath  Đường dẫn tuyệt đối đến file PDF
 * @param chunkSize Số từ tối đa mỗi chunk (default 500)
 * @param overlap   Số từ lặp lại giữa 2 chunk liền kề (default 50)
 * @returns         Mảng string, mỗi phần tử là 1 chunk text
 *
 * Tại sao cắt thành chunks thay vì embed cả file?
 * Embed cả PDF thành 1 vector → vector đại diện cho "toàn bộ tài liệu",
 * mất đi chi tiết từng đoạn. Khi search sẽ không biết phần nào liên quan.
 * Cắt nhỏ → mỗi chunk có vector riêng → search trả về đúng đoạn cần thiết.
 *
 * Tại sao cần overlap?
 * Nếu câu quan trọng nằm ngay ranh giới giữa chunk_1 và chunk_2,
 * không có overlap thì câu đó bị cắt đứt, mất ngữ nghĩa ở cả 2 chunk.
 * Overlap đảm bảo câu đó xuất hiện đầy đủ trong ít nhất 1 trong 2 chunk.
 *
 * Ví dụ với chunkSize=10, overlap=2:
 *   chunk_1: [từ 1  ... từ 10]
 *   chunk_2: [từ 9  ... từ 18]  ← từ 9-10 lặp lại
 *   chunk_3: [từ 17 ... từ 26]  ← từ 17-18 lặp lại
 */
export async function chunkPdf(
  filePath: string,
  chunkSize = 500,
  overlap = 50,
): Promise<string[]> {
  const buffer = fs.readFileSync(filePath);

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  const fullText = pages.join(' ');
  // filter(Boolean) loại bỏ chuỗi rỗng phát sinh khi có nhiều space liên tiếp.
  // Với tài liệu kỹ thuật tiếng Việt/Anh lẫn lộn, split theo whitespace đủ dùng —
  // không cần tokenizer phức tạp hơn vì embedding model tự xử lý ngữ nghĩa.
  const words = fullText.split(/\s+/).filter(Boolean);

  const chunks: string[] = [];
  let i = 0;

  // Mỗi vòng lặp tạo 1 chunk từ vị trí i đến i + chunkSize.
  // Bước nhảy là (chunkSize - overlap) thay vì chunkSize
  // để 2 chunk liền kề có overlap từ chung nhau.
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
    i += chunkSize - overlap;
  }

  return chunks;
}