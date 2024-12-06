const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "game-container",
  backgroundColor: "#000000", // Set background color for the non-game area
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: {
    preload,
    create,
    update,
  },
};

const game = new Phaser.Game(config);

let spaceship, cursors, asteroid, scoreText, alienShip, laser;
let score = 0;
let difficultyLevel = 6; // Start at level 4 for faster initial speed
let alienAppeared = false; // Tracks if the alien ship has appeared
let gameOver = false;
const asteroidImages = [
  "asteroid1",
  "asteroid2",
  "asteroid3",
  "asteroid4",
  "asteroid5",
];

function preload() {
  // Load assets
  this.load.image("background", "assets/background.png");
  this.load.image("spaceship", "assets/spaceship.png");
  this.load.image("alienShip", "assets/alienShip.png");

  // Load asteroid images
  asteroidImages.forEach((key, index) => {
    this.load.image(key, `assets/asteroid${index + 1}.png`);
  });
}

function create() {
  // Add background
  this.add.image(400, 300, "background").setDisplaySize(800, 600);

  // Add spaceship
  spaceship = this.physics.add.sprite(400, 550, "spaceship").setDisplaySize(50, 50);
  spaceship.setCollideWorldBounds(true);

  // Create initial asteroid
  asteroid = this.add.sprite(400, -50, Phaser.Math.RND.pick(asteroidImages)).setDisplaySize(40, 40);

  // Enable asteroid physics
  this.physics.add.existing(asteroid);
  asteroid.body.setCollideWorldBounds(false);

  // Create alien ship (hidden initially)
  alienShip = this.physics.add.sprite(400, -50, "alienShip").setDisplaySize(60, 40);
  alienShip.setVisible(false);
  alienShip.body.setCollideWorldBounds(false);

  // Create laser burst
  const graphics = this.add.graphics();
  graphics.fillStyle(0x00ff00, 1); // Bright green laser color
  graphics.fillRect(0, 0, 10, 10); // Create a small square laser
  graphics.generateTexture("laser", 10, 10);
  graphics.destroy(); // Remove graphics object
  laser = this.physics.add.sprite(-50, -50, "laser");
  laser.setDisplaySize(10, 10);
  laser.setVisible(false);
  laser.body.setCollideWorldBounds(false); // Prevent automatic removal
  laser.body.checkWorldBounds = true;
  laser.body.outOfBoundsKill = false;

  // Collision detection
  this.physics.add.overlap(spaceship, asteroid, handleCollision, null, this);
  this.physics.add.overlap(spaceship, laser, handleLaserCollision, null, this);

  // Setup keyboard input
  cursors = this.input.keyboard.createCursorKeys();

  // Display score
  scoreText = this.add.text(16, 16, `Score: ${score}`, {
    fontSize: "32px",
    fill: "#ffffff",
  });

  // Start asteroid falling
  startAsteroidTween.call(this);
}

function update() {
  if (gameOver) return;

  // Spaceship movement logic
  if (cursors.left.isDown) {
    spaceship.setVelocityX(-300);
  } else if (cursors.right.isDown) {
    spaceship.setVelocityX(300);
  } else {
    spaceship.setVelocityX(0);
  }
}

