// Space Miner - converted from simple stars sketch
// Features implemented:
// - textured stars using star.png
// - asteroids (some 'flying' / red tinted) with ores spawned on their surfaces
// - player with built-in pickaxe, spaceship (made of shapes), oxygen, and inventory
// - rope physics (zero gravity) attaching player to ship with limited length and upgrades
// - mining ores, smelting Amancapine in ship furnace to produce gems
// - upgrades using gems (rope length and ship upgrades; gem doubles upgrade effect)

let imgStar, imgAsteroid, imgCoal, imgGold, imgUranium, imgBlood, imgAmancapine;
let asteroids = [];
let stars = [];
let player;
let ship;
let rope = null;
let wrecks = [];
let starShader;
let shaderCanvas;
let gameState = 'menu'; // 'menu' or 'playing'
let menuButtons = [];
let upgradeMenuOpen = false;
let upgrades = [];
let upgradeScroll = 0;
let notesOpen = false;

function preload() {
  imgStar = loadImage('./star.png');
  imgAsteroid = loadImage('./asteroid.png');
  imgCoal = loadImage('./coal.png');
  imgGold = loadImage('./gold.png');
  imgUranium = loadImage('./uranium.png');
  imgBlood = loadImage('./BloodStone.png');
  imgAmancapine = loadImage('./Amancapine.png');
  // load shader (vertex + fragment)
  starShader = loadShader('star.vert', 'star.frag');
}

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  imageMode(CENTER);

  // background stars using texture
  for (let i = 0; i < 120; i++) {
    stars.push({x: random(width), y: random(height), s: random(8, 22), r: random(0, TWO_PI)});
  }

  // create ship in centre
  ship = new Ship(width / 2, height / 2);

  // create player attached in ship initially
  player = new Player(ship.x + 60, ship.y);
  player.enterShip(ship);

  // spawn asteroids
  for (let i = 0; i < 18; i++) {
    let a = new Asteroid(random(width), random(height), random(40, 110));
    asteroids.push(a);
  }

  // spawn some ship wrecks in space
  for (let i = 0; i < 6; i++) {
    wrecks.push(new Wreck(random(width*0.2, width*0.8), random(height*0.2, height*0.8), random(60, 200)));
  }

  // create shader canvas (WEBGL) for post-processing overlays
  shaderCanvas = createGraphics(window.innerWidth, window.innerHeight, WEBGL);

  // create menu buttons (screen-space)
  let bw = 260;
  let bh = 56;
  let cx = width/2;
  let by = height/2 + 40;
  menuButtons.push(new UIButton(cx, by - 60, bw, bh, 'Start Game', () => { gameState = 'playing'; }));
  menuButtons.push(new UIButton(cx, by + 10, bw, bh, 'Options', () => { /* future options */ }));
  menuButtons.push(new UIButton(cx, by + 80, bw, bh, 'Quit', () => { /* no-op for web */ }));

  // define upgrade items
  upgrades.push({
    id: 'rope',
    name: 'Extend Rope',
    desc: 'Increase rope max length by 120 units (applies twice when using a gem).',
    cost: 1,
    apply: () => { player.ropeMax += 120; }
  });
  upgrades.push({
    id: 'ship',
    name: 'Reinforce Ship',
    desc: 'Improve ship furnace speed (upgrade level +1).',
    cost: 1,
    apply: () => { ship.upgradeLevel += 1; }
  });
  upgrades.push({
    id: 'oxygen',
    name: 'Oxygen Tanks',
    desc: 'Increase maximum oxygen by 80.',
    cost: 1,
    apply: () => { player.maxOxygen += 80; player.oxygen = player.maxOxygen; }
  });
  upgrades.push({
    id: 'thrusters',
    name: 'Thruster Boost',
    desc: 'Improve player thruster power when outside.',
    cost: 1,
    apply: () => { /* increase thruster power by adjusting constant */ player.thrusterBoost = (player.thrusterBoost || 1) + 0.25; }
  });

  // initial research tracking
  player.researchPoints = 0;
  player.discovered = {};
}

