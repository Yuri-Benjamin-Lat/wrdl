import styles from "./ui.module.css";

export type TileState = "empty" | "filled" | "correct" | "present" | "absent";
export type BoardTile = { letter?: string; state?: TileState; active?: boolean };

export function GameBoard({
  tiles = [],
  compact = false,
  highContrast = false,
  shakeRow = null,
  revealRow = null,
  label = "Word puzzle board",
}: {
  tiles?: BoardTile[];
  compact?: boolean;
  highContrast?: boolean;
  shakeRow?: number | null;
  revealRow?: number | null;
  label?: string;
}) {
  const completeTiles = Array.from({ length: 30 }, (_, index) =>
    tiles[index] ? tiles[index] : { state: "empty" as const },
  );
  return (
    <div
      className={`${styles.board} ${compact ? styles.boardCompact : ""} ${highContrast ? styles.highContrast : ""}`}
      role="grid"
      aria-label={label}
    >
      {completeTiles.map((tile, index) => (
        <span
          className={`${styles.tile} ${styles[`tile${tile.state ?? "empty"}`]} ${tile.active ? styles.tileActive : ""} ${shakeRow === Math.floor(index / 5) ? styles.tileShake : ""}`}
          style={
            revealRow === Math.floor(index / 5)
              ? { animationDelay: `${(index % 5) * 85}ms` }
              : undefined
          }
          role="gridcell"
          aria-label={tile.letter ? `${tile.letter}, ${tile.state}` : "empty"}
          key={index}
          data-revealing={revealRow === Math.floor(index / 5) || undefined}
        >
          {tile.letter ?? ""}
        </span>
      ))}
    </div>
  );
}
