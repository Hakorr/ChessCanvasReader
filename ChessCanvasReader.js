/* ChessCanvasReader.js
 - Version: 0.9
 - Author: Haka
 - Description: A lightweight JS library to read a HTML canvas, especially convert it to FEN
 - GitHub: https://github.com/Hakorr/ChessCanvasReader
*/

class ChessCanvasReader {
	constructor(canvas, config) {
		if(typeof canvas === 'object') {
			if(canvas instanceof HTMLElement) {
				this.canvas = canvas;
			} else if(Object.keys(canvas).length > 0) {
				config = canvas;
			}
		}
		
		this.wantedMinPoints = config?.wantedMinPoints || 750;
		this.wantedMaxPoints = config?.wantedMaxPoints || 900;
		this.squareZoomPx = this.config?.squareZoomPx || 11;
		this.boardSize = this.config?.boardSize || [8, 8];
		this.resizeBoardInwards = this.config?.resizeBoardInwards || false;
		this.debug = config?.debug || false;
		this.pieceShapes = this?.config?.pieceShapes || [
			{ 'p': [[0.44,0],[0.56,0],[0.64,0.031],[0.66,0.046],[0.7,0.108],[0.8,0.338],[0.98,0.8],[1,0.862],[1,1],[0,1],[0,0.862],[0.02,0.8],[0.2,0.338],[0.3,0.108],[0.34,0.046],[0.36,0.031],[0.4,0.015]] },
			{ 'r': [[0.103,0],[0.897,0],[0.931,0.031],[1,0.891],[1,0.969],[0.966,1],[0.034,1],[0,0.969],[0,0.891],[0.069,0.031],[0.086,0.016]] },
			{ 'n': [[0.471,0],[0.5,0.015],[0.735,0.162],[0.779,0.191],[0.838,0.25],[0.882,0.309],[0.926,0.397],[0.956,0.485],[0.971,0.544],[0.985,0.618],[1,0.735],[1,0.971],[0.971,1],[0.294,1],[0.265,0.971],[0.029,0.706],[0,0.647],[0,0.559],[0.221,0.044],[0.25,0.015]] },
			{ 'b': [[0.457,0],[0.543,0],[0.586,0.042],[0.743,0.31],[0.757,0.338],[1,0.944],[1,0.972],[0.971,1],[0.043,1],[0.014,0.986],[0,0.972],[0,0.944],[0.243,0.338],[0.257,0.31],[0.414,0.042],[0.443,0.014]] },
			{ 'k': [[0.485,0],[0.515,0],[0.897,0.309],[0.971,0.426],[1,0.559],[0.985,0.588],[0.794,0.956],[0.618,0.985],[0.485,1],[0.471,1],[0.235,0.985],[0.206,0.971],[0.029,0.618],[0,0.412],[0.015,0.382]] },
			{ 'k': [[0.467,0],[0.533,0],[0.867,0.138],[0.947,0.185],[0.973,0.215],[1,0.277],[1,0.385],[0.827,0.846],[0.76,0.954],[0.747,0.969],[0.707,0.985],[0.547,1],[0.44,1],[0.293,0.985],[0.253,0.969],[0.187,0.846],[0.173,0.815],[0.013,0.415],[0,0.369],[0,0.308],[0.013,0.262],[0.027,0.231],[0.08,0.169],[0.107,0.154]] },
			{ 'k': [[0.147,0],[0.853,0],[0.893,0.02],[0.947,0.06],[0.973,0.1],[0.987,0.14],[1,0.2],[1,0.28],[0.987,0.34],[0.773,0.98],[0.747,1],[0.253,1],[0.227,0.98],[0.013,0.34],[0,0.24],[0.013,0.14],[0.027,0.1],[0.053,0.06],[0.107,0.02]] },
			{ 'q': [[0.487,0],[0.763,0.057],[0.974,0.143],[1,0.171],[1,0.257],[0.829,0.986],[0.803,1],[0.75,1],[0.5,0.986],[0.263,0.971],[0.197,0.957],[0.158,0.9],[0,0.257],[0,0.171],[0.026,0.143],[0.263,0.029]] }
		];

		// Caches two last working thresholds, switches between them
		this.cachedThresholds = [false, false];
		this.squareCutOffset = 0;
	}
	