function draw() {
  background(5, 6, 15);

  if (gameState === 'menu') {
    // draw animated background stars for menu
    let t = millis() * 0.0006;
    push();
    noStroke();
    for (let st of stars) {
      let parallax = 0.35 + 0.05 * sin(t + st.r);
      let sx = (st.x - width/2) * parallax + width / 2 + 12 * sin(t * 0.3 + st.x * 0.001);
      let sy = (st.y - height/2) * parallax + height / 2 + 8 * cos(t * 0.4 + st.y * 0.001);
      push();
      translate(sx, sy);
      rotate(st.r + 0.2 * sin(t + st.x * 0.002));
      tint(200, 220);
      image(imgStar, 0, 0, st.s * 1.4, st.s * 1.4);
      pop();
    }
    pop();

    // shader overlay behind menu
    if (shaderCanvas && starShader) {
      shaderCanvas.push();
      shaderCanvas.shader(starShader);
      starShader.setUniform('u_resolution', [width, height]);
      starShader.setUniform('u_time', millis() / 1000.0);
      shaderCanvas.noStroke();
      shaderCanvas.rectMode(CENTER);
      shaderCanvas.translate(0, 0, 0);
      shaderCanvas.rect(0, 0, width, height);
      shaderCanvas.pop();
      push(); resetMatrix(); imageMode(CORNER); tint(255,180); image(shaderCanvas,0,0,width,height); pop();
    }

    // Title
    push();
    resetMatrix();
    textAlign(CENTER, CENTER);
    translate(width/2, height/2 - 140);
    // neon retro title effect
    for (let i = 6; i >= 1; i--) {
      fill(30, 120, 200, 20 * i);
      textSize(80 + i*2);
      textStyle(BOLD);
      text('Minor Miner', 0, 0);
    }
    fill(120, 220, 255);
    stroke(8, 20, 40);
    strokeWeight(3);
    textSize(72);
    text('Minor Miner', 0, 0);
    pop();

    // draw buttons
    for (let b of menuButtons) {
      b.draw();
    }

    // small footer
    push(); resetMatrix(); fill(180); textSize(12); textAlign(CENTER); text('Retro-futuristic space mining — built with p5.js', width/2, height - 28); pop();

    return; // skip main game draw while menu active
  }
  // ensure stars exist around player as they move (no out-of-bounds)
  ensureStarsAround(player.x, player.y);

  // camera follows player
  let camX = player.x;
  let camY = player.y;

  // draw parallax stars (background) relative to camera
  push();
  noStroke();
  for (let st of stars) {
    let parallax = 0.45; // stars move slower than world
    let sx = (st.x - camX) * parallax + width / 2;
    let sy = (st.y - camY) * parallax + height / 2;
    push();
    translate(sx, sy);
    rotate(st.r);
    tint(255, 230);
    image(imgStar, 0, 0, st.s, st.s);
    pop();
  }
  pop();

  // draw upgrade menu overlay if open
  if (upgradeMenuOpen) {
    drawUpgradeMenu();
  }

  // draw notes overlay if open (on top of everything)
  if (notesOpen) {
    drawNotes();
    return; // block game input while notes visible
  }

  // world objects drawn with camera transform
  push();
  translate(width / 2 - camX, height / 2 - camY);

  // update and draw asteroids
  for (let ast of asteroids) {
    ast.update();
    ast.draw();
  }

  // wrecks
  for (let w of wrecks) {
    w.update();
    w.draw();
  }

  // ship
  ship.update();
  ship.draw();

  // player
  player.update();
  player.draw();

  // rope
  if (rope) {
    rope.update();
    rope.draw();
  }

  pop(); // end camera transform

  // post-processing shader overlay (vignette + subtle star light)
  if (shaderCanvas && starShader) {
    shaderCanvas.push();
    shaderCanvas.shader(starShader);
    starShader.setUniform('u_resolution', [width, height]);
    starShader.setUniform('u_time', millis() / 1000.0);
    // draw a full-screen rectangle in shaderCanvas (WEBGL coordinates)
    shaderCanvas.noStroke();
    shaderCanvas.rectMode(CENTER);
    shaderCanvas.translate(0, 0, 0);
    shaderCanvas.rect(0, 0, width, height);
    shaderCanvas.pop();

    // draw shaderCanvas on top of 2D canvas
    push();
    resetMatrix();
    imageMode(CORNER);
    tint(255, 210);
    image(shaderCanvas, 0, 0, width, height);
    pop();
  }

  // UI
  drawUI();
}

