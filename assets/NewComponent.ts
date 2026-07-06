import { _decorator, Component, Graphics, UITransform, EventKeyboard, KeyCode, Color, Vec3, Label, Node, input, Input } from 'cc';

const { ccclass } = _decorator;

type PieceShape = number[][];

@ccclass('NewComponent')
export class NewComponent extends Component {
    private readonly boardWidth = 10;
    private readonly boardHeight = 20;
    private readonly cellSize = 30;

    private board: Array<Array<number | null>> = [];
    private currentPiece: PieceShape | null = null;
    private nextPiece: PieceShape | null = null;
    private currentX = 0;
    private currentY = 0;
    private currentColor = 0;
    private nextColor = 0;
    private elapsed = 0;
    private dropInterval = 0.5;
    private score = 0;
    private lines = 0;
    private level = 1;
    private isGameOver = false;
    private isPaused = false;
    private initialized = false;
    private graphics: Graphics | null = null;
    private nextGraphics: Graphics | null = null;
    private scoreLabel: Label | null = null;
    private gameOverNode: Node | null = null;

    private readonly pieceColors = [
        new Color(0, 240, 240, 255),
        new Color(240, 240, 0, 255),
        new Color(160, 0, 240, 255),
        new Color(0, 240, 0, 255),
        new Color(240, 0, 0, 255),
        new Color(0, 0, 240, 255),
        new Color(240, 160, 0, 255),
    ];

    private readonly shapes: PieceShape[] = [
        [[1, 1, 1, 1]],
        [[1, 1], [1, 1]],
        [[0, 1, 0], [1, 1, 1]],
        [[1, 0, 0], [1, 1, 1]],
        [[0, 0, 1], [1, 1, 1]],
        [[1, 1, 0], [0, 1, 1]],
        [[0, 1, 1], [1, 1, 0]],
    ];

