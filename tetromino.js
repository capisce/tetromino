<!-- hide script from old browsers

/*
   Copyright (c) 2013 Samuel Rødal
  
   Permission is hereby granted, free of charge, to any person obtaining a
   copy of this software and associated documentation files (the "Software"),
   to deal in the Software without restriction, including without limitation
   the rights to use, copy, modify, merge, publish, distribute, sublicense,
   and/or sell copies of the Software, and to permit persons to whom the
   Software is furnished to do so, subject to the following conditions:
  
   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.
  
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
   DEALINGS IN THE SOFTWARE.
*/

var gameStateChanged = false;
var canvas;
var context;

var gameState = null;

var mainloop = function() {
    gameState.simulate();
}

var GAME_COLS = 10;
var GAME_ROWS = 20;

var tetrominoColors = [ '#0ff', '#f00', '#0f0', '#ff0', '#f0f', '#00f', '#f50' ];

var randomInRange = function(a, b)
{
    return a + Math.floor(Math.random() * (b - a + 1));
}

var gameInterval = function(level) {
    var lower = 25;
    var upper = 400;
    return lower + (upper - lower) * Math.exp(-level * 0.075);
}

var Block = function(type) {
    this.type = type;
}

var map = function(array, func) {
    var result = [];
    for (var i = 0, len = array.length; i < len; ++i) {
        result.push(func(array[i]));
    }
    return result;
}

var forEach = function(array, func) {
    for (var i = 0, len = array.length; i < len; ++i) {
        func(array[i]);
    }
}

var id = function(val) {
    return val;
}

var any = function(array, func) {
    for (var i = 0, len = array.length; i < len; ++i) {
        if (func(array[i]))
            return true;
    }
    return false;
}

var all = function(array, func) {
    return !any(array, function(val) { return !func(val); });
}

var comparePoints = function(a, b) {
    if (a[0] < b[0])
        return -1;
    if (a[0] > b[0])
        return 1;
    if (a[1] < b[1])
        return -1;
    if (a[1] > b[1])
        return 1;
    return 0;
}

var subtract = function(a, b) {
    var result = [];

    var alen = a.length;
    var blen = b.length;

    var i = 0;
    var j = 0;
    var delta;
    for (; i < alen; ++i) {
        if (j < blen) {
            while (true) {
                delta = comparePoints(a[i], b[j]);
                if (delta <= 0) // a[i] <= b[j]
                    break;
                ++j;
                if (j == blen)
                    break;
            }
            if (delta != 0)
                result.push(a[i]);
        } else {
            result.push(a[i]);
        }
    }

    return result;
}

var Timer = function() {
    this.current = (new Date).getTime();
    
    this.delta = function() {
        var current = (new Date).getTime();
        var delta = current - this.current;
        this.current = current;
        return delta;
    }
}

var rotate90 = function(tetromino, center) {
    return map(tetromino, function(pos) {
        if (center === undefined)
            center = [ 0, 0 ];
        return [ (pos[1] - center[1]) + center[1], -(pos[0] - center[0]) + center[1] ];
    });
}

var rotate180 = function(tetromino, center) {
    return rotate90(rotate90(tetromino, center), center);
}

var rotate270 = function(tetromino) {
    return rotate90(rotate180(tetromino, center), center);
}

