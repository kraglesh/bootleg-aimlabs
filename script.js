const gameCanvas = document.getElementById("gameCanvas");
const enterGameButton = document.getElementById("enterGame");
const enterGameDiv = document.getElementById("enterGameDiv");
const easyCheckbox = document.getElementById("easyCheckbox");
const mediumCheckbox = document.getElementById("mediumCheckbox");
const hardCheckbox = document.getElementById("hardCheckbox");
const scoreDisplay = document.getElementById("scoreDisplay");
const resultsDisplayDiv = document.getElementById("resultsDisplayDiv");
const resultsDisplay = document.getElementById("resultsDisplay");
const ctx = gameCanvas.getContext("2d");

let inGame = false;

let mouseX = 0;
let mouseY = 0;
let screenWidth = 0;
let screenHeight = 0;
let delta = 0;
lastUpdate = 0;
let pixelDensity = 1; //useNative ? (window.devicePixelRatio || 1) : 1;

let misses = [];
let score = 0;
let selectedDifficulty;
let difficulties = ["easy", "medium", "hard"];
let currentDifficulty;
let time = 0;
let sizes = [];
let objects = [];

let gameTypes = ["static", "strafe"]; //interpolate strafe later

const config = {
    headScoreMulti: 1.5,
    bodyScoreMulti: 1,
    armScoreMulti: 0.8,
    legScoreMulti: 0.5,
};

let averageMissDistances = {
    head: [],
    body: [],
    legs: [],
};

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

gameCanvas.addEventListener("mousemove", (e) => {
    e.preventDefault();
    e.stopPropagation();
    mouseX = e.clientX;
    mouseY = e.clientY;
});

gameCanvas.addEventListener("mousedown", (e) => {
    clicked();
});

function renderCircle(x, y, scale, dontStroke, dontFill) {
    ctx.beginPath();
    ctx.arc(x, y, scale, 0, 2 * Math.PI);
    if (!dontFill) ctx.fill();
    if (!dontStroke) ctx.stroke();
}

function renderRotatedRect(x, y, width, height, angle) {
    ctx.save(); // Save the current state
    ctx.translate(x, y); // Move to the arm's top-left position
    ctx.rotate(angle); // Rotate the canvas by the specified angle
    ctx.fillRect(0, 0, width, height); // Draw the rectangle
    ctx.restore(); // Restore the canvas to its original state
}

function renderRect(x, y, w, h, stroke) {
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    if (!stroke) ctx.strokeRect(x - w / 2, y - h / 2, w, h);
}

function isPointInRect(x, y, rectX, rectY, rectW, rectH) {
    return x >= rectX && x <= rectX + rectW && y >= rectY && y <= rectY + rectH;
}

function isPointInRotatedRect(mouseX, mouseY, rectX, rectY, rectW, rectH, angle) {
    // Translate mouse point back to origin
    const cosAngle = Math.cos(-angle);
    const sinAngle = Math.sin(-angle);

    const translatedX = cosAngle * (mouseX - rectX) - sinAngle * (mouseY - rectY) + rectX;
    const translatedY = sinAngle * (mouseX - rectX) + cosAngle * (mouseY - rectY) + rectY;

    // Check if the translated point is inside the unrotated rectangle
    return isPointInRect(translatedX, translatedY, rectX, rectY, rectW, rectH);
}