    onLoad() {
        try {
            if (!this.node.parent) return;
            this.createUI();
            this.initBoard();
            this.startGame();
            this.initialized = true;
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            if (typeof window !== 'undefined') {
                const canvas = window.document?.querySelector('canvas');
                if (canvas) { canvas.setAttribute('tabindex', '0'); canvas.focus(); }
            }
        } catch (e: any) {
            const dn = new Node('Error');
            this.node.addChild(dn);
            const dl = dn.addComponent(Label);
            dl.string = 'ERR: ' + (e.message || String(e));
            dl.fontSize = 20;
            dl.lineHeight = 28;
            dl.color = new Color(255, 0, 0, 255);
            dn.setPosition(0, 0, 0);
        }
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private createUI() {
        const boardNode = new Node('Board');
        this.node.addChild(boardNode);
        let bt = boardNode.getComponent(UITransform);
        if (!bt) bt = boardNode.addComponent(UITransform);
        bt.setContentSize(this.boardWidth * this.cellSize, this.boardHeight * this.cellSize);
        this.graphics = boardNode.addComponent(Graphics);
        boardNode.setPosition(-140, 0, 0);

        const nextNode = new Node('NextPiece');
        this.node.addChild(nextNode);
        this.nextGraphics = nextNode.addComponent(Graphics);
        nextNode.setPosition(200, 120, 0);

        const labelNode = new Node('ScoreLabel');
        this.node.addChild(labelNode);
        this.scoreLabel = labelNode.addComponent(Label);
        this.scoreLabel.string = 'Score: 0  Lines: 0  Level: 1';
        this.scoreLabel.fontSize = 20;
        this.scoreLabel.lineHeight = 28;
        labelNode.setPosition(200, 0, 0);

        const goNode = new Node('GameOver');
        this.node.addChild(goNode);
        const gl = goNode.addComponent(Label);
        gl.string = 'GAME OVER\nPress R to restart';
        gl.fontSize = 32;
        gl.lineHeight = 48;
        gl.color = new Color(255, 80, 80, 255);
        goNode.setPosition(0, 0, 0);
        goNode.active = false;
        this.gameOverNode = goNode;

        const hintNode = new Node('KeyHints');
        this.node.addChild(hintNode);
        const hl = hintNode.addComponent(Label);
        hl.string = '← → Move    ↑ Rotate    ↓ Soft Drop    Space Hard Drop    P Pause    R Restart';
        hl.fontSize = 14;
        hl.lineHeight = 20;
        hl.color = new Color(180, 180, 180, 255);
        hintNode.setPosition(200, -280, 0);
    }

    update(dt: number) {
        if (!this.initialized || this.isGameOver || this.isPaused || !this.currentPiece) return;

        this.elapsed += dt;
        if (this.elapsed >= this.dropInterval) {
            this.elapsed = 0;
            if (!this.tryMove(0, -1)) {
                this.lockPiece();
                this.clearLines();
                this.spawnPiece();
            }
        }

        this.drawAll();
    }

    private startGame() {
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = 0.5;
        this.isGameOver = false;
        this.isPaused = false;
        this.initBoard();
        this.nextPiece = this.randomPiece();
        this.nextColor = Math.floor(Math.random() * this.shapes.length);
        this.spawnPiece();
        if (this.gameOverNode) this.gameOverNode.active = false;
        this.drawAll();
    }

    private initBoard() {
        this.board = Array.from({ length: this.boardHeight }, () => Array(this.boardWidth).fill(null));
    }

    private randomPiece(): PieceShape {
        const index = Math.floor(Math.random() * this.shapes.length);
        return this.shapes[index].map((row) => [...row]);
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.KEY_R) {
            this.startGame();
            return;
        }

        if (event.keyCode === KeyCode.KEY_P) {
            this.isPaused = !this.isPaused;
            this.drawAll();
            return;
        }

        if (this.isGameOver || this.isPaused || !this.currentPiece) return;

        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
                this.tryMove(-1, 0);
                break;
            case KeyCode.ARROW_RIGHT:
                this.tryMove(1, 0);
                break;
            case KeyCode.ARROW_DOWN:
                if (this.tryMove(0, -1)) {
                    this.elapsed = 0;
                }
                break;
            case KeyCode.ARROW_UP:
                this.rotatePiece();
                break;
            case KeyCode.SPACE:
                while (this.tryMove(0, -1));
                this.lockPiece();
                this.clearLines();
                this.spawnPiece();
                break;
            default:
                break;
        }
        this.drawAll();
    }

    private tryMove(dx: number, dy: number): boolean {
        if (!this.currentPiece) return false;
        const nextX = this.currentX + dx;
        const nextY = this.currentY + dy;
        if (this.canPlace(this.currentPiece, nextX, nextY)) {
            this.currentX = nextX;
            this.currentY = nextY;
            return true;
        }
        return false;
    }

    private canPlace(shape: PieceShape, x: number, y: number): boolean {
        return shape.every((row, rowIndex) => row.every((cell, colIndex) => {
            if (cell === 0) return true;
            const boardX = x + colIndex;
            const boardY = y + rowIndex;
            if (boardX < 0 || boardX >= this.boardWidth || boardY < 0 || boardY >= this.boardHeight) return false;
            return this.board[boardY][boardX] === null;
        }));
    }

    private rotatePiece() {
        if (!this.currentPiece) return;
        const rotated = this.currentPiece[0].map((_, colIndex) =>
            this.currentPiece!.map((row) => row[colIndex]).reverse()
        );
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            if (this.canPlace(rotated, this.currentX + kick, this.currentY)) {
                this.currentPiece = rotated;
                this.currentX += kick;
                return;
            }
        }
    }

    private spawnPiece() {
        if (this.nextPiece) {
            this.currentPiece = this.nextPiece.map((row) => [...row]);
            this.currentColor = this.nextColor;
        } else {
            const index = Math.floor(Math.random() * this.shapes.length);
            this.currentPiece = this.shapes[index].map((row) => [...row]);
            this.currentColor = index;
        }
        this.nextPiece = this.randomPiece();
        this.nextColor = Math.floor(Math.random() * this.shapes.length);

        this.currentX = Math.floor((this.boardWidth - this.currentPiece[0].length) / 2);
        this.currentY = this.boardHeight - this.currentPiece.length;

        if (!this.canPlace(this.currentPiece, this.currentX, this.currentY)) {
            this.isGameOver = true;
            if (this.gameOverNode) this.gameOverNode.active = true;
        }
    }

    private lockPiece() {
        if (!this.currentPiece) return;
        this.currentPiece.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell === 0) return;
                const boardX = this.currentX + colIndex;
                const boardY = this.currentY + rowIndex;
                if (boardX >= 0 && boardX < this.boardWidth && boardY >= 0 && boardY < this.boardHeight) {
                    this.board[boardY][boardX] = this.currentColor;
                }
            });
        });
    }

    private clearLines() {
        let cleared = 0;
        for (let row = this.boardHeight - 1; row >= 0; row--) {
            if (this.board[row].every((cell) => cell !== null)) {
                this.board.splice(row, 1);
                this.board.push(Array(this.boardWidth).fill(null));
                cleared += 1;
                row += 1;
            }
        }

        if (cleared > 0) {
            this.lines += cleared;
            this.score += [0, 100, 300, 500, 800][cleared];
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(0.1, 0.5 - (this.level - 1) * 0.05);
        }
    }

    private drawAll() {
        this.drawBoard();
        this.drawNextPiece();
        this.updateScoreLabel();
    }

    private drawBoard() {
        const g = this.graphics;
        if (!g) return;
        g.clear();

        const bw = this.boardWidth * this.cellSize;
        const bh = this.boardHeight * this.cellSize;
        const ox = -bw / 2;
        const oy = -bh / 2;

        g.lineWidth = 2;
        g.strokeColor = new Color(100, 100, 100, 255);
        g.fillColor = new Color(20, 20, 30, 255);
        g.rect(ox, oy, bw, bh);
        g.fill();
        g.stroke();

        for (let row = 0; row < this.boardHeight; row++) {
            for (let col = 0; col < this.boardWidth; col++) {
                const cell = this.board[row][col];
                if (cell !== null) {
                    this.drawCell(g, col, row, this.pieceColors[cell], ox, oy);
                }
            }
        }

        if (this.currentPiece && !this.isGameOver) {
            this.currentPiece.forEach((row, rowIndex) => {
                row.forEach((cell, colIndex) => {
                    if (cell === 0) return;
                    this.drawCell(g, this.currentX + colIndex, this.currentY + rowIndex, this.pieceColors[this.currentColor], ox, oy);
                });
            });
        }

        if (this.isPaused) {
            g.fillColor = new Color(0, 0, 0, 180);
            g.rect(ox, oy, bw, bh);
            g.fill();
        }
    }

    private drawCell(g: Graphics, x: number, y: number, color: Color, ox: number, oy: number) {
        const cx = ox + x * this.cellSize;
        const cy = oy + y * this.cellSize;
        const pad = 2;
        const s = this.cellSize - pad * 2;

        g.fillColor = color;
        g.rect(cx + pad, cy + pad, s, s);
        g.fill();

        g.strokeColor = new Color(255, 255, 255, 60);
        g.lineWidth = 1;
        g.rect(cx + pad, cy + pad, s, s);
        g.stroke();
    }

    private drawNextPiece() {
        const g = this.nextGraphics;
        if (!g || !this.nextPiece) return;
        g.clear();

        g.fillColor = new Color(20, 20, 30, 255);
        g.rect(-60, -60, 120, 120);
        g.fill();

        const rows = this.nextPiece.length;
        const cols = this.nextPiece[0].length;
        const previewCellSize = 24;
        const pw = cols * previewCellSize;
        const ph = rows * previewCellSize;
        const pox = -pw / 2;
        const poy = -ph / 2;

        this.nextPiece.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell === 0) return;
                const cx = pox + colIndex * previewCellSize;
                const cy = poy + rowIndex * previewCellSize;
                const pad = 1;
                const s = previewCellSize - pad * 2;
                g.fillColor = this.pieceColors[this.nextColor];
                g.rect(cx + pad, cy + pad, s, s);
                g.fill();
            });
        });
    }

    private updateScoreLabel() {
        if (!this.scoreLabel) return;
        this.scoreLabel.string = `Score: ${this.score}  Lines: ${this.lines}  Level: ${this.level}`;
    }
}