	normalizePointsToUnitSquare(points) {
		// Find the minimum and maximum x and y coordinates
		let minX = Math.min(...points.map(point => point[0]));
		let maxX = Math.max(...points.map(point => point[0]));
		let minY = Math.min(...points.map(point => point[1]));
		let maxY = Math.max(...points.map(point => point[1]));

		// Normalize the points and round to 3 decimal places using Math.round
		const normalizedPoints = points.map(point => {
			const normalizedX = (point[0] - minX) / (maxX - minX);
			const normalizedY = (point[1] - minY) / (maxY - minY);
			return [
				Math.round(normalizedX * 1000) / 1000,  // Round to 3 decimals
				Math.round(normalizedY * 1000) / 1000   // Round to 3 decimals
			];
		});

		return normalizedPoints;
	}

	getConvexHull(points) {
		// Helper function to find the orientation of three points
		const orientation = (p, q, r) => {
			const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
			return val === 0 ? 0 : (val > 0 ? 1 : 2); // 0 -> collinear, 1 -> clockwise, 2 -> counterclockwise
		};

		// Find the point with the lowest y-coordinate (and leftmost if tied)
		const lowestPoint = points.reduce((min, p) => (p[1] < min[1] || (p[1] === min[1] && p[0] < min[0]) ? p : min), points[0]);

		// Sort the points based on the angle with the lowest point
		points.sort((a, b) => {
			const angleA = Math.atan2(a[1] - lowestPoint[1], a[0] - lowestPoint[0]);
			const angleB = Math.atan2(b[1] - lowestPoint[1], b[0] - lowestPoint[0]);
			return angleA - angleB;
		});

		// Build the convex hull
		const hull = [];
		for(const point of points) {
			while(hull.length >= 2 && orientation(hull[hull.length - 2], hull[hull.length - 1], point) !== 2) {
				hull.pop();
			}
			hull.push(point);
		}

		return hull;
	}

	edgeDetection(uint8rgb, threshold, imageSize) {
		const data = uint8rgb;
		const width = imageSize;
		const height = imageSize;

		// Convert to grayscale
		const grayData = new Uint8ClampedArray(data.length / 4);
		for(let i = 0; i < data.length; i += 4) {
			const avg = (data[i] + data[i + 1] + data[i + 2]) / 3; // Average to grayscale
			grayData[i / 4] = avg;
		}

		const edges = new Uint8ClampedArray(grayData.length);

		for(let y = 1; y < height - 1; y++) {
			for(let x = 1; x < width - 1; x++) {
				const index = y * width + x;
				// Calculate gradients
				const gradientX =
					grayData[index - 1 - width] + 2 * grayData[index - 1] + grayData[index - 1 + width] -
					(grayData[index + 1 - width] + 2 * grayData[index + 1] + grayData[index + 1 + width]);
				const gradientY =
					grayData[index - 1 - width] + 2 * grayData[index - width] + grayData[index + 1 - width] -
					(grayData[index - 1 + width] + 2 * grayData[index + width] + grayData[index + 1 + width]);

				// Calculate the magnitude of the gradient
				const magnitude = Math.sqrt(gradientX * gradientX + gradientY * gradientY);

				// Apply the threshold and clamp to 255 for visibility
				edges[index] = magnitude > threshold ? 255 : 0; // Black edges on a dark background
			}
		}
		
		if(this.debug) {
			console.log('Found edges:', edges);
		}

		return edges;
	}

