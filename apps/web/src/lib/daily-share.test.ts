import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailySnapshot } from "./daily";
import { createDailyShareModel, DAILY_SHARE_SIZE, renderDailySharePng } from "./daily-share";

const completed: DailySnapshot = {
  officialDate: "2026-08-29",
  serverTime: "2026-08-29T04:00:00.000Z",
  resetAt: "2026-08-29T16:00:00.000Z",
  eligible: true,
  puzzleNumber: 1893,
  status: "win",
  guesses: [
    {
      number: 1,
      guess: "crane",
      pattern: "01220",
      acceptedAt: "2026-08-29T04:01:00.000Z",
    },
  ],
  acceptedGuessCount: 1,
  rewardExperience: 20,
  streak: 12,
  level: 3,
  experience: 15,
  wins: 8,
  missed: 1,
  failed: 2,
};

afterEach(() => vi.unstubAllGlobals());

describe("Daily Share Results model", () => {
  it("creates a constant spoiler-free 5 by 6 image model", () => {
    const model = createDailyShareModel(completed);
    expect(DAILY_SHARE_SIZE).toBe(1080);
    expect(model).toMatchObject({
      puzzleNumber: 1893,
      result: "1/6",
      streak: 12,
      filename: "WRDL-1893-1-of-6.png",
    });
    expect(model.tiles).toHaveLength(30);
    expect(model.tiles.slice(0, 5)).toEqual(["absent", "present", "correct", "correct", "absent"]);
    expect(model.tiles.slice(5)).toEqual(Array(25).fill("empty"));
    expect(JSON.stringify(model)).not.toContain("crane");
    expect(JSON.stringify(model)).not.toContain("answer");
  });

  it("uses the approved failure result and filename", () => {
    const model = createDailyShareModel({
      ...completed,
      status: "failed",
      acceptedGuessCount: 6,
    });
    expect(model.result).toBe("X/6");
    expect(model.filename).toBe("WRDL-1893-X-of-6.png");
  });

  it("rejects unfinished and unavailable Daily snapshots", () => {
    expect(() => createDailyShareModel({ ...completed, status: "in_progress" })).toThrow(
      "completed",
    );
    expect(() => createDailyShareModel({ ...completed, puzzleNumber: null })).toThrow("completed");
  });

  it("renders a real 1080 square without drawing guessed letters", async () => {
    const drawnText: string[] = [];
    const fillText = vi.fn((text: string) => drawnText.push(text));
    const context = {
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      fillText,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" }))),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", {
      fonts: { ready: Promise.resolve() },
      createElement: vi.fn(() => canvas),
    });

    const blob = await renderDailySharePng(createDailyShareModel(completed));

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1080);
    expect(blob.type).toBe("image/png");
    expect(drawnText).toContain("WRDL");
    expect(fillText).toHaveBeenCalledWith("WRDL", 260, 163);
    expect(drawnText).toContain("DAILY WORDLE #1,893");
    expect(drawnText).toContain("1/6");
    expect(drawnText).not.toContain("#1,893 · 1/6");
    expect(drawnText.join(" ")).not.toContain("crane");
  });
});
