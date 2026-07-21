type NapTienPayload =
  | {
      type: 'ITEM';
      itemId: number;
      quantity?: number;
    }
  | {
      type: 'VANG' | 'NGOC';
      amount: number;
    };