function drawUI() {
  // oxygen bar
  // health bar
  push();
  fill(80);
  stroke(150);
  rect(20, 52, 220, 18);
  noStroke();
  fill(220, 60, 60);
  let hW = map(player.health, 0, player.maxHealth, 0, 216);
  rect(22, 54, hW, 14);
  fill(255);
  textSize(12);
  text('HEALTH', 26, 72);
  pop();

  push();
  fill(60);
  stroke(150);
  rect(20, 20, 220, 26);
  noStroke();
  if (player.inShip) fill(50, 180, 255);
  else fill(0, 180, 255);
  let oW = map(player.oxygen, 0, player.maxOxygen, 0, 216);
  rect(22, 22, oW, 22);
  fill(255);
  textSize(14);
  text('OXYGEN', 26, 58);
  pop();

  // inventory
  push();
  fill(255);
  textSize(14);
  let ix = width - 220;
  // inventory with icons
  text('Inventory:', ix, 30);
  let iconX = ix + 8;
  imageMode(CORNER);
  image(imgCoal, iconX, 40, 18, 18); text(' x ' + player.inv.coal, iconX + 22, 44);
  image(imgGold, iconX, 62, 18, 18); text(' x ' + player.inv.gold, iconX + 22, 66);
  image(imgUranium, iconX, 84, 18, 18); text(' x ' + player.inv.uranium, iconX + 22, 88);
  image(imgBlood, iconX, 106, 18, 18); text(' x ' + player.inv.blood, iconX + 22, 110);
  image(imgAmancapine, iconX, 128, 18, 18); text(' x ' + player.inv.amancapine, iconX + 22, 132);
  fill(255); text('Gems: ' + player.gems, ix, 154);
  pop();

  // help
  push();
  fill(200);
  textSize(12);
  text('Controls: WASD / Arrow - move. E - enter/exit ship. M - mine. S - smelt (in ship). U - upgrades menu. Space - jump inside ship.', 20, height - 20);
  pop();
}

// ------------------ Star management ------------------
function ensureStarsAround(cx, cy) {
  // spawn stars within an extended rect around the camera so the field appears infinite
  let padX = width * 1.5;
  let padY = height * 1.5;
  let left = cx - padX/2;
  let right = cx + padX/2;
  let top = cy - padY/2;
  let bottom = cy + padY/2;

  // count how many stars currently in the rect
  let count = 0;
  for (let s of stars) {
    if (s.x >= left && s.x <= right && s.y >= top && s.y <= bottom) count++;
  }

  let target = 140; // target stars in view area
  let attempts = 0;
  while (count < target && attempts < 500) {
    attempts++;
    let sx = random(left, right);
    let sy = random(top, bottom);
    let ss = random(6, 22);
    let r = random(0, TWO_PI);
    stars.push({x: sx, y: sy, s: ss, r: r});
    count++;
  }

  // prune very distant stars to keep array size bounded
  let maxDist = max(width, height) * 3;
  for (let i = stars.length - 1; i >= 0; i--) {
    let s = stars[i];
    let dx = s.x - cx;
    let dy = s.y - cy;
    if (abs(dx) > maxDist || abs(dy) > maxDist) {
      stars.splice(i, 1);
    }
  }
}

// ------------------ Upgrade menu ------------------
function drawUpgradeMenu() {
  push();
  resetMatrix();
  // dark overlay
  fill(4, 8, 12, 200);
  rectMode(CORNER);
  rect(0, 0, width, height);

  // panel
  let pw = min(720, width - 120);
  let ph = min(520, height - 160);
  let px = (width - pw) / 2;
  let py = (height - ph) / 2;
  fill(10, 18, 30, 240);
  stroke(50, 120, 160);
  strokeWeight(2);
  rect(px, py, pw, ph, 12);

  // title
  noStroke();
  fill(160, 240, 255);
  textSize(28);
  textAlign(LEFT, TOP);
  text('UPGRADES', px + 20, py + 14);
  fill(160);
  textSize(12);
  text('Gems: ' + player.gems, px + pw - 110, py + 20);

  // list area
  let listX = px + 20;
  let listY = py + 60;
  let listW = pw - 40;
  let itemH = 92;

  // clamp scroll
  let contentH = upgrades.length * (itemH + 12);
  upgradeScroll = constrain(upgradeScroll, 0, max(0, contentH - (ph - 120)));

  push();
  translate(listX, listY - upgradeScroll);
  for (let i = 0; i < upgrades.length; i++) {
    let u = upgrades[i];
    let iy = i * (itemH + 12);
    // background
    push();
    translate(0, iy);
    fill(18, 26, 40);
    rect(0, 0, listW, itemH, 10);
    stroke(40, 120, 180);
    noFill();
    rect(0, 0, listW, itemH, 10);

    // text
    noStroke();
    fill(200);
    textSize(16);
    textAlign(LEFT, TOP);
    text(u.name, 14, 8);
    fill(160);
    textSize(12);
    text(u.desc, 14, 30, listW - 160, itemH - 36);

    // purchase button
    let bx = listW - 120;
    let by = itemH / 2 - 16;
    push();
    translate(bx, by);
    // draw small button
    let bw = 96; let bh = 36;
    // detect hover using global mouse pos
    let absX = px + 20 + bx + bw/2;
    let absY = py + 60 - upgradeScroll + iy + by + bh/2;
    let hovering = mouseX > (absX - bw/2) && mouseX < (absX + bw/2) && mouseY > (absY - bh/2) && mouseY < (absY + bh/2);
    if (hovering) fill(40,200,255); else fill(20,120,160);
    rect(0, 0, bw, bh, 8);
    fill(10, 20, 30, 180);
    rect(0, 0, bw - 8, bh - 8, 6);
    fill(220);
    textSize(14);
    textAlign(CENTER, CENTER);
    text('Buy (' + u.cost + 'G)', 0, 0);
    pop();

    pop();
  }
  pop();

  // small instruction
  noStroke(); fill(140); textSize(12); textAlign(LEFT); text('Use mouse wheel or Arrow keys to scroll. Click Buy to spend 1 gem (applies upgrade twice).', px + 20, py + ph - 36);
  pop();
}