	cleanHoughSpace(houghSpace) {
		const threshold = 180; // Minimum threshold to keep
		const minBlobSize = 20; // Minimum size for a blob to be considered valid
		const height = houghSpace.length;
		const width = houghSpace[0].length;

		// Step 1: Apply Threshold
		const cleanedHoughSpace = Array.from({ length: height }, () => Array(width).fill(0));

		for(let y = 0; y < height; y++) {
			for(let x = 0; x < width; x++) {
				if(houghSpace[y][x] >= threshold) {
					cleanedHoughSpace[y][x] = houghSpace[y][x]; // Keep only values above threshold
				}
			}
		}

		// Step 2: Remove Small Blobs
		// Create a labels array to track visited points
		const labels = Array.from({ length: height }, () => Array(width).fill(0));
		let label = 1;

		// Helper function to perform depth-first search (DFS)
		function floodFill(x, y) {
			let stack = [[x, y]];
			let size = 0;

			while(stack.length > 0) {
				const [cx, cy] = stack.pop();

				// Check boundaries
				if(cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
				if(cleanedHoughSpace[cy][cx] === 0 || labels[cy][cx] !== 0) continue;

				// Mark the pixel with the current label
				labels[cy][cx] = label;
				size++;

				// Push neighboring pixels (4-connectivity)
				stack.push([cx + 1, cy]);
				stack.push([cx - 1, cy]);
				stack.push([cx, cy + 1]);
				stack.push([cx, cy - 1]);
			}

			return size;
		}

		// Iterate through cleaned Hough space to identify blobs
		for(let y = 0; y < height; y++) {
			for(let x = 0; x < width; x++) {
				if(cleanedHoughSpace[y][x] !== 0 && labels[y][x] === 0) {
					const blobSize = floodFill(x, y); // Find the size of the blob

					// If the blob is too small, set its pixels back to 0
					if(blobSize < minBlobSize) {
						for(let j = 0; j < height; j++) {
							for(let i = 0; i < width; i++) {
								if(labels[j][i] === label) {
									cleanedHoughSpace[j][i] = 0; // Remove small blob
								}
							}
						}
					}
					label++;
				}
			}
		}

		return cleanedHoughSpace;
	}

	houghCircleDetection(edges, imageSize) {
		const width = imageSize;
		const height = imageSize;
		const radius = 0.2;
		const size = 5;

		let houghSpace = Array.from({ length: width }, () => Array.from({ length: height }, () => 0));

		for(let y = 0; y < height; y++) {
			for(let x = 0; x < width; x++) {
				if(edges[y * width + x] > 0) { // Edge detected
					for(let theta = 0; theta < 180; theta++) {
						const a = Math.round(x - radius * Math.cos(theta * Math.PI / 180));
						const b = Math.round(y - radius * Math.sin(theta * Math.PI / 180));
						if(a >= size && a < width - size && b >= size && b < height - size) {
							houghSpace[a][b]++;
						}
					}
				}
			}
		}

		houghSpace = this.cleanHoughSpace(houghSpace);

		// Detect circles
		const circles = [];

		for(let a = 0; a < width; a++) {
			for(let b = 0; b < height; b++) {
				if(houghSpace[a][b] > 150) { // Threshold for detecting circles
					circles.push([a, b]);
				}
			}
		}

		if(this.debug) {
			console.log(`Detected circles: ${circles.length} from houghSpace:`, houghSpace);
		}
		
		return circles;
	}

	euclideanDistance(point1, point2) {
		return Math.sqrt(Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2));
	}

	dynamicTimeWarping(points1, points2) {
		const len1 = points1.length;
		const len2 = points2.length;
		
		const costMatrix = Array(len1).fill(null).map(() => Array(len2).fill(Infinity));
		
		costMatrix[0][0] = this.euclideanDistance(points1[0], points2[0]);
		
		// Populate the cost matrix
		for(let i = 1; i < len1; i++) {
			costMatrix[i][0] = costMatrix[i - 1][0] + this.euclideanDistance(points1[i], points2[0]);
		}
		
		for(let j = 1; j < len2; j++) {
			costMatrix[0][j] = costMatrix[0][j - 1] + this.euclideanDistance(points1[0], points2[j]);
		}
		
		// Fill the rest of the cost matrix
		for(let i = 1; i < len1; i++) {
			for(let j = 1; j < len2; j++) {
				const cost = this.euclideanDistance(points1[i], points2[j]);
				costMatrix[i][j] = cost + Math.min(
					costMatrix[i - 1][j],    // Insertion
					costMatrix[i][j - 1],    // Deletion
					costMatrix[i - 1][j - 1] // Match
				);
			}
		}

		// The distance between the two sequences is found in the bottom-right corner of the matrix
		return costMatrix[len1 - 1][len2 - 1];
	}

