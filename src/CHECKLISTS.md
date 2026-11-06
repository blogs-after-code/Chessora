# CHECKLISTS - manual browser checks

Automated tests cannot judge how things look or play on real devices, so the human ticks these by
hand. Copy the list, tick what works, and tell the AI about anything that does not. "Expect" says
what a good result looks like.

## Phase 5 - Export studio (run once in Chrome or Edge, once in Firefox)

Setup: log in, open a game from the library, press **Export image, GIF or video**.

- [ ] The page shows the board with proper chess pieces (not text symbols), the player names, the move text and your @handle. Expect: it looks like the preview on the right.
- [ ] Move the "Position shown" slider. Expect: the board and move text change; the last move's two squares are tinted.
- [ ] Change shape, size, board colours and "White is at the" to flipped. Expect: the preview follows each change; flipped puts Black's pieces at the bottom.
- [ ] **Image:** press Make image, then Download. Expect: a PNG that opens in your image viewer and matches the preview.
- [ ] **GIF:** choose Animated GIF, range 0 to about 12, 0.5 seconds, Make GIF. Expect: a progress bar, then a looping GIF you can preview on the page; Download saves it; it plays in your image viewer or browser tab.
- [ ] GIF with Size = Large. Expect: it steps down to Medium by itself.
- [ ] Start and end the same number. Expect: a clear red message, nothing is made.
- [ ] **Video:** choose Video, range 0 to about 6, 0.5 seconds, Make video. Expect: the picture plays live in the preview while it records, then a video player appears; the video lasts about as long as the animation and the last position stays on screen about 2 seconds.
- [ ] Chrome or Edge: the download is `.mp4`. Firefox: the download is `.webm`. Expect: it plays in VLC or your browser.
- [ ] Press Cancel in the middle of a video. Expect: "Cancelled." and the Make button comes back.
- [ ] Upload the MP4 to Instagram (Reel or story, 9:16). Expect: it uploads and plays. (Firefox: convert WebM to MP4 first.)
- [ ] Phone (optional): open the site on your phone. Expect: the page is usable; if video is not offered, GIF and Image still work.

Known and accepted: a WebM file from Firefox cannot be scrubbed in some players (the browser does not store its length); it still plays.

## Phase 6 - Key moments and clips (Chrome or Edge, then Firefox)

Setup: use a game you analysed in Phase 4 (ideally one with a clear blunder). Open it and press **Key moments and clips**.

- [ ] A game you have not analysed shows a message with a link to analyse it first. Expect: no list, no errors.
- [ ] An analysed game lists its moments, biggest first, each with a coloured label (Blunder, Mistake, Great move, Brilliant move), the player's name and a short reason. Expect: the biggest blunder is near the top and the first moment is already selected.
- [ ] The "Show" menu filters the list (for example only Blunders). Expect: the list shrinks, the preview stays.
- [ ] Click a different moment. Expect: the preview, the title (for example "Blunder: Qxf7??") and the slider change to that moment.
- [ ] Drag the preview slider. Expect: the board moves through the clip; the title is hidden before the key move and appears at it; the evaluation bar and the number next to the move text follow who is winning.
- [ ] Change "Positions before" and "Positions after". Expect: the slider range grows or shrinks; it never goes outside the game.
- [ ] **Blunder clip:** pick a blunder, leave the defaults, press Make clip. Expect: a video (MP4 in Chrome/Edge, WebM in Firefox) of about 8 to 12 seconds where the blunder stays on screen about 2 seconds; the download works and plays.
- [ ] **Best-move clip:** filter to Great moves (or Brilliant moves if you have one), make a clip. Expect: the same, with the green title.
- [ ] Make the same clip as a GIF (Square, Small). Expect: a looping GIF that plays.
- [ ] Time yourself: from opening the Key moments page to a downloaded blunder clip, then a best-move clip. Expect: under one minute for both (video recording takes as long as the clip lasts).
- [ ] Upload one clip to Instagram as a Reel. Expect: it plays with the title, board and evaluation bar readable on your phone.
