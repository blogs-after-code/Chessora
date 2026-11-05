// Sample PGNs shared by tests. All games below are legal.
export const SCHOLARS_MATE = `[Event "Test game"]
[Site "https://lichess.org/AbCdEfGh"]
[Date "2026.11.04"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

export const FOOLS_MATE = `[Event "Another game"]
[Site "https://lichess.org/ZyXwVuTs"]
[Date "2026.11.03"]
[White "Carol"]
[Black "Dave"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`;

export const UNFINISHED = `[Event "Unfinished"]
[Date "????.??.??"]
[White "?"]
[Black "Eve"]
[Result "*"]

1. d4 d5 2. c4 e6 *`;

export const ILLEGAL = `[Event "Broken"]
[White "X"]
[Black "Y"]
[Result "*"]

1. e5 e6 *`;

export const MULTI = `${SCHOLARS_MATE}\n\n${FOOLS_MATE}\n`;

// A real analysed Lichess game as exported by "Share & export > PGN" (comments, variations, ?? marks).
// 41 plies, white wins when black resigns.
export const LICHESS_ANNOTATED = `[Event "rated bullet game"]
[Site "https://lichess.org/game/GYxGySj0"]
[Date "2026.11.05"]
[Round "-"]
[White "DivyanshSeth505"]
[Black "dim-bulb"]
[Result "1-0"]
[GameId "GYxGySj0"]
[UTCDate "2026.11.05"]
[UTCTime "00:15:14"]
[WhiteElo "1483"]
[BlackElo "1502"]
[WhiteRatingDiff "+29"]
[BlackRatingDiff "-6"]
[Variant "Standard"]
[TimeControl "60+0"]
[ECO "C20"]
[Opening "King's Pawn Game"]
[Termination "Normal"]
[Annotator "lichess.org"]

1. e4 { [%eval 0.18] [%clk 0:01:00] } 1... e5 { [%eval 0.22] [%clk 0:01:00] } { C20 King's Pawn Game } 2. Qg4?! { (0.22 → -0.71) Inaccuracy. Nf3 was best. } { [%eval -0.71] [%clk 0:01:00] } (2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. Re1 Nd6 6. Nxe5 Nxe5) 2... Nc6 { [%eval -0.83] [%clk 0:00:59] } 3. Bc4?? { (-0.83 → -4.82) Blunder. Qd1 was best. } { [%eval -4.82] [%clk 0:00:59] } (3. Qd1 Nf6 4. Nc3 d5 5. exd5 Nxd5 6. Nf3 Bg4 7. Bb5 Nxc3) 3... Nf6?? { (-4.82 → -1.60) Blunder. d5 was best. } { [%eval -1.6] [%clk 0:00:58] } (3... d5 4. Qe2 Nd4 5. Qd1 dxc4 6. d3 Bg4 7. f3 Be6 8. Be3) 4. Qf3 { [%eval -1.99] [%clk 0:00:58] } 4... Nd4 { [%eval -1.98] [%clk 0:00:56] } 5. Qd3? { (-1.98 → -3.94) Mistake. Qd1 was best. } { [%eval -3.94] [%clk 0:00:57] } (5. Qd1 Nxe4 6. d3 Nc5 7. c3 Nf5 8. a3 c6 9. Ba2 d5) 5... g6?? { (-3.94 → -1.26) Blunder. d5 was best. } { [%eval -1.26] [%clk 0:00:52] } (5... d5 6. Bb3 Nxe4 7. Ne2 Nc5 8. Qc3 Ncxb3 9. cxb3 Bb4 10. Qg3) 6. c3 { [%eval -1.2] [%clk 0:00:57] } 6... Nc6?! { (-1.20 → -0.43) Inaccuracy. d5 was best. } { [%eval -0.43] [%clk 0:00:51] } (6... d5 7. cxd4 dxc4 8. Qxc4 Qxd4 9. Qxd4 exd4 10. d3 b6 11. Nf3) 7. Nf3 { [%eval -0.56] [%clk 0:00:51] } 7... Bg7 { [%eval -0.5] [%clk 0:00:49] } 8. O-O { [%eval -0.5] [%clk 0:00:50] } 8... d6 { [%eval -0.4] [%clk 0:00:48] } 9. Na3 { [%eval -0.75] [%clk 0:00:49] } 9... a6 { [%eval -0.55] [%clk 0:00:46] } 10. Bb3 { [%eval -0.5] [%clk 0:00:47] } 10... Bg4?! { (-0.50 → 0.08) Inaccuracy. O-O was best. } { [%eval 0.08] [%clk 0:00:43] } (10... O-O 11. Qe2 b5 12. d3 h6 13. Be3 Na5 14. Bd1 c5 15. b4 cxb4 16. cxb4) 11. Qe2 { [%eval -0.07] [%clk 0:00:47] } 11... O-O { [%eval 0.03] [%clk 0:00:39] } 12. d3 { [%eval -0.15] [%clk 0:00:45] } 12... d5 { [%eval 0.17] [%clk 0:00:38] } 13. Bg5 { [%eval 0.11] [%clk 0:00:44] } 13... dxe4 { [%eval 0.19] [%clk 0:00:35] } 14. dxe4 { [%eval 0.24] [%clk 0:00:44] } 14... h6 { [%eval 0.22] [%clk 0:00:34] } 15. Bxf6 { [%eval 0.04] [%clk 0:00:43] } 15... Qxf6 { [%eval 0.11] [%clk 0:00:30] } 16. h3 { [%eval 0.0] [%clk 0:00:43] } 16... Bxf3 { [%eval -0.01] [%clk 0:00:29] } 17. Qxf3 { [%eval -0.04] [%clk 0:00:41] } 17... Qxf3 { [%eval -0.05] [%clk 0:00:27] } 18. gxf3 { [%eval -0.09] [%clk 0:00:41] } 18... Rfe8 { [%eval 0.17] [%clk 0:00:26] } 19. Nc4 { [%eval 0.0] [%clk 0:00:39] } 19... Rad8 { [%eval 0.05] [%clk 0:00:24] } 20. Rfd1 { [%eval -0.11] [%clk 0:00:38] } 20... Na5?? { (-0.11 → 7.03) Blunder. Rxd1+ was best. } { [%eval 7.03] [%clk 0:00:20] } (20... Rxd1+ 21. Rxd1 Rd8 22. Rd5 Rxd5 23. exd5 Nd8 24. Na5 h5 25. Ba4 b6 26. Nc6) 21. Nxa5 { [%eval 6.91] [%clk 0:00:35] } { Black resigns. } 1-0`;

// The same idea, short: two comments in a row, a variation, marks, NAGs, a ; comment.
export const ANNOTATED_SHORT = `[Event "Annotated"]
[White "Ann"]
[Black "Otto"]
[Result "1-0"]

1. e4 { [%eval 0.18] } 1... e5 { [%eval 0.22] } { C20 King's Pawn Game } 2. Qg4?! $6 { Inaccuracy. } (2. Nf3 Nc6 { fine (really) } 3. Bb5) 2... Nc6 ; rest of line comment
3. Bc4?? { Blunder. } 3... Nf6 4. Qf3 { Black resigns. } 1-0`;
