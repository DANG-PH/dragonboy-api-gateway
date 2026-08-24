import { LoaiNapTien } from "src/enums/nap.enum";

export type NapTienEvent =
  | {
      userId: number;
      type: LoaiNapTien.ITEM;
      itemId: number;
      quantity?: number;
    }
  | {
      userId: number;
      type: LoaiNapTien.VANG | LoaiNapTien.NGOC;
      amount: number;
    };