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

function preload() {
  imgStar = loadImage('./star.png');
  imgAsteroid = loadImage('./asteroid.png');
  imgCoal = loadImage('./coal.png');
  imgGold = loadImage('./gold.png');
  imgUranium = loadImage('./uranium.png');
  imgBlood = loadImage('./BloodStone.png');
  imgAmancapine = loadImage('./Amancapine.png');
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
}

function draw() {
  background(5, 6, 15);

  // draw textured stars
  push();
  for (let st of stars) {
    push();
    translate(st.x, st.y);
    rotate(st.r);
    tint(255, 230);
    image(imgStar, 0, 0, st.s, st.s);
    pop();
  }
  pop();

  // update and draw asteroids
  for (let ast of asteroids) {
    ast.update();
    ast.draw();
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

  // UI
  drawUI();
}

function drawUI() {
  // oxygen bar
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
  text('Inventory:', ix, 30);
  text('Coal: ' + player.inv.coal, ix, 50);
  text('Gold: ' + player.inv.gold, ix, 70);
  text('Uranium: ' + player.inv.uranium, ix, 90);
  text('BloodStone: ' + player.inv.blood, ix, 110);
  text('Amancapine: ' + player.inv.amancapine, ix, 130);
  text('Gems: ' + player.gems, ix, 150);
  pop();

  // help
  push();
  fill(200);
  textSize(12);
  text('Controls: WASD / Arrow - move when outside. E - enter/exit ship. M - mine. S - smelt (in ship). 1 - upgrade rope (1 gem). 2 - upgrade ship (1 gem).', 20, height - 20);
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
      this.ores.push({type, angle, dist, img: imgs[type], mined: false});
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
      // flying asteroid kills player on impact
      player.die();
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
      let ox = cos(ore.angle) * ore.dist;
      let oy = sin(ore.angle) * ore.dist;
      push();
      translate(ox, oy);
      image(ore.img, 0, 0, 18, 18);
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
    this.w = 160;
    this.h = 80;
    this.furnaceTime = 0; // smelting timer
    this.furnaceBusy = false;
    this.furnaceProgress = 0;
    this.upgradeLevel = 0;
  }

  update() {
    // ship might drift a bit
    // simple gentle bobbing
    this.x += sin(frameCount * 0.003 + this.x) * 0.05;
    this.y += cos(frameCount * 0.002 + this.y) * 0.03;
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
    rect(0, 0, this.w, this.h, 8);
    fill(180);
    ellipse(-this.w / 3, 0, this.h * 0.7, this.h * 0.7);
    fill(60, 120, 180);
    rect(this.w / 4, -this.h / 4, this.w / 3, this.h / 3, 6);

    // window / airlock
    fill(20, 40, 80);
    ellipse(this.w / 2 - 12, 0, 28, 28);

    // furnace indicator
    if (this.furnaceBusy) {
      fill(255, 200, 0);
      rect(-this.w / 4, this.h / 4, 30, 12, 3);
    } else {
      fill(80);
      rect(-this.w / 4, this.h / 4, 30, 12, 3);
    }
    pop();
  }

  inside(px, py) {
    return abs(px - this.x) < this.w / 2 && abs(py - this.y) < this.h / 2;
  }

  startSmelt() {
    if (this.furnaceBusy) return;
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
    this.oxygen = 200;
    this.maxOxygen = 200;
    this.inv = {coal:0, gold:0, uranium:0, blood:0, amancapine:0};
    this.gems = 0;
    this.alive = true;
    this.ropeMax = 320; // medium length
  }

  enterShip(s) {
    this.inShip = true;
    // attach player to ship center
    this.x = s.x + 20;
    this.y = s.y;
    this.vx = 0;
    this.vy = 0;
    this.oxygen = this.maxOxygen; // refills instantly while inside
    // remove rope
    rope = null;
  }

  exitShip() {
    this.inShip = false;
    // when exiting, create rope connecting to ship
    rope = new Rope(ship, this, this.ropeMax);
  }

  update() {
    if (!this.alive) return;

    if (this.inShip) {
      // oxygen refills
      this.oxygen = min(this.maxOxygen, this.oxygen + 1.5);
      // keep player near ship
      this.x = ship.x + 20;
      this.y = ship.y;
    } else {
      // zero-gravity movement via thrusters
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
    }
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

// ------------------ Input handlers ------------------

function keyPressed() {
  if (key === 'E' || key === 'e') {
    if (player.inShip) {
      player.exitShip();
    } else {
      // if near ship, enter
      if (ship.inside(player.x, player.y) || dist(player.x, player.y, ship.x, ship.y) < 60) {
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

  if ((key === '1') && player.inShip) {
    // upgrade rope length (cost 1 gem)
    if (player.gems >= 1) {
      player.gems -= 1;
      // gem doubles upgrade effect: apply 2 levels
      player.ropeMax += 150 * 2;
    }
  }

  if ((key === '2') && player.inShip) {
    if (player.gems >= 1) {
      player.gems -= 1;
      ship.upgradeLevel += 2; // gem doubles upgrade levels
    }
  }
}

function mousePressed() {
  // allow clicking to mine as well
  player.mine();
}

