import { colors, formatText } from "../utils/colors";
import { isTTY } from "../utils/tty";

/**
 * Render table title lines
 */
function _renderTitle(title: string | undefined, styled: boolean): string[] {
  if (!title) return [];
  return ["", styled ? formatText(title, { bold: true }) : title, ""];
}

/**
 * Column alignment options
 */
export type ColumnAlign = "left" | "center" | "right";

/**
 * Column definition for table
 */
export interface TableColumn<T = Record<string, unknown>> {
  /** Column key in the data object */
  key: keyof T;
  /** Display header text */
  header: string;
  /** Column alignment (default: left) */
  align?: ColumnAlign;
  /** Fixed column width (auto-calculated if not specified) */
  width?: number;
  /** Custom formatter function for cell values */
  formatter?: (value: unknown, row: T) => string;
}

/**
 * Configuration for table component
 */
export interface TableConfig<T = Record<string, unknown>> {
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Data rows */
  rows: T[];
  /** Show header row (default: true) */
  showHeader?: boolean;
  /** Show borders (default: true in TTY mode) */
  showBorders?: boolean;
  /** Table title (optional) */
  title?: string;
}

/**
 * Align text within a given width
 */
function alignText(text: string, width: number, align: ColumnAlign): string {
  const textLength = stripAnsi(text).length;
  const padding = Math.max(0, width - textLength);

  switch (align) {
    case "right":
      return " ".repeat(padding) + text;
    case "center": {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return " ".repeat(leftPad) + text + " ".repeat(rightPad);
    }
    default:
      return text + " ".repeat(padding);
  }
}

/**
 * Strip ANSI escape codes from string for length calculation
 */
function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI codes regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Calculate column widths based on content
 */
function calculateColumnWidths<T>(
  columns: TableColumn<T>[],
  rows: T[],
  showHeader: boolean,
): number[] {
  return columns.map((col) => {
    // Use fixed width if specified
    if (col.width !== undefined) {
      return col.width;
    }

    // Calculate max width from header and data
    let maxWidth = showHeader ? col.header.length : 0;

    for (const row of rows) {
      const value = row[col.key];
      const formatted = col.formatter
        ? col.formatter(value, row)
        : String(value ?? "");
      const length = stripAnsi(formatted).length;
      maxWidth = Math.max(maxWidth, length);
    }

    return maxWidth;
  });
}

/**
 * Format a single cell value
 */
function formatCell<T>(value: unknown, row: T, column: TableColumn<T>): string {
  if (column.formatter) {
    return column.formatter(value, row);
  }

  if (value === null || value === undefined) {
    return colors.dim("-");
  }

  return String(value);
}

/**
 * Render table in TTY mode with borders and styling
 */
function renderTTY<T>(config: TableConfig<T>): string {
  const {
    columns,
    rows,
    showHeader = true,
    showBorders = true,
    title,
  } = config;
  const lines: string[] = [];

  // Calculate column widths
  const widths = calculateColumnWidths(columns, rows, showHeader);

  // Title
  lines.push(..._renderTitle(title, true));

  // Header row
  if (showHeader) {
    const headerCells = columns.map((col, i) => {
      const text = formatText(col.header, { bold: true, color: "cyan" });
      return alignText(text, widths[i]!, col.align ?? "left");
    });

    lines.push(headerCells.join(" "));

    // Header separator
    if (showBorders) {
      const separatorParts = widths.map((w) => "─".repeat(w));
      lines.push(colors.gray(separatorParts.join("─")));
    }
  }

  // Data rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const value = row[col.key];
      const formatted = formatCell(value, row, col);
      return alignText(formatted, widths[i]!, col.align ?? "left");
    });

    lines.push(cells.join(" "));
  }

  // Bottom border (optional)
  if (showBorders && rows.length > 0) {
    const separatorParts = widths.map((w) => "─".repeat(w));
    lines.push(colors.gray(separatorParts.join("─")));
  }

  return lines.join("\n");
}

/**
 * Render table in non-TTY mode (plain text)
 */
function renderPlain<T>(config: TableConfig<T>): string {
  const { columns, rows, showHeader = true, title } = config;
  const lines: string[] = [];

  // Calculate column widths
  const widths = calculateColumnWidths(columns, rows, showHeader);

  // Title
  lines.push(..._renderTitle(title, false));

  // Header row
  if (showHeader) {
    const headerCells = columns.map((col, i) =>
      alignText(col.header, widths[i]!, col.align ?? "left"),
    );
    lines.push(headerCells.join(" "));

    // Separator
    const separator = columns.map((_, i) => "-".repeat(widths[i]!)).join(" ");
    lines.push(separator);
  }

  // Data rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const value = row[col.key];
      const formatted = formatCell(value, row, col);
      return alignText(stripAnsi(formatted), widths[i]!, col.align ?? "left");
    });
    lines.push(cells.join(" "));
  }

  return lines.join("\n");
}

/**
 * Display a table with columns and rows
 *
 * @example
 * ```typescript
 * table({
 *   title: "Users",
 *   columns: [
 *     { key: "name", header: "Name" },
 *     { key: "age", header: "Age", align: "right" },
 *     { key: "status", header: "Status", formatter: (val) =>
 *       val === "active" ? colors.green("✓ Active") : colors.red("✗ Inactive")
 *     },
 *   ],
 *   rows: [
 *     { name: "Alice", age: 25, status: "active" },
 *     { name: "Bob", age: 30, status: "inactive" },
 *   ],
 * });
 * ```
 */
export function table<T = Record<string, unknown>>(
  config: TableConfig<T>,
): void {
  const output = isTTY() ? renderTTY(config) : renderPlain(config);
  console.log(output);
}
