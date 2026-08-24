import type { Request } from 'express';
export interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
    role: string;
  };
}

// mặc định Request express k có user nên phải thêm interface này khi muốn validate token xong gán vào req.user