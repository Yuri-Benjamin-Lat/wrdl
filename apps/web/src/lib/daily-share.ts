import type { DailySnapshot } from "./daily";

export const DAILY_SHARE_SIZE = 1080;

export type DailyShareTile = "empty" | "correct" | "present" | "absent";

export type DailyShareModel = {
  puzzleNumber: number;
  result: string;
  streak: number;
  tiles: DailyShareTile[];
  filename: string;
};

const COLORS = {
  background: "#f5f1e5",
  surface: "#fffdf7",
  text: "#233028",
  muted: "#687169",
  line: "#d5d1c5",
  empty: "#e8e4d9",
  absent: "#858b84",
  present: "#ceb54f",
  correct: "#4f7d56",
};

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function createDailyShareModel(snapshot: DailySnapshot): DailyShareModel {
  if ((snapshot.status !== "win" && snapshot.status !== "failed") || !snapshot.puzzleNumber) {
    throw new TypeError("Only a completed Daily Wordle can be shared.");
  }

  const tiles: DailyShareTile[] = snapshot.guesses.flatMap((guess) =>
    guess.pattern.split("").map((value): DailyShareTile => {
      if (value === "2") return "correct";
      if (value === "1") return "present";
      return "absent";
    }),
  );
  while (tiles.length < 30) tiles.push("empty");

  const result = snapshot.status === "win" ? `${snapshot.acceptedGuessCount}/6` : "X/6";
  const resultForFile =
    snapshot.status === "win" ? `${snapshot.acceptedGuessCount}-of-6` : "X-of-6";

  return {
    puzzleNumber: snapshot.puzzleNumber,
    result,
    streak: snapshot.streak,
    tiles: tiles.slice(0, 30),
    filename: `WRDL-${snapshot.puzzleNumber}-${resultForFile}.png`,
  };
}

export async function renderDailySharePng(model: DailyShareModel): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("Image generation requires a browser.");
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = DAILY_SHARE_SIZE;
  canvas.height = DAILY_SHARE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image generation is unavailable.");

  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, DAILY_SHARE_SIZE, DAILY_SHARE_SIZE);

  roundedRectangle(context, 58, 58, 964, 964, 54);
  context.fillStyle = COLORS.surface;
  context.fill();
  context.strokeStyle = COLORS.line;
  context.lineWidth = 3;
  context.stroke();

  const logoTile = 52;
  const logoGap = 8;
  const logoX = 106;
  const logoY = 104;
  const logoColors = [COLORS.correct, COLORS.present, COLORS.present, COLORS.correct];
  const logoLetters = ["W", "R", "D", "L"];
  for (let index = 0; index < 4; index += 1) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    roundedRectangle(
      context,
      logoX + column * (logoTile + logoGap),
      logoY + row * (logoTile + logoGap),
      logoTile,
      logoTile,
      7,
    );
    context.fillStyle = logoColors[index];
    context.fill();
    context.fillStyle = COLORS.text;
    context.font = '600 25px "Fredoka Variable", "Trebuchet MS", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      logoLetters[index],
      logoX + column * (logoTile + logoGap) + logoTile / 2,
      logoY + row * (logoTile + logoGap) + logoTile / 2 + 1,
    );
  }

  context.fillStyle = COLORS.text;
  context.font = '600 74px "Fredoka Variable", "Trebuchet MS", sans-serif';
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("WRDL", 260, 163);

  context.fillStyle = COLORS.muted;
  context.font = '500 28px "Fredoka Variable", "Trebuchet MS", sans-serif';
  context.textAlign = "right";
  context.fillText(`DAILY WORDLE #${model.puzzleNumber.toLocaleString("en-US")}`, 940, 138);
  context.fillStyle = COLORS.text;
  context.font = '600 44px "Fredoka Variable", "Trebuchet MS", sans-serif';
  context.fillText(model.result, 940, 188);

  const tileSize = 76;
  const tileGap = 13;
  const boardWidth = tileSize * 5 + tileGap * 4;
  const boardHeight = tileSize * 6 + tileGap * 5;
  const boardX = (DAILY_SHARE_SIZE - boardWidth) / 2;
  const boardY = 315;

  model.tiles.forEach((tile, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    roundedRectangle(
      context,
      boardX + column * (tileSize + tileGap),
      boardY + row * (tileSize + tileGap),
      tileSize,
      tileSize,
      10,
    );
    context.fillStyle = COLORS[tile];
    context.fill();
    if (tile === "empty") {
      context.strokeStyle = COLORS.line;
      context.lineWidth = 3;
      context.stroke();
    }
  });

  context.textAlign = "center";
  context.fillStyle = COLORS.text;
  context.font = '500 34px "Fredoka Variable", "Trebuchet MS", sans-serif';
  const streakLabel = `${model.streak} ${model.streak === 1 ? "day" : "days"}`;
  context.fillText(
    `Current streak · ${streakLabel}`,
    DAILY_SHARE_SIZE / 2,
    boardY + boardHeight + 72,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The Share Results image could not be generated."));
    }, "image/png");
  });
}

export function downloadDailySharePng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
