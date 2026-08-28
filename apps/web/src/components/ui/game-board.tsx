import styles from "./ui.module.css";

export type TileState = "empty" | "filled" | "correct" | "present" | "absent";
export type BoardTile = { letter?: string; state?: TileState; active?: boolean };

export function GameBoard({
  tiles = [],
  compact = false,
  highContrast = false,
  label = "Word puzzle board",
}: {
  tiles?: BoardTile[];
  compact?: boolean;
  highContrast?: boolean;
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
          className={`${styles.tile} ${styles[`tile${tile.state ?? "empty"}`]} ${tile.active ? styles.tileActive : ""}`}
          role="gridcell"
          aria-label={tile.letter ? `${tile.letter}, ${tile.state}` : "empty"}
          key={index}
        >
          {tile.letter ?? ""}
        </span>
      ))}
    </div>
  );
}
