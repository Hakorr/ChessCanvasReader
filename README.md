# ChessCanvasReader

A lightweight JS library (<9kb minified) to read a HTML canvas, especially to convert it to FEN.

> [!CAUTION]
In early development, not ready to be used. Optimized on Lichess.org boards.

![example](https://github.com/user-attachments/assets/ad96237f-971a-415f-8be7-c1ca60e09409)

# Usage

## Constructor

```js
const CanvasReader = new ChessCanvasReader(canvas, config);
```

The config (Object) can consists of the following properties:

- `wantedMinPoints` (Number): Points refer to (x, y) houghSpace points. This indicates how sensitive the piece detection is. The default value is `750` points.
- `wantedMaxPoints` (Number): Points refer to (x, y) houghSpace points. This indicates how sensitive the piece detection is. The default value is `900` points.
- `squareZoomPx` (Number): How many pixels to zoom in on an individual square image. The default value is `11` pixels.
- `boardSize` (Array): An array indicating how many squares the board has, width and height. The default value is `[8, 8]` squares.
- `resizeBoardInwards` (Boolean): The board image will be cropped into a perfect square, will it be resized symmetrically towards the center of the image, or will it be resized only from the left and bottom sides. The default value is `false`.
- `debug` (Boolean): Enable debug mode, starts to console log certain useful values for debugging purposes. Keep this disabled on production. The default value is `false`.
- `pieceShapes` (Array): An object array containing each piece type's common edge point coordinates. Used for pattern matching. The default value cannot be shown here, see the source code.

## Methods

#### `detectFen(canvas)`

This method analyzes the image data from a HTML canvas element and returns a FEN string

- `canvas` (HTMLElement): A canvas element with the chessboard entirely, nothing extra

##### Returns

The basic FEN of the given board as a string. (For example: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR`)

## Example usage

```js
const canvas = document.querySelector('#board-canvas');

const CanvasReader = new ChessCanvasReader(canvas, { 'debug': true });

const fen = CanvasReader.detectFen(canvasElem);

console.log('This is the FEN:', fen);
```

# Philosophy

1. Crop squares from the board image, process each 64 square images separately.
2. Apply edge detection and hough circle detection (kind of) to a piece image, clean the hough space from clutter. This forms a convex hull for the piece.
3. Piece's convex hull points matched with stored hull points via dynamic time warping. The piece's type is determined by the best match.
4. Check pixel brightnesses from a centered horizontal line of the convex hull. The piece colour is the determined by how many bright (>127) pixels there were.

The average time to compute the FEN of a board image is around 1.5 ± 0.5 seconds.

## Important

This project is still in very early development stages, expect a buggy, non-working mess. The goal was to see what it's like to develop computer vision and the message was very well received, it is very hard. Using AI would have helped.