// ------------------ Notes / Research overlay ------------------
function drawNotes() {
  push(); resetMatrix();
  fill(6, 10, 16, 220); rect(0,0,width,height);
  let pw = min(880, width - 120);
  let ph = min(640, height - 160);
  let px = (width - pw) / 2;
  let py = (height - ph) / 2;
  fill(10,18,28); stroke(40,100,140); rect(px, py, pw, ph, 10);
  noStroke(); fill(180, 240, 255); textSize(24); textAlign(LEFT, TOP);
  text('Notes & Research', px + 20, py + 18);

  // instructions
  fill(200); textSize(14);
  let insX = px + 24; let insY = py + 56;
  text('How to move: Use WASD or Arrow keys to thrust and maneuver when outside the ship. Enter/Exit ship with E.', insX, insY, pw - 48);
  text('How to smelt: Enter the ship, press S to smelt one Amancapine into a gem using the furnace. Gems are used for upgrades.', insX, insY + 36, pw - 48);
  text('\nAll we know is we can smelt the ores you find and yadda yadda!', insX, insY + 88, pw - 48);

  // research summary
  fill(180); textSize(16); text('Research Points: ' + (player.researchPoints || 0), px + 24, py + ph - 120);
  textSize(12); fill(160); text('Discovered ore types:', px + 24, py + ph - 94);
  let dX = px + 24; let dY = py + ph - 74; let idx = 0;
  for (let t in player.discovered) {
    if (player.discovered[t]) {
      text('- ' + t, dX, dY + idx * 18);
      idx++;
    }
  }

  // hint
  fill(140); textSize(12); text('Press R while in the ship to perform research (consumes 1 Amancapine -> +2 research points). Press Tab to close.', px + pw - 420, py + ph - 36);
  pop();
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

// ------------------ Classes ------------------

class Asteroid {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.vx = random(-0.3, 0.3);
    this.vy = random(-0.3, 0.3);
    this.flying = random(1) < 0.12; // some are flying (red)
    this.ores = [];
    this.spawnOres();
  }

  spawnOres() {
    // spawn 0..4 ores on surface
    let types = ['coal', 'gold', 'uranium', 'blood', 'amancapine'];
    let imgs = {coal: imgCoal, gold: imgGold, uranium: imgUranium, blood: imgBlood, amancapine: imgAmancapine};
    let count = floor(random(0, 4));
    for (let i = 0; i < count; i++) {
      let angle = random(TWO_PI);
      // distance slightly outside surface
      let dist = this.r - random(8, 20);
      let type = random(types);
      this.ores.push({type, angle, dist, img: imgs[type], mined: false, size: random(22, 34)});
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    // wrap screen
    if (this.x < -this.r) this.x = width + this.r;
    if (this.x > width + this.r) this.x = -this.r;
    if (this.y < -this.r) this.y = height + this.r;
    if (this.y > height + this.r) this.y = -this.r;

    // collision with player
    let dx = player.x - this.x;
    let dy = player.y - this.y;
    let d = sqrt(dx * dx + dy * dy);
    if (this.flying && d < this.r + player.radius) {
      // flying asteroid damages player on impact
      player.takeDamage(40);
    }
  }

  draw() {
    push();
    translate(this.x, this.y);
    // draw asteroid texture scaled
    let s = this.r * 2;
    if (this.flying) {
      push();
      tint(255, 100, 100); // red tint
      image(imgAsteroid, 0, 0, s, s);
      pop();
    } else {
      image(imgAsteroid, 0, 0, s, s);
    }

    // draw ores on surface
    for (let ore of this.ores) {
      if (ore.mined) continue;
      let ox = cos(ore.angle) * (this.r - 6);
      let oy = sin(ore.angle) * (this.r - 6);
      push();
      translate(ox, oy);
      // draw ore larger and on top of asteroid surface
      image(ore.img, 0, 0, ore.size, ore.size);
      pop();
    }
    pop();
  }

  // returns world position of ore or null
  getOreWorldPos(ore) {
    let ox = this.x + cos(ore.angle) * ore.dist;
    let oy = this.y + sin(ore.angle) * ore.dist;
    return {x: ox, y: oy};
  }
}

class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // make ship much larger (like an Among Us ship)
    this.w = 560;
    this.h = 220;
    this.vx = 0;
    this.vy = 0;
    this.furnaceTime = 0; // smelting timer
    this.furnaceBusy = false;
    this.furnaceProgress = 0;
    this.upgradeLevel = 0;
  }

  update() {
    // ship movement: if player is inside, allow driving the ship
    if (player && player.inShip) {
      let ax = 0;
      let ay = 0;
      if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) ax -= 0.12;
      if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) ax += 0.12;
      if (keyIsDown(UP_ARROW) || keyIsDown(87)) ay -= 0.12;
      if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) ay += 0.12;
      this.vx += ax;
      this.vy += ay;
    } else {
      // gentle idle drift when nobody's piloting
      this.vx += sin(frameCount * 0.003 + this.x) * 0.002;
      this.vy += cos(frameCount * 0.002 + this.y) * 0.0015;
    }
    // apply damping and update position
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.x += this.vx;
    this.y += this.vy;
    // smelting
    if (this.furnaceBusy) {
      this.furnaceProgress += 1;
      if (this.furnaceProgress > 120 - this.upgradeLevel * 12) {
        // finish smelt: produce gem
        this.furnaceBusy = false;
        this.furnaceProgress = 0;
        player.gems += 1;
      }
    }
  }

  draw() {
    push();
    translate(this.x, this.y);
    // ship body: rectangles and circles
    noStroke();
    fill(120, 140, 180);
    rectMode(CENTER);
    rect(0, 0, this.w, this.h, 16);
    fill(180);
    ellipse(-this.w / 3, 0, this.h * 0.9, this.h * 0.9);
    fill(60, 120, 180);
    rect(this.w / 4, -this.h / 4, this.w / 3, this.h / 3, 8);

  // window / airlock (larger)
  fill(20, 40, 80);
  ellipse(this.w / 2 - 40, 0, 60, 60);

    // furnace (draw inside on the left side)
    push();
    let fx = -this.w / 4;
    let fy = this.h / 4;
    translate(fx, fy);
    // furnace body
    fill(50, 40, 36);
    stroke(80);
    rect(0, 0, 72, 56, 6);
    // furnace door
    fill(28, 18, 16);
    rect(0, 0, 44, 36, 4);
    // small window/glass
    fill(160, 80, 20, this.furnaceBusy ? 220 : 90);
    ellipse(0, 0, 18, 14);
    // progress bar below
    noStroke();
    fill(30);
    rect(0, 20, 56, 8, 4);
    if (this.furnaceBusy) {
      let pct = constrain(this.furnaceProgress / max(1, 120 - this.upgradeLevel * 12), 0, 1);
      fill(255, 160, 0);
      rectMode(CENTER);
      rect(-14 + pct * 28, 20, 56 * pct, 8, 4);
      // little flame indicator
      fill(255, 120, 10, 180 + 80 * sin(millis() * 0.02));
      triangle(-6, -4, 0, -18, 6, -4);
    }
    pop();
    pop();
  }

  inside(px, py) {
    return abs(px - this.x) < this.w / 2 && abs(py - this.y) < this.h / 2;
  }

  startSmelt() {
    // Must be inside the ship and near the furnace to start smelting
    if (this.furnaceBusy) return;
    if (!player.inShip || !player.insideShip) return;
    // furnace world position
    let fx = this.x - this.w / 4;
    let fy = this.y + this.h / 4;
    if (dist(player.x, player.y, fx, fy) > 72) return; // too far from furnace
    if (player.inv.amancapine <= 0) return;
    // consume one Amancapine and start smelting
    player.inv.amancapine -= 1;
    this.furnaceBusy = true;
    this.furnaceProgress = 0;
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.inShip = false;
    this.insideShip = false; // true when walking around inside the ship
    this.oxygen = 200;
    this.maxOxygen = 200;
  this.onFloor = false;
    this.health = 100;
    this.maxHealth = 100;
    this.inv = {coal:0, gold:0, uranium:0, blood:0, amancapine:0};
    this.gems = 0;
    this.alive = true;
    this.ropeMax = 320; // medium length
  }

  enterShip(s) {
    this.inShip = true;
    this.insideShip = true; // now the player is inside and can walk around
    // place player inside near the airlock entrance
    this.x = s.x + s.w / 2 - 80;
    this.y = s.y + (s.h / 2) - 36; // stand on the interior floor
    this.vx = 0;
    this.vy = 0;
    this.oxygen = this.maxOxygen; // refills instantly while inside
    // remove rope
    rope = null;
  }

  exitShip() {
    // exit to the outside world (only possible when inside)
    this.insideShip = false;
    this.inShip = false;
    // place the player outside near the airlock
    this.x = ship.x + ship.w / 2 + 80;
    this.y = ship.y;
    this.vx = 0; this.vy = 0;
    // create rope connecting back to ship
    rope = new Rope(ship, this, this.ropeMax);
  }

  update() {
    if (!this.alive) return;

    if (this.inShip && this.insideShip) {
      // interior walking behavior: simple gravity + floor collision
      // oxygen refills while inside
      this.oxygen = min(this.maxOxygen, this.oxygen + 1.5);

      // horizontal walking
      let walkAcc = 0.45;
      if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) this.vx -= walkAcc;
      if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) this.vx += walkAcc;
      // small jump / step
      if ((keyIsDown(32) || keyIsDown(87)) && this.onFloor) {
        this.vy = -9;
        this.onFloor = false;
      }

      // gravity inside ship
      this.vy += 0.8;
      // damping
      this.vx *= 0.88;
      this.vy *= 0.98;

      this.x += this.vx;
      this.y += this.vy;

      // compute interior bounds
      let leftBound = ship.x - ship.w/2 + 18;
      let rightBound = ship.x + ship.w/2 - 18;
      let floorY = ship.y + ship.h/2 - 28;

      // floor collision
      if (this.y > floorY) {
        this.y = floorY;
        this.vy = 0;
        this.onFloor = true;
      }
      // walls
      if (this.x < leftBound) { this.x = leftBound; this.vx = 0; }
      if (this.x > rightBound) { this.x = rightBound; this.vx = 0; }

    } else {
      // zero-gravity movement via thrusters when outside
      let ax = 0;
      let ay = 0;
      if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) ax -= 0.08;
      if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) ax += 0.08;
      if (keyIsDown(UP_ARROW) || keyIsDown(87)) ay -= 0.08;
      if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) ay += 0.08;
      this.vx += ax;
      this.vy += ay;
      // apply small damping
      this.vx *= 0.998;
      this.vy *= 0.998;
      this.x += this.vx;
      this.y += this.vy;

      // oxygen drains
      this.oxygen -= 0.08;
      if (this.oxygen <= 0) this.die();
    }

    // mining: automatic pickaxe in responses to M key (handled in keyPressed)
  }

  draw() {
    if (!this.alive) return;

    push();
    translate(this.x, this.y);

    // if in ship, draw as small inside indicator
    if (this.inShip) {
      fill(255, 230);
      ellipse(0, 0, this.radius * 1.8, this.radius * 1.8);
      pop();
      return;
    }

    // draw simple astronaut with pickaxe integrated (squares and circles)
    noStroke();
    fill(220);
    ellipse(0, 0, this.radius * 2, this.radius * 2); // helmet
    fill(150);
    rect(-6, 10, 12, 16, 3); // body
    // built-in pickaxe: small rectangle and triangle
    push();
    translate(14, 6);
    rotate(-PI/6);
    fill(110);
    rect(0, 0, 18, 4);
    triangle(18, -6, 26, 2, 18, 10);
    pop();
    pop();
  }

  mine() {
    if (!this.alive) return;
    // find nearest ore within mining distance
    let best = null;
    let bestDist = 999;
    let bestAst = null;
    for (let ast of asteroids) {
      for (let ore of ast.ores) {
        if (ore.mined) continue;
        let pos = ast.getOreWorldPos(ore);
        let d = dist(this.x, this.y, pos.x, pos.y);
        if (d < 46 && d < bestDist) {
          bestDist = d;
          best = ore;
          bestAst = ast;
        }
      }
    }
    if (best && bestAst) {
      // mine it
      best.mined = true;
      switch(best.type) {
        case 'coal': this.inv.coal++; break;
        case 'gold': this.inv.gold++; break;
        case 'uranium': this.inv.uranium++; break;
        case 'blood': this.inv.blood++; break;
        case 'amancapine': this.inv.amancapine++; break;
      }
      // research: if first time discovering this ore type, grant a research point
      if (!this.discovered) this.discovered = {};
      if (!this.discovered[best.type]) {
        this.discovered[best.type] = true;
        this.researchPoints = (this.researchPoints || 0) + 1;
      }
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    // simple reset after a pause
    setTimeout(() => {
      this.alive = true;
      this.x = ship.x + 60; this.y = ship.y;
      this.vx = 0; this.vy = 0;
      this.oxygen = this.maxOxygen;
      this.inv = {coal:0, gold:0, uranium:0, blood:0, amancapine:0};
      this.gems = 0;
      this.inShip = true;
      rope = null;
    }, 1200);
  }
}

