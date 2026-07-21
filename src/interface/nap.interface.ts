interface NapTienEvent {
  userId: number;
  type: 'ITEM' | 'VANG' | 'NGOC';
  itemId?: number;
  amount?: number;
}