var Tetromino = function(type) {
    this.type = type;
    this.rotation = 0;

    this.x = (GAME_COLS / 2) - 1;
    this.y = -2;

    var canonicalForm;

    var generateRotations = function(coords, center) {
        var result = [];
        result.push(coords);
        var last = coords;
        for (var i = 0; i < 3; ++i) {
            last = rotate90(last, center);
            result.push(last);
        }
        return result;
    }

    switch (type) {
    case 0:
        this.rotations = generateRotations([[-1, 0], [0, 0], [1, 0], [2, 0]], [ 0.5, 0.5 ]);
        break;
    case 1:
        this.rotations = generateRotations([[-1, -1], [0, -1], [0, 0], [1, 0]]);
        break;
    case 2:
        this.rotations =  generateRotations([[-1, 0], [0, 0], [0, -1], [1, -1]]);
        break;
    case 3:
        this.rotations = [[[0, 0], [0, 1], [1, 0], [1, 1]]];
        break;
    case 4:
        this.rotations = generateRotations([[0, 0], [-1, 0], [1, 0], [0, -1]]);
        break;
    case 5:
        this.rotations = generateRotations([[-1, -1], [-1, 0], [0, 0], [1, 0]]);
        break;
    case 6:
        this.rotations = generateRotations([[-1, 0], [0, 0], [1, 0], [1, -1]]);
        break;
    }

    for (var i = 0, len = this.rotations.length; i < len; ++i) {
        this.rotations[i].sort(comparePoints);
    }

    this.coords = function() {
        var delta_x = this.x;
        var delta_y = this.y;
        var result = map(this.rotations[this.rotation],
            function(pos) { return [ pos[0] + delta_x, pos[1] + delta_y ]; });
        return result;
    }

    this.bounds = function() {
        var c = this.coords();
        var min = [ c[0][0], c[0][1] ];
        var max = [ c[0][0], c[0][1] ];

        forEach(c.slice(1),
            function(pos) {
                min = [ Math.min(min[0], pos[0]), Math.min(min[1], pos[1]) ];
                max = [ Math.max(max[0], pos[0]), Math.max(max[1], pos[1]) ];
            });
        return [ min, max ];
    }

    this.center = function() {
        var bounds = this.bounds();
        return [ Math.ceil((bounds[0][0] + bounds[1][0]) / 2),
                 Math.ceil((bounds[0][1] + bounds[1][1]) / 2) ];
    }

    this.cloned = function() {
        var result = new Tetromino(this.type);
        result.x = this.x;
        result.y = this.y;
        result.rotation = this.rotation;
        return result;
    }

    this.rotated = function() {
        var result = this.cloned();
        result.rotation = this.rotation == 0 ? this.rotations.length - 1 : this.rotation - 1;
        return result;
    }

    this.translated = function(delta) {
        var result = this.cloned();
        result.x = this.x + delta[0];
        result.y = this.y + delta[1];
        return result;
    }
}

var swap = function(array, a, b) {
    var temp = array[a];
    array[a] = array[b];
    array[b] = temp;
}

var generate = function(count, func) {
    var result = [];
    for (var i = 0; i < count; ++i) {
        result.push(func());
    }
    return result;
}

var posRange = function(start, delta, count) {
    var result = [];
    var current = [ start[0], start[1] ];
    for (var i = 0; i < count; ++i) {
        result.push([ current[0], current[1] ]);
        current[0] += delta[0];
        current[1] += delta[1];
    }
    return result;
}

var randomize = function(array) {
    for (var i = 0, len = array.length; i < len; ++i) {
        var j = randomInRange(i, len - 1);
        swap(array, i, randomInRange(i, len - 1));
    }
}

var Bag = function() {
    this.draw = [];
    this.getNext = function() {
        if (this.draw.length == 0) {
            this.draw = [ 0, 1, 2, 3, 4, 5, 6 ];    
            randomize(this.draw);
        }
        return new Tetromino(this.draw.pop());
    }
}

var blockSize = 20;
var dx;
var dy = 0;
var debugText = null;

var lineClearedSound = null;

var loadLineClearedSound = function() {
    lineClearedSound = new Audio('linecleared.ogg');
}

var playLineClearedSound = function() {
    lineClearedSound.play();
    loadLineClearedSound();
}

var debugCounter = 1;

var updateDebugText = function(text) {
    context.font = '16px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    var x = dx + (GAME_COLS / 2) * blockSize + blockSize / 2;
    var y = dy + (GAME_ROWS + 1) * blockSize + blockSize / 2;

    if (debugText != null) {
        context.fillStyle = '#000';
        context.fillRect(x - canvas.width / 2, y - 10, canvas.width, 20);
    }

    context.fillStyle = '#fff';
    context.fillText(debugCounter + ": " + text, x, y);

    ++debugCounter;
    debugText = text;
}

