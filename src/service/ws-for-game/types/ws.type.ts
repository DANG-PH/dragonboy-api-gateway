export type PlayerConfig = {
  dau_dung: string; dau_chay: string;
  than_dung: string; than_nhay: string; than_roi: string; than_chay: string;
  chan_dung: string; chan_nhay: string; chan_roi: string; chan_chay: string;
  than_bay: string; chan_bay: string; chan_gong: string; than_thu: string;
  lechTheoTrangThai: string; // JSON serialized
  rong: number; cao: number;
  avt: string;
}

export type PlayerDynamic = {
  x: number; y: number;
  trangthai: string; dir: number;
  frame: number;
  timeChoHienBay: number;
  frameVanBay: number;
  dangMangVanBay: boolean;
  tenVanBay: string;
  gameName: string;
  map: string;
}