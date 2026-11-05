// Saved engine analysis: the shape the browser sends with PATCH /api/games/:id.
// The browser runs Stockfish; the server only checks the data is well-formed and stores it.
import { z } from 'zod';

export const MAX_ANALYSIS_PLIES = 1000;
export const CLASSES = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

// ev = evaluation from White's point of view in centipawns; mates are +-(10000 - moves to mate).
const ev = z.number().int().min(-10000).max(10000);

const moveSchema = z.object({
  ev,
  best: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, 'Bad best move').nullable(),
  cls: z.enum(CLASSES),
  loss: z.number().int().min(0).max(10000),
}).strict();

export const analysisSchema = z.object({
  version: z.literal(1),
  engine: z.string().trim().min(1).max(60),
  depth: z.number().int().min(1).max(30),
  startEv: ev,
  moves: z.array(moveSchema).min(1, 'Analysis has no moves').max(MAX_ANALYSIS_PLIES, 'Game is too long to analyse'),
}).strict();

// analysis: null removes the saved analysis.
export const patchSchema = z.object({
  analysis: analysisSchema.nullable(),
}).strict();

/** Parse the stored JSON text; returns null if there is none or it is unreadable. */
export function readAnalysis(text) {
  if (!text) return null;
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}