var drawTextCenteredAtPos = function(text, pos) {
    var x = dx + pos[0] * blockSize + blockSize / 2;
    var y = dy + pos[1] * blockSize + blockSize / 2;

    context.font = '16px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.fillStyle = '#fff';
    context.fillText(text, x, y);
}

var NumberDisplay = function(pos, text, initialValue) {
    drawTextCenteredAtPos(text, pos);
    this.pos = [ pos[0], pos[1] + 1 ];
    this.update = function(value) {
        var x = dx + this.pos[0] * blockSize + blockSize / 2;
        var y = dy + this.pos[1] * blockSize + blockSize / 2;

        context.fillStyle = '#000';
        context.fillRect(x - 50, y - 10, 100, 20);

        drawTextCenteredAtPos(value, this.pos);
    }
    this.update(initialValue);
}

var fillAlpha = 0.5;

var fillPos = function(pos) {
    if (pos.y < 0)
        return;

    var oldFill = context.fillStyle;
    var oldAlpha = context.globalAlpha;

    var x = dx + pos[0] * blockSize;
    var y = dy + pos[1] * blockSize;

    context.fillRect(x, y, blockSize - 1, blockSize - 1);

    context.globalAlpha = fillAlpha;

    context.fillStyle = '#fff';
    context.fillRect(x, y, blockSize - 1, 1);
    context.fillRect(x, y, 1, blockSize - 1);

    context.fillStyle = '#000';
    context.fillRect(x, y + blockSize - 2, blockSize - 1, 1);
    context.fillRect(x + blockSize - 2, y, 1, blockSize - 1);

    context.fillStyle = oldFill;
    context.globalAlpha = oldAlpha;
}

var clearPos = function(pos) {
    if (pos.y < 0)
        return;
    context.fillRect(dx + pos[0] * blockSize, dy + pos[1] * blockSize, blockSize - 1, blockSize - 1);
}

var blitDroppedRows = function(from, downto, drops)
{
    if (downto == from)
        return;
    context.drawImage(canvas,
        dx, dy + blockSize * from, blockSize * GAME_COLS, blockSize * (downto - from),
        dx, dy + blockSize * (from + drops), blockSize * GAME_COLS, blockSize * (downto - from));
}