class Rope {
  constructor(ship, player, maxLen) {
    this.anchor = ship; // ship object
    this.player = player;
    this.maxLen = maxLen;
    this.segmentLen = 20;
    this.segments = [];
    // build segments from anchor to player
    let dx = player.x - ship.x;
    let dy = player.y - ship.y;
    let dist = sqrt(dx*dx + dy*dy);
    let n = ceil(dist / this.segmentLen);
    n = max(3, n);
    for (let i = 0; i <= n; i++) {
      let t = i / n;
      this.segments.push({x: lerp(ship.x, player.x, t), y: lerp(ship.y, player.y, t), px: lerp(ship.x, player.x, t), py: lerp(ship.y, player.y, t)});
    }
  }

  update() {
    // verlet integration (no gravity)
    for (let seg of this.segments) {
      let nx = seg.x + (seg.x - seg.px);
      let ny = seg.y + (seg.y - seg.py);
      seg.px = seg.x; seg.py = seg.y;
      seg.x = nx; seg.y = ny;
    }

    // anchor first segment to ship
    let first = this.segments[0];
    first.x = this.anchor.x;
    first.y = this.anchor.y;

    // last segment should follow player
    let last = this.segments[this.segments.length-1];
    last.x = this.player.x;
    last.y = this.player.y;

    // enforce constraints: keep distances fixed and limit total length
    let iters = 4;
    for (let k = 0; k < iters; k++) {
      for (let i = 0; i < this.segments.length - 1; i++) {
        let a = this.segments[i];
        let b = this.segments[i+1];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = sqrt(dx*dx + dy*dy) || 0.0001;
        let diff = (d - this.segmentLen) / d;
        let adjustX = dx * 0.5 * diff;
        let adjustY = dy * 0.5 * diff;
        if (i != 0) { a.x += adjustX; a.y += adjustY; }
        b.x -= adjustX; b.y -= adjustY;
      }

      // limit total length to maxLen
      let total = (this.segments.length-1) * this.segmentLen;
      if (total > this.maxLen) {
        // scale segment length effectively by moving player segment closer to anchor
        let anchor = this.segments[0];
        let last = this.segments[this.segments.length-1];
        let dx = last.x - anchor.x; let dy = last.y - anchor.y;
        let d = sqrt(dx*dx + dy*dy) || 0.0001;
        if (d > this.maxLen) {
          let t = this.maxLen / d;
          last.x = anchor.x + dx * t;
          last.y = anchor.y + dy * t;
          this.player.x = last.x;
          this.player.y = last.y;
          this.player.vx = 0; this.player.vy = 0;
        }
      }
    }

    // apply a pulling force from the rope to the player's velocity so the rope tugs the player in
    // This uses a proportional pull based on distance relative to maxLen.
    let ax = this.anchor.x - this.player.x;
    let ay = this.anchor.y - this.player.y;
    let dd = sqrt(ax*ax + ay*ay) || 0.0001;
    let pullFactor = constrain(dd / this.maxLen, 0, 1);
    let pullStrength = 0.14; // tune to adjust how strongly the rope pulls
    this.player.vx += (ax / dd) * pullStrength * pullFactor;
    this.player.vy += (ay / dd) * pullStrength * pullFactor;
  }