	identifyChessPiece(inputPoints) {
		let bestMatch = null;
		let bestScore = Infinity;
		
		for(const obj of this.pieceShapes) {
			const piece = Object.keys(obj)[0];
			const referencePoints = obj[piece];

			const score = this.dynamicTimeWarping(inputPoints, referencePoints);

			if(score < bestScore) {
				bestScore = score;
				bestMatch = piece;
			}
		}

		return bestMatch;
	}

	getUint8AsCanvas(uint8, width, height) {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext('2d');
		const imageData = ctx.createImageData(width, height);
		imageData.data.set(uint8);

		ctx.putImageData(imageData, 0, 0);

		return canvas;
	}

	getUint8DataURL(uint8, width, height) {
		const canvas = this.getUint8AsCanvas(uint8, width, height);
		const ctx = canvas.getContext('2d');

		const dataURL = canvas.toDataURL();

		return dataURL;
	}

	cropImage(input, sideSize, centerCrop = true) {
		let canvas, ctx;

		// Handle the input type
		if(input instanceof Uint8ClampedArray) {
			// If the input is a Uint8ClampedArray, create a new canvas to draw the image
			const width = Math.sqrt(input.length / 4);  // Assuming the input represents a square image
			const height = width;
			canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			ctx = canvas.getContext('2d');

			// Create ImageData from Uint8ClampedArray and put it onto the canvas
			const imgData = new ImageData(input, width, height);
			ctx.putImageData(imgData, 0, 0);
		} else if(input instanceof HTMLCanvasElement) {
			// If input is a canvas, use its context
			canvas = input;
			ctx = canvas.getContext('2d');
		} else if(input instanceof CanvasRenderingContext2D) {
			// If input is a context, use the associated canvas
			ctx = input;
			canvas = ctx.canvas;
		} else {
			throw new Error("Unsupported input type. Must be Uint8ClampedArray, Canvas, or CanvasRenderingContext2D.");
		}

		const originalWidth = canvas.width;
		const originalHeight = canvas.height;

		// Calculate start points for cropping
		let startX, startY;
		if(centerCrop) {
			// Center crop: calculate starting points for cropping in the center
			startX = Math.max(0, (originalWidth - sideSize) / 2);
			startY = Math.max(0, (originalHeight - sideSize) / 2);
		} else {
			// Top-left crop: set the start points to (0, 0)
			startX = 0;
			startY = 0;
		}

		// Create a new canvas for the cropped image
		const croppedCanvas = document.createElement('canvas');
		croppedCanvas.width = sideSize;
		croppedCanvas.height = sideSize;
		const croppedCtx = croppedCanvas.getContext('2d');

		// Draw the cropped section of the image onto the new canvas
		croppedCtx.drawImage(
			canvas, 
			startX, startY, sideSize, sideSize,  // Source: crop the image starting from (startX, startY)
			0, 0, sideSize, sideSize             // Destination: draw it onto the new canvas at full size
		);

		// Return the cropped image
		return croppedCtx.getImageData(0, 0, sideSize, sideSize);
	}