var GameState = function() {
    this.level = 0;
    this.cleared = 0;
    this.gameIntervalId = null;
    this.ghost = null;

    this.rows = GAME_ROWS;
    this.cols = GAME_COLS;
    this.softDrop = false;

    this.score = 0;

    this.timer = new Timer();

    this.emptyRow = new Array(this.cols);
    this.board = new Array(this.rows * this.cols);
    for (var i = 0, len = this.emptyRow.length; i < len; ++i)
        this.emptyRow[i] = false;
    for (var i = 0, len = this.board.length; i < len; ++i)
        this.board[i] = false;

    this.bag = new Bag();

    this.dropInterval = 0;
    this.timeUntilDrop = 0;

    this.updateDropInterval = function() {
        var interval = gameInterval(this.level);
        if (this.softDrop)
            interval = Math.min(interval, 60);
        this.timeUntilDrop = Math.min(this.timeUntilDrop, interval);
        this.dropInterval = interval;
    }

    this.bumpLevel = function() {
        this.level++;
        this.updateDropInterval();
        this.levelDisplay.update(this.level);
    }

    this.enableSoftDrop = function() {
        this.softDrop = true;
        this.updateDropInterval();
    }

    this.disableSoftDrop = function() {
        this.softDrop = false;
        this.updateDropInterval();
    }

    this.updateGhost = function(clear) {
        var ghost = null;
        for (var i = this.current; !this.blocked(i.coords()); i = i.translated([0, 1])) {
            ghost = i;
        }

        if (clear) {
            var toClear = this.ghost === null ? [] : subtract(this.ghost.coords(), this.current.coords());
            context.fillStyle = '#000';
            forEach (toClear, clearPos);
        }

        var toFill = subtract(ghost.coords(), this.current.coords());
        var oldFillAlpha = fillAlpha;

        context.fillStyle = '#323';
        fillAlpha = 0.2;
        forEach (toFill, fillPos);
        fillAlpha = oldFillAlpha;

        this.ghost = ghost;
    }

    this.replace = function(replacement) {
        var oldCoords = this.current.coords();
        var currentCoords = replacement.coords();

        var toClear = subtract(oldCoords, currentCoords);
        var toFill = subtract(currentCoords, oldCoords);

        context.fillStyle = '#000';
        forEach(toClear, clearPos);

        context.fillStyle = tetrominoColors[this.current.type];
        forEach(toFill, fillPos);

        this.current = replacement;
        this.updateGhost(true);
    }

    this.holdAvailable = true;
    this.held = null;

    this.running = true;
    this.paused = false;
    this.animationTime = 0;
    this.animationRows = [];
    this.animationDone = null;

    this.hold = function() {
        if (!this.running || !this.holdAvailable)
            return;

        context.fillStyle = '#000';
        forEach(this.current.coords(), clearPos);

        if (this.held == null) {
            this.held = new Tetromino(this.current.type);
            this.cycleBlocks();
        } else {
            context.fillStyle = '#000';
            forEach(this.held.coords(), clearPos);

            var temp = this.held;
            this.held = new Tetromino(this.current.type);
            this.current = new Tetromino(temp.type);
        }

        this.updateGhost(true);

        var dx = -4;
        var dy = 3;

        var bounds = this.held.bounds();
        var cx = (bounds[0][0] + bounds[1][0]) / 2;
        this.held = this.held.translated([ dx - cx, dy - bounds[0][1] ]);

        context.fillStyle = tetrominoColors[this.held.type];;
        forEach(this.held.coords(), fillPos);

        this.holdAvailable = false;

        this.glueTimer = 0;
        this.glueResets = GAME_COLS;
    }

    this.glue = function() {
        var board = this.board;
        var min = GAME_ROWS;
        var max = 0;
        forEach (this.current.coords(),
            function(pos) {
                max = Math.max(pos[1], max);
                min = Math.min(pos[1], min);
                if (pos[1] >= 0) board[pos[0] + pos[1] * GAME_COLS] = true;
            });

        if (max <= 0) {
            var pos = [ GAME_COLS / 2, GAME_ROWS / 2 ];
            var x = dx + pos[0] * blockSize + blockSize / 2;
            var y = dy + pos[1] * blockSize + blockSize / 2;

            context.fillStyle = '#000';
            context.fillRect(x - 50, y - 10, 100, 20);
             
            drawTextCenteredAtPos("Game over", pos);

            this.running = false;

            return;
        }

        var full = [];
        var i = 0;
        min = Math.max(min, 0);
        for (i = max; i >= min; --i) {
            if (all(board.slice(i * GAME_COLS, (i+1) * GAME_COLS), id))
                full.push(i);
        }

        if (full.length > 0) {
            playLineClearedSound();

            gameState.cleared += full.length;
            gameState.clearedDisplay.update(gameState.cleared);

            var level = 1 + Math.floor(gameState.cleared / 10);
            if (level > gameState.level)
                gameState.bumpLevel();

            gameState.score += [ 100, 300, 800, 2000 ][full.length - 1];
            gameState.scoreDisplay.update(gameState.score);

            this.animationTime = 320;
            this.animationRows = full;

            this.animationDone = function() {
                full.push(-1);

                var emptyRow = gameState.emptyRow;
                var above = [];
                var below = board.slice((full[0] + 1) * GAME_COLS);
                var toClear = [];
                for (i = 0, len = full.length - 1; i < len; ++i) {
                    var upper = full[i + 1] + 1;
                    var lower = full[i];
                    var drops = i + 1;
                    blitDroppedRows(upper, lower, drops);
                    above = above.concat(emptyRow);
                    below = board.slice(upper * GAME_COLS, lower * GAME_COLS).concat(below);
                    toClear = toClear.concat(posRange([0, i], [1, 0], GAME_COLS));
                }

                context.fillStyle = '#000';
                forEach(toClear, clearPos);

                gameState.board = above.concat(below);

                gameState.holdAvailable = true;
                gameState.cycleBlocks();
                gameState.updateGhost(false);
            }
        } else {
            gameState.holdAvailable = true;
            gameState.cycleBlocks();
            gameState.updateGhost(false);
        }
    }

    this.glueTimer = 0;
    this.glueTimerMax = 200;
    this.glueResets = 0;

    this.progressGameState = function() {
        var y = this.current.y;

        // no movement possible ?
        if (!this.doMove([0, 1])) {
            this.glueTimer = this.glueTimerMax;
        }
    }

    this.animationStage = 1;

    this.simulate = function() {
        if (!this.running)
            return;
        var delta = this.timer.delta();
        // Prevent animation sleeps from disrupting the gameplay;
        // this could happen when the browser is inactive and
        // disables animation.
        if (delta > 400)
            delta = 400;
        if (this.animationTime > 0) {
            this.animationTime -= delta;

            if (this.animationTime <= 0) {
                this.animationDone();
                this.animationStage = 1;
            } else {
                var i = Math.floor(this.animationTime / 80) % 2;
                if (i != this.animationStage) {
                    context.fillStyle = [ '#fff', '#000' ][i];
                    forEach (this.animationRows,
                        function(row) {
                            forEach(posRange([0, row], [1, 0], GAME_COLS), [ fillPos, clearPos ][i] );
                        });
                    this.animationStage = i;
                }
            }
        } else {
            if (this.moveTimer > 0) {
                this.moveTimer -= delta; 
            } else if (this.moveDir[0] != 0) {
                this.doMove(this.moveDir);
                this.moveTimer += 40;
            }
            if (this.glueTimer > 0 && !this.tryMove([0, 1])) {
                this.glueTimer -= delta;
                if (this.glueTimer <= 0) {
                    this.glue();
                }
            } else {
                this.timeUntilDrop -= delta;
                while (this.timeUntilDrop < 0) {
                    this.progressGameState();
                    this.timeUntilDrop += this.dropInterval;
                }
            }
        }
    }

    this.blocked = function(coords) {
        var board = this.board;
        return any(coords, 
                function(pos) {
                    return (pos[0] < 0 || pos[0] >= GAME_COLS || pos[1] >= GAME_ROWS);
                })
            || any(coords,
                function(pos) {
                    return pos[1] >= 0 && board[pos[0] + pos[1] * GAME_COLS];
                });
    }

    this.tryMove = function(dir) {
        var candidate = this.current.translated(dir);
        return !this.blocked(candidate.coords());
    }

    this.resetGlue = function() {
        if (this.glueTimer <= 0)
            return;
        // if we're now able to drop, reset the glue timer
        if (this.glueResets > 0 || this.tryMove([0, 1]))
        {
            this.glueTimer = 0;
            this.glueResets--;
        }
    }

    this.doMove = function(dir) {
        if (!this.running || this.animationTime > 0)
            return;
        var candidate = this.current.translated(dir);
        if (!this.blocked(candidate.coords())) {
            this.replace(candidate);
            this.resetGlue();
            return true;
        }
        return false;
    }

    this.moveDir = [ 0, 0 ];
    this.moveTimer = 0;

    this.move = function(dir) {
        this.doMove(dir);
        this.moveTimer = 150;
        this.moveDir = dir;
    }

    this.unmove = function(dir) {
        if (dir[0] == this.moveDir[0]) {
            this.moveTimer = 0;
            this.moveDir = [ 0, 0 ];
        }
    }

    this.rotate = function() {
        if (!this.running || this.animationTime > 0)
            return;
        var candidate = this.current.rotated();
        var result = null;
        if (this.blocked(candidate.coords())) {
            var deltas = [ [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0] ]; 
            for (var i = 0; i < 4; ++i) {
                var translated = candidate.translated(deltas[i]);
                if (!this.blocked(translated.coords())) {
                    result = translated;
                    break;
                }
            }
        } else {
            result = candidate;
        }

        if (result != null) {
            this.replace(result);
            this.resetGlue();
            return true;
        }

        return false;
    }

    this.drop = function() {
        if (!this.running || this.animationTime > 0)
            return;
        while (this.doMove([0, 1])) ;
        this.glue();
    }

    this.cycleBlocks = function() {
        var bag = this.bag;
        var dx = GAME_COLS + 3;
        var dy = 3;

        var fillPending = function(pending, fillFunc) {
            var index = 0;
            forEach (pending,
                function(tetromino) {
                    var t = tetromino;
                    var bounds = t.bounds();
                    var cx = (bounds[0][0] + bounds[1][0]) / 2;
                    t = t.translated([ dx - cx, dy - bounds[0][1] + index * 4 ]);
                    fillFunc(t);
                    ++index;
                });
        }


        if (this.pending == null) {
            this.pending = generate(4, function() { return bag.getNext(); }); 
        } else {
            context.fillStyle = '#000';
            fillPending(this.pending, function(t) { forEach(t.coords(), clearPos); });
        }

        this.glueTimer = 0;
        this.glueResets = GAME_COLS;
        this.current = this.pending.shift();
        this.pending.push(bag.getNext());

        fillPending(this.pending, function(t) { context.fillStyle = tetrominoColors[t.type]; forEach(t.coords(), fillPos); });
    }

    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#fff';
    forEach(posRange([-1, 0], [0, 1], GAME_ROWS), fillPos);
    forEach(posRange([GAME_COLS, 0], [0, 1], GAME_ROWS), fillPos);
    forEach(posRange([-1, GAME_ROWS], [1, 0], GAME_COLS + 2), fillPos);

    this.current = null;
    this.pending = null;

    drawTextCenteredAtPos("Held:", [ -4, 1 ]);
    drawTextCenteredAtPos("Next:", [ GAME_COLS + 3, 1 ]);

    this.scoreDisplay = new NumberDisplay([ -4, 6 ], "Score:", 0);
    this.clearedDisplay = new NumberDisplay([ -4, 9 ], "Cleared:", 0);
    this.levelDisplay = new NumberDisplay([ -4, 12 ], "Level:", 1);

    this.bumpLevel();
    this.cycleBlocks();
    this.updateGhost(false);
}