  draw() {
    push();
    stroke(200);
    strokeWeight(3);
    noFill();
    beginShape();
    for (let s of this.segments) vertex(s.x, s.y);
    endShape();
    pop();
  }
}

// simple ship wreck class (scattered debris / hull pieces)
class Wreck {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.angle = random(TWO_PI);
    this.vx = random(-0.2, 0.2);
    this.vy = random(-0.2, 0.2);
    this.spin = random(-0.01, 0.01);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.spin;
    // wrap
    if (this.x < -this.size) this.x = width + this.size;
    if (this.x > width + this.size) this.x = -this.size;
    if (this.y < -this.size) this.y = height + this.size;
    if (this.y > height + this.size) this.y = -this.size;
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    tint(180, 80, 80);
    image(imgAsteroid, 0, 0, this.size, this.size * 0.6);
    // debris pieces
    noStroke();
    fill(180, 120, 120, 200);
    for (let i = 0; i < 4; i++) {
      let a = i * PI / 2 + 0.3;
      let rx = cos(a) * (this.size / 3);
      let ry = sin(a) * (this.size / 4);
      rect(rx, ry, this.size / 8, this.size / 16);
    }
    pop();
  }
}

// ---------------- UI: buttons and styles ----------------
class UIButton {
  constructor(x, y, w, h, label, onClick) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label; this.onClick = onClick;
  }

  isMouseOver() {
    return mouseX > this.x - this.w/2 && mouseX < this.x + this.w/2 && mouseY > this.y - this.h/2 && mouseY < this.y + this.h/2;
  }

  draw() {
    push();
    resetMatrix();
    rectMode(CENTER);
    translate(this.x, this.y);
    let over = this.isMouseOver();
    // glow layers
    for (let i = 8; i >= 1; i--) {
      let a = map(i, 1, 8, 12, 2);
      fill(30, 150, 220, a * (over ? 1.4 : 1.0));
      noStroke();
      rect(0, 0, this.w + i*8, this.h + i*4, 18);
    }
    // main button
    if (over) fill(40, 200, 255); else fill(20, 120, 180);
    stroke(180); strokeWeight(1.6);
    rect(0, 0, this.w, this.h, 14);

    // inner sleek panel
    noStroke();
    fill(6, 20, 30, 100);
    rect(0, 0, this.w - 12, this.h - 10, 12);

    // label with retro font-like layers
    textAlign(CENTER, CENTER);
    for (let j = 4; j >= 1; j--) {
      fill(0, 0, 0, 20 * j);
      textSize(18 + j);
      text(this.label, 0, -2);
    }
    fill(180, 255, 255);
    textSize(20);
    text(this.label, 0, -2);
    pop();
  }
}