	cropChessboardSquares(uint8arr, boardSideSize, squareSize, rows = 8, cols = 8) {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		// Set canvas size based on the image dimensions
		canvas.width = boardSideSize;
		canvas.height = boardSideSize;

		const imageData = ctx.createImageData(boardSideSize, boardSideSize);
		imageData.data.set(uint8arr);
		ctx.putImageData(imageData, 0, 0);
		const squares = [];

		// Loop through the chessboard to extract each square
		for(let row = 0; row < rows; row++) {
			for(let col = 0; col < cols; col++) {
				// Create a temporary canvas for each square
				const tempCanvas = document.createElement('canvas');
				const tempCtx = tempCanvas.getContext('2d');

				tempCanvas.width = squareSize;
				tempCanvas.height = squareSize;

				// Extract the square from the main chessboard image
				tempCtx.drawImage(
					canvas,
					col * squareSize + (this.squareCutOffset * col),  	// Source X (starting point of the square on x-axis)
					row * squareSize + (this.squareCutOffset * row), 	// Source Y (starting point of the square on y-axis)
					squareSize,        									// Source width (width of the square)
					squareSize,       									// Source height (height of the square)
					-Math.floor(this.squareZoomPx * 1/1.5), 			// Destination X on temp canvas
					-Math.floor(this.squareZoomPx * 1/1.5), 			// Destination Y on temp canvas
					squareSize + this.squareZoomPx, 					// Destination width on temp canvas
					squareSize + this.squareZoomPx  					// Destination height on temp canvas
				);

				squares.push(
					{
						'uint8': tempCtx.getImageData(0, 0, squareSize, squareSize).data,
						'coords': [row, col]
					}
				);
			}
		}

		return squares; // Array of Uint8Array, each representing a square
	}

	isPointInConvexHull(point, hull) {
		let [px, py] = point;
		let inside = true;

		for(let i = 0; i < hull.length; i++) {
			const [x1, y1] = hull[i];
			const [x2, y2] = hull[(i + 1) % hull.length]; // Wrap around to the first point

			const crossProduct = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
			if(crossProduct < 0) {
				inside = false; // The point is outside of the hull
				break;
			}
		}

		return inside;
	}

	getArrayAverage(arr) {
		// Check if the array is empty to avoid division by zero
		if(arr.length === 0) return 0;

		// Sum all the numbers in the array
		const total = arr.reduce((sum, value) => sum + value, 0);

		// Calculate the average by dividing the total by the number of elements
		return total / arr.length;
	}

	processColorLine(colors) {
		let start = 0;
		let end = colors.length - 1;
		let changeCount = 0; // To track the number of changes
		let countOnes = 0, countZeros = 0;

		if(this.debug) {
			console.log('Color line black (0) white (1) array:', colors);
		}

		// Count changes and tally up 1s and 0s at the same time
		for(let i = 1; i < colors.length; i++) {
			if(colors[i] !== colors[i - 1]) {
				changeCount++;  // Increase change count when a change is detected
			}
		}

		// Count 1s and 0s in the entire array
		for(let i = 0; i < colors.length; i++) {
			if(colors[i] === 1) countOnes++;
			else countZeros++;
		}

		// If only two changes occurred, return based on the entire array
		if(changeCount === 2) {
			return countOnes > countZeros ? 'w' : 'b';
		}

		// If the difference is huge, return based on the entire array
		if(Math.abs(countOnes - countZeros) >= colors.length * 0.75) {
			return countOnes > countZeros ? 'w' : 'b';
		}

		// Trim leading identical values
		while(start < end && colors[start] === colors[start + 1]) {
			start++;
		}

		// Trim trailing identical values
		while(end > start && colors[end] === colors[end - 1]) {
			end--;
		}

		// Reset counts for the trimmed array
		countOnes = 0;
		countZeros = 0;

		// Count the number of 1s and 0s in the trimmed array
		for(let i = start; i <= end; i++) {
			if(colors[i] === 1) countOnes++;
			else countZeros++;
		}

		// Return 'w' if more 1s, 'b' if more 0s
		if(countOnes === 0) return 'b'; // All zeros in trimmed
		if(countZeros === 0) return 'w'; // All ones in trimmed

		return countOnes > countZeros ? 'w' : 'b';
	}