window.addEventListener('load', function () {
    canvas = $('canvas').get(0);
    if (!canvas || !canvas.getContext)
        return;

    context = canvas.getContext('2d');
    if (!context)
        return;

    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;

    var animFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        null;

    dx = canvas.width / 2 - blockSize * GAME_COLS / 2;

    gameState = new GameState();
    loadLineClearedSound();

    if (animFrame !== null) {
        // this doesn't work any more, why not?
        if ( false && $.browser.mozilla ) {
            var recursiveAnim = function() {
                mainloop();
                animFrame();
            }

            // setup for multiple calls
            window.addEventListener("MozBeforePaint", recursiveAnim, false);

            // start the mainloop
            animFrame();
        } else {
            var recursiveAnim = function() {
                mainloop();
                animFrame(recursiveAnim, canvas);
            }

            // start the mainloop
            animFrame(recursiveAnim, canvas);
        }
    } else {
        var interval_60hz = 1000 / 60.0 ;
        setInterval(mainloop, interval_60hz);
    }
}, false);

function handleKeyDown(event) {
    switch (event.keyCode) {
    case 37: // left
        gameState.move([-1, 0]);
        break;
    case 38: // up
        gameState.rotate();
        break;
    case 39: // right
        gameState.move([1, 0]);
        break;
    case 40: // down
        gameState.enableSoftDrop();
        break;
    case 32: // space
        if (!gameState.running && !gameState.paused)
            gameState = new GameState();
        else
            gameState.drop();
        break;
    case 80: // p
        gameState.paused = !gameState.paused;
        gameState.running = !gameState.paused;
        break;
    case 16: // hold
        gameState.hold();
        break;
    default:
        return true;
    }

    event.cancelBubble = true;
    if (event.stopPropagation)
        event.stopPropagation();

    return false;
}

function handleKeyUp(event) {
    switch (event.keyCode) {
    case 37: // left
        gameState.unmove([-1, 0]);
        break;
    case 39: // right
        gameState.unmove([1, 0]);
        break;
    case 40: // down
        gameState.disableSoftDrop();
        break;
    default:
        return true;
    }

    event.cancelBubble = true;
    if (event.stopPropagation)
        event.stopPropagation();

    return false;
}

// end hiding script from old browsers -->
