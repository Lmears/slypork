import { Vector } from './vector.js';

/**
 * SpatialGrid - A 2D spatial partitioning grid for efficient neighbor queries.
 * Uses toroidal (wrapping) topology for seamless edge behavior.
 */
export class SpatialGrid {
    constructor(canvasWidth, canvasHeight, cellSize) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.cellSize = cellSize;
        this.resize(canvasWidth, canvasHeight);
    }

    _initializeGrid() {
        this.grid = [];
        this.numRows = Math.max(1, Math.ceil(this.canvasHeight / this.cellSize));
        this.numCols = Math.max(1, Math.ceil(this.canvasWidth / this.cellSize));
        for (let i = 0; i < this.numRows; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.numCols; j++) {
                this.grid[i][j] = [];
            }
        }
    }

    resize(newWidth, newHeight) {
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        this._initializeGrid();
    }

    clear() {
        for (let i = 0; i < this.numRows; i++) {
            for (let j = 0; j < this.numCols; j++) {
                this.grid[i][j].length = 0;
            }
        }
    }

    _getCellCoords(position) {
        const col = Math.floor(position.x / this.cellSize);
        const row = Math.floor(position.y / this.cellSize);
        return { col, row };
    }

    // --- GENERIC ADD METHODS ---

    /**
     * Adds an object with a .position property (like a Boid) to a single cell.
     * @param {object} item - The item to add, must have a .position {x, y} property.
     */
    addItemAtPoint(item) {
        const { col, row } = this._getCellCoords(item.position);
        if (row >= 0 && row < this.numRows && col >= 0 && col < this.numCols) {
            this.grid[row][col].push(item);
        }
    }

    /**
     * Adds an object to all grid cells it overlaps.
     * @param {object} item - The item to add.
     * @param {object} bounds - An object with { left, top, right, bottom } properties.
     */
    addItemInArea(item, bounds) {
        const startCol = Math.floor(bounds.left / this.cellSize);
        const endCol = Math.floor(bounds.right / this.cellSize);
        const startRow = Math.floor(bounds.top / this.cellSize);
        const endRow = Math.floor(bounds.bottom / this.cellSize);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (row >= 0 && row < this.numRows && col >= 0 && col < this.numCols) {
                    this.grid[row][col].push(item);
                }
            }
        }
    }

    // --- GENERIC QUERY METHOD ---

    /**
     * Retrieves all items from the 3x3 neighborhood of cells around a position.
     * Returns an array of items (with duplicates if an item is in multiple cells).
     * @param {object} position - The center point of the query, { x, y }.
     */
    getItemsInNeighborhood(position) {
        const items = [];
        const { col: centerCol, row: centerRow } = this._getCellCoords(position);

        for (let rOffset = -1; rOffset <= 1; rOffset++) {
            for (let cOffset = -1; cOffset <= 1; cOffset++) {
                // Toroidal wrapping for seamless edges
                const neighborRow = (centerRow + rOffset + this.numRows) % this.numRows;
                const neighborCol = (centerCol + cOffset + this.numCols) % this.numCols;

                if (this.grid[neighborRow] && this.grid[neighborRow][neighborCol]) {
                    // This creates a shallow copy, which is fine.
                    // For performance, could also loop and push items one by one.
                    items.push(...this.grid[neighborRow][neighborCol]);
                }
            }
        }
        return items;
    }
}

// --- DEBUGGING VISUALIZATION FUNCTIONS ---

/**
 * Draws the spatial grid on the canvas for debugging purposes.
 * @param {SpatialGrid} gridInstance - The spatial grid to visualize.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {HTMLCanvasElement} canvas - The canvas element for dimensions.
 */
export function drawGridVisualization(gridInstance, ctx, canvas) {
    if (!gridInstance) return;
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= gridInstance.numCols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridInstance.cellSize, 0);
        ctx.lineTo(i * gridInstance.cellSize, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= gridInstance.numRows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridInstance.cellSize);
        ctx.lineTo(canvas.width, i * gridInstance.cellSize);
        ctx.stroke();
    }
}

/**
 * Draws the 3x3 neighborhood around a boid and shows neighbor connections.
 * @param {Boid} boid - The boid to visualize neighbors for.
 * @param {SpatialGrid} gridInstance - The spatial grid.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} cellSize - The cell size for distance checks.
 */
export function drawNeighborhoodVisualization(boid, gridInstance, ctx, cellSize) {
    if (!boid || !gridInstance) return;

    const { col: boidCol, row: boidRow } = gridInstance._getCellCoords(boid.position);

    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
    for (let rOffset = -1; rOffset <= 1; rOffset++) {
        for (let cOffset = -1; cOffset <= 1; cOffset++) {
            let neighborRow = boidRow + rOffset;
            let neighborCol = boidCol + cOffset;
            const actualRow = (neighborRow + gridInstance.numRows) % gridInstance.numRows;
            const actualCol = (neighborCol + gridInstance.numCols) % gridInstance.numCols;
            ctx.fillRect(actualCol * gridInstance.cellSize, actualRow * gridInstance.cellSize, gridInstance.cellSize, gridInstance.cellSize);
        }
    }

    const localNeighbors = gridInstance.getItemsInNeighborhood(boid.position);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (const other of localNeighbors) {
        if (other === boid) continue;
        const distanceToOther = Vector.dist(boid.position, other.position);
        if (distanceToOther <= cellSize) {
            ctx.beginPath();
            ctx.moveTo(boid.position.x, boid.position.y);
            ctx.lineTo(other.position.x, other.position.y);
            ctx.stroke();
        }
    }
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, boid.renderSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Updates spatial grid cell size and dimensions.
 * Used when starting simulation or when parameters change.
 * @param {SpatialGrid} spatialGrid - The spatial grid instance to update
 * @param {Object} canvas - The canvas element
 * @param {Function} calculateCellSize - Function that returns the new cell size
 */
export function updateSpatialGridParameters(spatialGrid, canvas, calculateCellSize) {
    const newCellSize = calculateCellSize();

    if (spatialGrid) {
        spatialGrid.cellSize = newCellSize;
        spatialGrid.resize(canvas.width, canvas.height);
    }
}

