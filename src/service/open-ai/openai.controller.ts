import { JwtAuthGuard } from 'src/security/JWT/jwt-auth.guard';
import { OpenaiService } from './openai.service';
import { Controller, UseGuards, Get, Body, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody,ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AskAiRequest } from 'dto/openai.dto';
import { GeminiService } from './gemini.service';

@Controller('ai')
@ApiTags('Api Open AI') 
export class OpenAIController {
  constructor(
    private readonly openAIService: OpenaiService,
    private readonly geminiService: GeminiService
  ) {}

  @Post('ask') 
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hỏi AI về tài liệu dự án (RAG)' })
  @ApiBody({ type:  AskAiRequest })
  async ask(@Body() body: AskAiRequest) {
    if (!body.tinNhan) return "Không thể xử lí tin nhắn của bạn";

    if (process.env.LLM_PROVIDER == "gemini") {
      return this.geminiService.chatCompletion(body.tinNhan);
    } else {
      return this.openAIService.chatCompletion(body.tinNhan);
    }
  }

}