// Start the asteroid's falling tween with increasing difficulty
function startAsteroidTween() {
  const randomX = Phaser.Math.Clamp(Phaser.Math.Between(40, config.width - 40), 40, config.width - 40);
  const randomImage = Phaser.Math.RND.pick(asteroidImages);

  // Set asteroid properties
  asteroid.setTexture(randomImage);
  asteroid.setPosition(randomX, -50); // Start above the screen

  // Calculate falling speed based on difficulty
  const fallDuration = Phaser.Math.Clamp(4000 - difficultyLevel * 300, 1000, 4000); // Faster with difficulty
  const randomRotationSpeed = Phaser.Math.Between(-200, 200); // Random rotation speed

  // Ensure asteroid starts within visible bounds
  if (randomX < 40 || randomX > config.width - 40) {
    console.warn("Asteroid spawned off-screen. Resetting position.");
    asteroid.setX(Phaser.Math.Clamp(randomX, 40, config.width - 40));
  }

  // Create a tween to make the asteroid fall to the bottom
  this.tweens.add({
    targets: asteroid,
    y: config.height + 50, // Move beyond the screen bottom
    duration: fallDuration,
    ease: "Linear",
    onComplete: () => {
      if (!gameOver) {
        score++;
        scoreText.setText(`Score: ${score}`);

        // Increase difficulty every 5 asteroids avoided
        if (score % 5 === 0) {
          difficultyLevel++;
          console.log(`Difficulty increased! Level: ${difficultyLevel}`);
        }

        // Trigger alien spaceship after 10 asteroids avoided
        if (score === 10 && !alienAppeared) {
          summonAlienShip.call(this);
        }

        startAsteroidTween.call(this); // Restart the tween
      }
    },
  });

  // Create a tween to rotate the asteroid
  this.tweens.add({
    targets: asteroid,
    angle: randomRotationSpeed,
    duration: fallDuration, // Match the fall duration
    ease: "Linear",
    repeat: -1, // Rotate continuously
  });
}

// Summon alien spaceship and fire a laser
function summonAlienShip() {
  alienAppeared = true;

  // Position alien ship at the top of the screen
  alienShip.setPosition(400, -50); // Start centered at the top
  alienShip.setVisible(true);

  // Move alien ship to a fixed position
  this.tweens.add({
    targets: alienShip,
    y: 100, // Stop at this position
    duration: 1000,
    ease: "Linear",
    onComplete: () => {
      fireLaser.call(this); // Fire the first laser
      startLaserTimer.call(this); // Start continuous laser firing
      startAlienShipMovement.call(this); // Start alien ship horizontal movement
    },
  });
}

// Fire a laser aimed at the spaceship
function fireLaser() {
  const laserSpeed = 400 + (difficultyLevel * 100); // Increase speed with difficulty

  // Aim laser at the spaceship
  const angle = Phaser.Math.Angle.Between(alienShip.x, alienShip.y, spaceship.x, spaceship.y);
  laser.setPosition(alienShip.x, alienShip.y + 20); // Start below the alien ship
  laser.setAngle((angle * 180) / Math.PI); // Convert to degrees
  laser.setVisible(true);

  // Fire the laser
  this.physics.velocityFromRotation(angle, laserSpeed, laser.body.velocity);
}

// Start a timer to fire lasers at random intervals
function startLaserTimer() {
  this.time.addEvent({
    delay: Phaser.Math.Between(2000, 5000), // Random interval between 2-5 seconds
    callback: fireLaser,
    callbackScope: this,
    loop: true, // Keep firing indefinitely
  });
}

// Make the alien ship move horizontally
function startAlienShipMovement() {
  this.tweens.add({
    targets: alienShip,
    x: { from: alienShip.x - 100, to: alienShip.x + 100 }, // Oscillate 100px left and right
    duration: 2000,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1, // Loop indefinitely
  });
}

// Show game-over popup
function showGameOver() {
  const existingPopup = document.getElementById("game-over-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement("div");
  popup.id = "game-over-popup";
  popup.style.position = "absolute";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  popup.style.padding = "20px";
  popup.style.color = "#ffffff";
  popup.style.borderRadius = "10px";
  popup.style.textAlign = "center";

  popup.innerHTML = `
    <h1>Game Over</h1>
    <p>Asteroids avoided: ${score}</p>
    <button id="play-again" style="padding: 10px 20px; margin-top: 10px; cursor: pointer;">Play Again</button>
  `;

  document.body.appendChild(popup);

  // Add event listener to the "Play Again" button
  document.getElementById("play-again").addEventListener("click", () => {
    location.reload(); // Reload the entire page
  });
}

// Handle asteroid collision
function handleCollision() {
  if (gameOver) return;
  gameOver = true;
  asteroid.body.setVelocity(0, 0);
  this.tweens.killAll();
  showGameOver();
}

// Handle laser collision
function handleLaserCollision() {
  if (gameOver) return;
  gameOver = true;
  laser.setVisible(false);
  laser.body.setVelocity(0, 0);
  showGameOver();
}