	getPieceColorFromConvexHull(squareImageClampedUint8, convexHullPoints, squareSize) {
		// Get bounding box of the convex hull to limit sampling
		const minX = Math.min(...convexHullPoints.map(p => p[0]));
		const maxX = Math.max(...convexHullPoints.map(p => p[0]));
		const i_minY = Math.min(...convexHullPoints.map(p => p[1]));
		const maxY = Math.max(...convexHullPoints.map(p => p[1]));

		const boundingBoxWidth = maxX - minX;
		const boundingBoxHeight = maxY - i_minY;
		const centerX = Math.round((minX + maxX) / 2);
		const centerY = Math.round((i_minY + maxY) / 2);

		const minY = centerY;
		const colorArr = [];

		let whiteCount, blackCount = 0;
		let canvas, ctx = null;

		if(this.debug) {
			// Create a canvas to visualize the points
			canvas = this.getUint8AsCanvas(squareImageClampedUint8, squareSize, squareSize);
			ctx = canvas.getContext('2d');

			// Optionally draw the convex hull for visualization
			ctx.strokeStyle = 'blue';
			ctx.beginPath();
			ctx.moveTo(convexHullPoints[0][0], convexHullPoints[0][1]);

			for(let i = 1; i < convexHullPoints.length; i++) {
				ctx.fillStyle = "red";
				ctx.fillRect(convexHullPoints[i][0], convexHullPoints[i][1], 2, 2);

				ctx.fillStyle = "blue";
				ctx.lineTo(convexHullPoints[i][0], convexHullPoints[i][1]);
			}

			ctx.closePath();
			ctx.stroke();
		}

		// Sample points along the vertical center line
		for(let i = 0; i <= maxX; i++) {
			const x = minX + i;
			const point = [x, centerY];

			// Check if the point is inside the convex hull
			if(this.isPointInConvexHull(point, convexHullPoints)) {
				let color = '';
				let brightnessArr = [];

				const pixelIndex = (Math.round(centerY) * squareSize + x) * 4; // 4 channels for RGBA

				// Retrieve RGBA values
				const r = squareImageClampedUint8[pixelIndex];
				const g = squareImageClampedUint8[pixelIndex + 1];
				const b = squareImageClampedUint8[pixelIndex + 2];
				const a = squareImageClampedUint8[pixelIndex + 3];

				// Calculate brightness using the weighted formula
				const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

				const brightnessExists = typeof brightness === 'number';

				if(brightnessExists) {
					color = (brightness > 127 && a > 127) ? 1 : 0;

					colorArr.push(color);

					if(this.debug) {
						ctx.fillStyle = color ? 'purple' : 'yellow';

						// Draw the sampled point on the canvas
						ctx.beginPath();
						ctx.arc(x, centerY, 1, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
		}

		// Log the canvas and data URL
		if(this.debug) {
			// Convert canvas to data URL for visualization
			const dataURL = canvas.toDataURL();

			console.log(dataURL);
		}

		// Return the dominant color based on counts
		return this.processColorLine(colorArr);
	}

	squeezeEmptySquares(fenStr) {
		return fenStr.replace(/1+/g, match => match.length);
	}

	detectFen(canvas) {
		if(canvas)
			this.canvas = canvas;

		const canvasWidth = this.canvas.width;
		const canvasHeight = this.canvas.height;
		const shortestSide = canvasWidth > canvasHeight ? canvasHeight : canvasWidth;

		const squareSize = Math.floor(shortestSide / this.boardSize[0]);
		this.squareCutOffset = (shortestSide / this.boardSize[0]) - squareSize;

		const imageData = this.cropImage(originalContext, shortestSide, this.resizeBoardInwards);
		const imageUint8Arr = imageData.data;

		let attemptAmountArr = [];
		let fen = '';

		if(this.debug) {
			console.log(this.getUint8DataURL(imageUint8Arr, shortestSide, shortestSide));
		}

		const squareDataArr = this.cropChessboardSquares(imageUint8Arr, shortestSide, squareSize, this.boardSize[0], this.boardSize[1]);
		
		for(let o of squareDataArr) {
			const squareImageClampedUint8 = o.uint8;
			const coords = o.coords;
			const maxAttempts = 10;

			let minThreshold = 0; // Minimum possible threshold
			let maxThreshold = 1000; // Initial maximum threshold
			let foundThreshold = false;
			let attempts = 0;
			let attemptedCachedThreshold = false;

			if(fen.length > 0 && (fen.replaceAll('/', '').length) % this.boardSize[0] === 0) {
				fen += '/';
			}

			if(this.debug) {
				console.warn('--[BEGIN SQUARE ANALYSIS] --\n\n\nProcessing square image!', coords, 'Cached thresholds:', this.cachedThresholds);
				console.log(this.getUint8DataURL(squareImageClampedUint8, squareSize, squareSize));
			}

			// Process the single square image
			while(!foundThreshold) {
				let threshold;
				attempts++;

				if(!attemptedCachedThreshold && this.cachedThresholds[0] && this.cachedThresholds[1]) {
					threshold = this.cachedThresholds[1];

					attemptedCachedThreshold = true;
				} else {
					// Calculate the midpoint threshold
					threshold = Math.floor((minThreshold + maxThreshold) / 2);
				}

				if(this.debug) {
					console.warn('Attempting edge detection with threshold', threshold);
				}
				
				const edges = this.edgeDetection(squareImageClampedUint8, threshold, squareSize);

				if(this.debug) {
					console.warn('Edges filter (1D uint8, non RGB):\n', this.getUint8DataURL(edges, squareSize, squareSize));
				}

				// Stop execution if no edges found, this assumes an image with a piece would have at least some edges regardless of the threshold
				if(threshold <= 100 && !edges) {
					if(this.debug) {
						console.warn('No edges found, cancelling!', '\n-- [END SQUARE ANALYSIS] --\n\n\n');
					}

					fen += '1';

					break;
				}

				const points = this.houghCircleDetection(edges, squareSize);

				if(attempts > 25 || threshold <= 300 && points.length === 0) {
					if(this.debug) {
						console.warn('Failed to find enough points!', '\n-- [END SQUARE ANALYSIS] --\n\n\n');
					}

					fen += '1';

					break;
				}

				if(this.debug) {
					console.warn('Points which were found on the edges', points);
				}

				if(points.length > this.wantedMaxPoints) {
					minThreshold = threshold + 1;
				}

				// The correct threshold was found, process points and identify chess piece
				else if(points.length > this.wantedMinPoints) {
					foundThreshold = true;

					this.cachedThresholds[1] = this.cachedThresholds[0];
					this.cachedThresholds[0] = threshold;

					if(this.debug) {
						console.warn('Threshold', threshold, 'worked! Identifying chess piece and color');
					}

					const rawHullPoints = this.getConvexHull(points); // Filters only tens of points from hundreds
					const hullPoints = this.normalizePointsToUnitSquare(rawHullPoints); // Normalizes points for similarity analysis
					const pieceFen = this.identifyChessPiece(hullPoints);
					const pieceColor = this.getPieceColorFromConvexHull(squareImageClampedUint8, rawHullPoints, squareSize);

					if(this.debug) {
						console.warn('Detected piece:', pieceFen, 'with the color: ', pieceColor, '\nHull points:', hullPoints, '\n-- [END SQUARE ANALYSIS] --\n\n\n');
					}

					if(pieceColor === 'w')
						fen += pieceFen.toUpperCase();
					else
						fen += pieceFen;

					attemptAmountArr.push(attempts);

					break;
				}
				
				else {
					maxThreshold = threshold - 1;
				}
			}
		}

		fen = this.squeezeEmptySquares(fen);

		if(this.debug) {
			console.warn('-- [Board layout analysis completed] --\n-> Average attempts (lower better):', this.getArrayAverage(attemptAmountArr).toFixed(1) , '\n-> Returning fen:', fen);
		}

		return fen; // + ' w KQkq - 0 1';
	}
}