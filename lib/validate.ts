// Board validation for the token radar: every rule the gate refuses on, checked
// here before a byte is written, so a bad board fails loudly in this program
// instead of shipping an output the scorer rebuilds and rejects.
//
// The checks mirror the gate's own limits: the board holds at least 100 rows,
// it covers the whole watchlist, its ranks run 1..n in order, its implied
// values fall strictly from rank to rank and no two rows share one, every row
// carries a rationale and a farm plan of 3..12 steps of 20..600 characters,
// every peer multiple sits inside the model's clamp, and the bookkeeping the
// dashboard relies on — the board size, the watchlist, and the model version
// the radar reports — all agree with the board that was actually built.
//
// Nothing here reads or writes a file, and nothing mutates its inputs: the
// caller runs it on the board in memory and only writes the output when it
// comes back with no problems. A board that fails returns its problems as
// plain strings, worst first, capped so a broken board does not flood the log.

import type { BoardRow } from './model.ts';

/** The radar summary the board is checked against: the numbers buildRadar reports. */
export interface BoardMeta {
  board_size: number;
  watchlist_size: number;
  watchlist_slugs: string[];
  model_version: string;
  rows_count: number;
}

/** The gate's own limits, written out so the checks read as the rules they are. */
const MIN_ROWS = 100;
const MIN_FARM_STEPS = 3;
const MAX_FARM_STEPS = 12;
const MIN_STEP_CHARS = 20;
const MAX_STEP_CHARS = 600;
const PEER_FLOOR = 0.02;
const PEER_CAP = 1.5;
const MAX_ISSUES = 50;

/** A safe integer, the only kind a rank, a count or a dollar value may be. */
function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** A finite number, for the money and multiple fields. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A string with something in it, once the padding is gone. */
function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Every problem with the board, in plain words, worst first; an empty list
 * means the board is one the gate will take. `meta` is the radar summary the
 * board is checked against, so a board that disagrees with its own summary
 * fails here even when every row looks fine on its own.
 */
export function validateBoard(board: BoardRow[], meta: BoardMeta): string[] {
  const issues: string[] = [];
  const add = (message: string): void => {
    if (issues.length < MAX_ISSUES) issues.push(message);
  };

  if (!Array.isArray(board)) return ['the board is not an array'];
  if (board.length < MIN_ROWS) {
    add(`the board has ${board.length} rows, below the ${MIN_ROWS} the gate takes`);
  }

  // The summary has to describe this board, not another one: its size, its
  // row count and its watchlist must all match what is actually here.
  if (!isInt(meta.board_size) || meta.board_size !== board.length) {
    add(`the radar reports board_size ${String(meta.board_size)} for a board of ${board.length} rows`);
  }
  if (!isInt(meta.rows_count) || meta.rows_count !== board.length) {
    add(`the radar reports ${String(meta.rows_count)} dashboard rows for a board of ${board.length} rows`);
  }
  if (!Array.isArray(meta.watchlist_slugs)) {
    add('the radar reports no watchlist of slugs');
  } else if (!isInt(meta.watchlist_size) || meta.watchlist_size !== meta.watchlist_slugs.length) {
    add(`the radar reports watchlist_size ${String(meta.watchlist_size)} for ${meta.watchlist_slugs.length} watchlist slugs`);
  }
  if (!isFilled(meta.model_version)) {
    add('the radar reports no model version');
  }

  // The watchlist is the floor: every slug on it must be on the board, and a
  // slug may not appear twice. Report the missing ones by name, first five.
  const seen = new Set<string>();
  for (const row of board) {
    if (typeof row.slug === 'string' && row.slug.length > 0) {
      if (seen.has(row.slug)) add(`slug ${row.slug} appears twice on the board`);
      seen.add(row.slug);
    }
  }
  if (Array.isArray(meta.watchlist_slugs)) {
    const missing = meta.watchlist_slugs.filter((slug) => !seen.has(slug));
    if (missing.length > 0) {
      add(
        `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`,
      );
    }
  }

  // Ranks run 1..n in board order: the row in position i must carry rank i + 1.
  // That one check covers uniqueness and contiguity at the same time.
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (!isInt(row.rank) || row.rank !== i + 1) {
      add(`row ${i + 1} (${row.slug}) carries rank ${String(row.rank)}, not ${i + 1}`);
      break;
    }
  }

  // Implied values must fall strictly from rank to rank, and no two rows may
  // share one: a board that ranks nothing by value is not a ranking.
  const values = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (!isInt(row.implied_value_usd) || row.implied_value_usd <= 0) {
      add(`${row.slug} has implied value ${String(row.implied_value_usd)}`);
      continue;
    }
    if (values.has(row.implied_value_usd)) {
      add(`${row.slug} shares its implied value $${row.implied_value_usd} with another row`);
    }
    values.add(row.implied_value_usd);
    if (i > 0 && row.implied_value_usd >= board[i - 1]!.implied_value_usd) {
      add(`${row.slug} (rank ${row.rank}) outranks ${board[i - 1]!.slug} on implied value`);
    }
  }

  // Every row's own figures: a positive TVL, a peer multiple inside the clamp,
  // a peer count that is a whole number (zero means the row fell back to the
  // global median, which the model allows), a rationale, and a farm plan the
  // gate's step limits accept.
  for (const row of board) {
    if (!isFiniteNumber(row.tvl_usd) || row.tvl_usd <= 0) {
      add(`${row.slug} has TVL ${String(row.tvl_usd)}`);
    }
    if (!isFiniteNumber(row.peer_multiple) || row.peer_multiple < PEER_FLOOR || row.peer_multiple > PEER_CAP) {
      add(`${row.slug} has peer multiple ${String(row.peer_multiple)}, outside [${PEER_FLOOR}, ${PEER_CAP}]`);
    }
    if (!isInt(row.peer_count) || row.peer_count < 0) {
      add(`${row.slug} has peer count ${String(row.peer_count)}`);
    }
    if (!isFilled(row.peer_category)) {
      add(`${row.slug} names no peer category`);
    }
    if (!isFilled(row.rationale)) {
      add(`${row.slug} has no rationale`);
    }
    if (row.token_status !== 'pre-token') {
      add(`${row.slug} has token status ${String(row.token_status)}, not pre-token`);
    }
    if (row.age_days !== null && (!isInt(row.age_days) || row.age_days < 0)) {
      add(`${row.slug} has age ${String(row.age_days)} days`);
    }
    if (!Array.isArray(row.farm_steps)) {
      add(`${row.slug} has no farm plan`);
      continue;
    }
    if (row.farm_steps.length < MIN_FARM_STEPS || row.farm_steps.length > MAX_FARM_STEPS) {
      add(`${row.slug} has ${row.farm_steps.length} farm steps, outside ${MIN_FARM_STEPS}..${MAX_FARM_STEPS}`);
      continue;
    }
    for (const step of row.farm_steps) {
      if (typeof step !== 'string' || step.length < MIN_STEP_CHARS || step.length > MAX_STEP_CHARS) {
        add(`${row.slug} has a farm step of ${typeof step === 'string' ? step.length : 'non-string'} characters`);
        break;
      }
    }
  }

  if (issues.length === MAX_ISSUES) {
    issues.push('... and more problems beyond these');
  }
  return issues;
}