function detectHit(obj, mouseX, mouseY) {
    const armAngle = Math.PI / 4; // Same angle used when rendering arms

    // Head detection (circular)
    if (Math.sqrt((obj.head.x - mouseX) ** 2 + (obj.head.y - mouseY) ** 2) <= obj.head.scale) {
        return "head";
    }

    // Body (torso) detection (rectangular)
    if (isPointInRect(mouseX, mouseY, obj.body.x, obj.body.y, obj.body.w, obj.body.h)) {
        return "body";
    }

    // Left leg detection (rectangular)
    if (isPointInRect(mouseX, mouseY, obj.leg.left.x, obj.leg.left.y, obj.leg.left.w, obj.leg.left.h)) {
        return "left leg";
    }

    // Right leg detection (rectangular)
    if (isPointInRect(mouseX, mouseY, obj.leg.right.x, obj.leg.right.y, obj.leg.right.w, obj.leg.right.h)) {
        return "right leg";
    }

    // Left arm detection (rotated rectangle)
    if (isPointInRotatedRect(mouseX, mouseY, obj.arm.left.x, obj.arm.left.y, obj.arm.left.w, obj.arm.left.h, -armAngle)) {
        return "left arm";
    }

    // Right arm detection (rotated rectangle)
    if (isPointInRotatedRect(mouseX, mouseY, obj.arm.right.x, obj.arm.right.y, obj.arm.right.w, obj.arm.right.h, armAngle)) {
        return "right arm";
    }

    return null; // No hit
}

function clicked() {
    currentDifficulty.shots++
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];

        if (obj.dead) continue;

        const hitArea = detectHit(obj, mouseX, mouseY);

        if (hitArea) {
            misses.length = 0;
            obj.dead = true;

            // Award points based on hit area
            let pointsMultiplier = config.headScoreMulti; // Default for head
            if (hitArea === "body") pointsMultiplier = config.bodyScoreMulti; // Adjust multiplier for body
            else if (hitArea.includes("leg")) pointsMultiplier = config.legScoreMulti; // Adjust multiplier for legs
            else if (hitArea.includes("arm")) pointsMultiplier = config.armScoreMulti; // Adjust multiplier for arms

            currentDifficulty.points += Math.max(15, currentDifficulty.spawnRate + (obj.spawned - Date.now())) * pointsMultiplier;
            currentDifficulty.hits++; // Track hits
            currentDifficulty.lastObject = Date.now();

            if (currentDifficulty.spawned >= 30) {
                console.log()
                
                endGame();
            }

            break; // Stop checking further objects once a hit is detected
        } else misses.push({x: mouseX, y: mouseY})
    }
}
// GAME:

function enterGame() {
    misses.length = 0;
    enterGameDiv.style.visibility = "hidden";
    resultsDisplayDiv.style.visibility = "hidden";
    gameCanvas.style.visibility = "visible";

    currentDifficulty = {
        height: (difficulties.findIndex((e) => e == selectedDifficulty) + 1) * 100,
        spawnRate: [1000, 850, 650][difficulties.findIndex((e) => e == selectedDifficulty)],
        lastObject: Date.now(),
        spawned: 0,
        points: 0,
        shots: 0,
        hits: 0,
    };
    inGame = true;
}

function endGame() {
    inGame = false;

    resultsDisplay.innerHTML = `
Points: ${currentDifficulty.points}\n
Accuracy: ${Math.round((currentDifficulty.hits / currentDifficulty.shots) * 100)}%`;

    gameCanvas.style.visibility = "hidden";
    enterGameDiv.style.visibility = "visible";
    resultsDisplayDiv.style.visibility = "visible";
}