// ------------------ Input handlers ------------------

function keyPressed() {
  if (gameState === 'menu') return; // ignore keys while in menu except mouse
  if (keyCode === 9) { // Tab
    notesOpen = !notesOpen;
    return;
  }
  if (key === 'U' || key === 'u') {
    upgradeMenuOpen = !upgradeMenuOpen;
    return;
  }
  if (upgradeMenuOpen) {
    // navigation
    if (keyCode === UP_ARROW) upgradeScroll -= 40;
    if (keyCode === DOWN_ARROW) upgradeScroll += 40;
    return;
  }
  if (key === 'E' || key === 'e') {
    // Enter/exit logic: enter from outside by standing near airlock, exit to outside when inside
    if (player.inShip && player.insideShip) {
      // exit to outside
      player.exitShip();
    } else {
      // if near airlock (outside), enter interior
      let airlockX = ship.x + ship.w/2 - 40;
      let airlockY = ship.y;
      if (dist(player.x, player.y, airlockX, airlockY) < 80) {
        player.enterShip(ship);
      }
    }
  }

  if (key === 'M' || key === 'm') {
    player.mine();
  }

  if ((key === 'S' || key === 's') && player.inShip) {
    ship.startSmelt();
  }

  if ((key === 'R' || key === 'r') && player.inShip) {
    // research action: consume 1 Amancapine to gain 2 research points
    if (player.inv.amancapine > 0) {
      player.inv.amancapine -= 1;
      player.researchPoints = (player.researchPoints || 0) + 2;
    }
  }

  // Upgrades are now purchased through the Upgrade Menu (press U) - number keys removed.
}

