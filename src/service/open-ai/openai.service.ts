import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  constructor(
    @Inject(process.env.OPENAI_CLIENT) private readonly openai: OpenAI,
  ) {}

  async chatCompletion(prompt: string) {
    const response = await this.openai.chat.completions.create({
      model: String(process.env.MODEL_AI_GPT),
      messages: [
        { role: 'system', content: String(process.env.TRAIN_AI_GPT) },
        { role: 'user', content: prompt },
      ],
    });

    return { 
      message: response.choices[0].message.content
    };
  }
}

// role	        Ý nghĩa	                              Ví dụ
// system	    Đặt tính cách, nhiệm vụ của AI	     "Bạn là trợ lý dev NestJS"
// user	        Người dùng (bệ hạ) hỏi	             "Làm NestJS với OpenAI sao?"
// assistant	Câu trả lời của AI	                 (model trả về)