async function updateGame() {
    if (inGame) {
        //game over text:

        // RENDER BACKGROUND:
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, screenWidth, screenHeight);

        // Draw difficulty grid:
        //ctx.lineWidth = 4;
        ctx.fillStyle = "#FFF"; //maybe make into an image
        ctx.fillRect(0, innerHeight / 2 - currentDifficulty.height, innerWidth, innerHeight / 2 + currentDifficulty.height, 1);

        ctx.fillStyle = "#000";
        ctx.fillRect(0, innerHeight / 2 + currentDifficulty.height, screenWidth, screenHeight);

        // RENDER OBJECTS:
        for (let i = 0, obj; i < objects.length; i++) {
            obj = objects[i];
            ctx.fillStyle = "purple";
            if (!obj.dead) {
                renderCircle(obj.head.x, obj.head.y, obj.head.scale, true); // Render head
                renderRect(obj.body.x, obj.body.y, obj.body.w, obj.body.h, 1); // Render body

                // Render legs (two legs for each object)
                renderRect(obj.leg.left.x, obj.leg.left.y, obj.leg.left.w, obj.leg.left.h, 1); // Left leg
                renderRect(obj.leg.right.x, obj.leg.right.y, obj.leg.right.w, obj.leg.right.h, 1); // Right leg

                const armAngle = -Math.PI / 4; // 30 degrees in radians (adjust as needed for desired diagonal)

                // Left arm: negative angle for downward-left diagonal
                renderRotatedRect(obj.arm.left.x, obj.arm.left.y, obj.arm.left.w, obj.arm.left.h, -armAngle);

                // Right arm: positive angle for downward-right diagonal
                renderRotatedRect(obj.arm.right.x, obj.arm.right.y, obj.arm.right.w, obj.arm.right.h, armAngle);
            }
        }

        if (Date.now() - currentDifficulty.lastObject >= currentDifficulty.spawnRate && currentDifficulty.spawned < 30 && (!objects.length || objects[objects.length - 1].dead)) {
            // Random head position
            let headPos = {
                x: randInt(0, innerWidth),
                y: randInt(innerHeight / 2 - currentDifficulty.height, innerHeight / 2 + currentDifficulty.height),
            };

            let obj = {
                dead: false,
                strafe: false,
                spawned: Date.now(),
                head: {
                    x: headPos.x,
                    y: headPos.y,
                    scale: 11 / 2, // Adjust scale for distance later
                },
                body: {
                    x: headPos.x, // Starting x position
                    y: headPos.y + 17,
                    h: 22,
                    w: 11,
                },
                leg: {
                    left: {
                        x: headPos.x - 3, // Slightly left of the body
                        y: headPos.y + 32, // Position legs below the body
                        w: 5,
                        h: 28, // Leg height
                    },
                    right: {
                        x: headPos.x + 3, // Slightly right of the body
                        y: headPos.y + 32,
                        w: 5,
                        h: 28,
                    },
                },
                arm: {
                    left: {
                        x: headPos.x - 7, // Slightly left of the body
                        y: headPos.y + 6, // Position arms near the top of the body
                        w: 4,
                        h: 19.4, // Arm height
                    },
                    right: {
                        x: headPos.x + 4, // Slightly right of the body
                        y: headPos.y + 9,
                        w: 4,
                        h: 19.4,
                    },
                },
            };

            objects.push(obj);
            currentDifficulty.spawned++;
        } //maybe add remove when u miss the hit time

        // RENDER MISSES:

        for (let i = 0; i < misses.length; i++) {
            ctx.fillStyle = "red";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText("x", misses[i].x, misses[i].y);
            //renderCircle(misses[i].x, misses[i].y, 5, false); //switch to "x"
        }
    }
}

enterGameButton.onclick = enterGame;

window.addEventListener("resize", resize());

function resize() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    var scaleFillNative = 1;
    gameCanvas.width = screenWidth * pixelDensity;
    gameCanvas.height = screenHeight * pixelDensity;
    gameCanvas.style.width = screenWidth + "px";
    gameCanvas.style.height = screenHeight + "px";
    console.log(window.innerHeight, window.innerWidth);
    ctx.setTransform(scaleFillNative, 0, 0, scaleFillNative, (screenWidth * pixelDensity - screenWidth * scaleFillNative) / 2, (screenHeight * pixelDensity - screenHeight * scaleFillNative) / 2);
}

window.requestAnimFrame = (function () {
    return (
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        }
    );
})();

function doUpdate() {
    selectedDifficulty = document.getElementById("diff").value;
    scoreDisplay.innerHTML = inGame ? currentDifficulty.points : 0;
    delta = Date.now() - lastUpdate;
    lastUpdate = Date.now();
    updateGame();
    requestAnimFrame(doUpdate);
}

doUpdate();