function mousePressed() {
  if (gameState === 'menu') {
    // check UI buttons
    for (let b of menuButtons) {
      if (b.isMouseOver()) {
        if (b.onClick) b.onClick();
      }
    }
    return;
  }
  if (upgradeMenuOpen) {
    // check upgrade buy buttons
    // compute list area same as drawUpgradeMenu
    let pw = min(720, width - 120);
    let ph = min(520, height - 160);
    let px = (width - pw) / 2;
    let py = (height - ph) / 2;
    let listX = px + 20;
    let listY = py + 60;
    let listW = pw - 40;
    let itemH = 92;
    for (let i = 0; i < upgrades.length; i++) {
      let iy = i * (itemH + 12);
      let bx = listW - 120;
      let by = itemH / 2 - 16;
      let bw = 96; let bh = 36;
      let absX = px + 20 + bx + bw/2;
      let absY = py + 60 - upgradeScroll + iy + by + bh/2;
      if (mouseX > (absX - bw/2) && mouseX < (absX + bw/2) && mouseY > (absY - bh/2) && mouseY < (absY + bh/2)) {
        // attempt purchase (only while in ship)
        if (!player.inShip) break;
        let u = upgrades[i];
        if (player.gems >= u.cost) {
          // consume one gem and apply the upgrade twice (gem doubles effect)
          player.gems -= u.cost;
          u.apply();
          u.apply();
        }
      }
    }
    return;
  }

  // allow clicking to mine as well
  player.mine();
}

function mouseWheel(event) {
  if (upgradeMenuOpen) {
    upgradeScroll += event.delta;
    return false; // prevent page scroll
  }
}

