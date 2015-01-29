var svgNS = "http://www.w3.org/2000/svg";

var size = parseInt(getComputedStyle(document.querySelector('#box')).width);
var balls;
var prober;
var ballCount = 40;
var ballSize = 6;
var maxSpeed = 1;
var probeInterval = 100;
var offset = parseInt(getComputedStyle(document.body).margin);
var p, s, probes;

var xChange = new Rx.Subject();
var yChange = new Rx.Subject();

xChange.subscribe(function(data) {
  if (classForSVG(data.obstacle) == 'ball') {
    // another ball - naive conservation of momentum, assume no spin
    // first trigger other ball's velocity change
    var currentVel = (-data.direction) * Math.abs(data.ball.xVel);
    data.ball.xVel = data.direction * Math.abs(data.obstacle.ball.xVel);
    data.obstacle.ball.xVel = currentVel;
  } else {
    // wall or other stationary obstacle - reverse velocity
    data.ball.xVel = data.direction * Math.abs(data.ball.xVel);
  }
});

yChange.subscribe(function(data) {
  if (classForSVG(data.obstacle) == 'ball') {
    // another ball - naive conservation of momentum, assume no spin
    // first trigger other ball's velocity change
    var currentVel = (-data.direction) * Math.abs(data.ball.yVel);
    data.ball.xVel = data.direction * Math.abs(data.obstacle.ball.yVel);
    data.obstacle.ball.yVel = currentVel;
  } else {
    // wall or other stationary obstacle - reverse velocity
    data.ball.yVel = data.direction * Math.abs(data.ball.yVel);
  }
});

Ball.prototype.checkCollision = function () {
  for (var i = 0; i < probes.length; i++) {
    var detected = elemAt(this.x + probes[i][0], this.y + probes[i][1]);
    if (!detected || detected.id == 'box') continue;
    var hitABall = classForSVG(detected == 'ball');
    // only check left and top ball hits so we don't check same collision twice
    if (hitABall ? (probes[i][0] < 0) : probes[i][0]) {
      var newDirection = (probes[i][0] < 0) ? 1 : -1;
      xChange.onNext({ball: this, obstacle: detected, direction: newDirection});
    }
    if (hitABall ? (probes[i][1] < 0) : probes[i][1]) {
      var newDirection = (probes[i][1] < 0) ? 1 : -1;
      yChange.onNext({ball: this, obstacle: detected, direction: newDirection});
    }
  }
};

Rx.events.change(count).subscribe(function(data) {
  clearBalls();
  ballCount = parseInt(data.target.value);
  renderBalls();
});

Rx.events.click(slower).subscribe(function(data) {
  clearBalls();
  maxSpeed = maxSpeed/2;
  renderBalls();
});

Rx.events.click(faster).subscribe(function(data) {
  clearBalls();
  maxSpeed = maxSpeed + 0.5;
  renderBalls();
});

Rx.events.click(liner).subscribe(function(data) {
  var bound = 400, length = 50;
  var x1 = Math.random()*bound;
  var y1 = Math.random()*bound;
  if (Math.random() > 0.5) {
    x2 = Math.min(x1 + length, bound);
    y2 = y1;
  } else {
    x2 = x1
    y2 = Math.min(y1 + length, bound);
  }

  line(x1, y1, x2, y2, 2);
});

Rx.events.change(sizer).subscribe(function(data) {
  clearBalls();
  ballSize = parseInt(data.target.value);
  setupProbes();
  renderBalls();
});

function circle(x, y, radius, color) {
  var c = document.createElementNS(svgNS, "circle");
  c.setAttribute("class", 'ball');
  c.setAttributeNS(null, "cx", x);
  c.setAttributeNS(null, "cy", y);
  c.setAttributeNS(null, "r", radius);
  c.setAttributeNS(null, "fill", color);
  document.querySelector('#box').appendChild(c);
  return c;
}

function line(x1, y1, x2, y2, thickness) {
  var l = document.createElementNS(svgNS, "line");
  l.setAttribute("class", 'line');
  l.setAttributeNS(null, "x1", x1);
  l.setAttributeNS(null, "y1", y1);
  l.setAttributeNS(null, "x2", x2);
  l.setAttributeNS(null, "y2", y2);
  l.setAttributeNS(null, "stroke", "#000");
  l.setAttributeNS(null, "stroke-width", thickness);
  document.querySelector('#box').appendChild(l);
  return l;
}


function Ball (xVel, yVel, magic, id) {
  this.x = size*Math.random();
  this.y = size*Math.random();
  this.xVel = xVel;
  this.yVel = yVel;
  this.magic = magic;
  this.id = id;
};

Ball.prototype.draw = function () {
  this.node = circle(this.x, this.y, ballSize, this.magic ? 'red' : 'blue');
  this.node.ball = this;
};

Ball.prototype.move = function () {
  this.node.setAttributeNS(null, "cx", this.x += this.xVel);
  this.node.setAttributeNS(null, "cy", this.y += this.yVel);
};

function elemAt(x, y) {
  return document.elementFromPoint(x + offset, y + offset);
}

function classForSVG(elem) {
  return elem.className && elem.className.baseVal;
}

function renderBalls() {
  balls = [];
  for (var i = 1; i <= ballCount; i++) {
    balls[i] = new Ball(
      maxSpeed - (maxSpeed * 2) * Math.random(),
      maxSpeed - (maxSpeed * 2) * Math.random(),
      i == 1,
      i
    );
    balls[i].draw();
  }
}

function clearBalls() {
  if (!window.balls) return;
  for (var i = 1; i <= ballCount; i++) {
    balls[i].node.parentNode && balls[i].node.parentNode.removeChild(balls[i].node);
  }
}

function checkCollisions() {
  for (var i = 1; i <= ballCount; i++) {
    balls[i].checkCollision();
  }
}

function moveAll(recurse) {
  for (var i = 1; i <= ballCount; i++) {
    balls[i].move();
  }
  recurse();
}

function init() {
  renderBalls();
  setupProbes();
  prober = Rx.Observable.interval(probeInterval).subscribe(checkCollisions);

  Rx.Scheduler.requestAnimationFrame.scheduleRecursive(moveAll);
}

function setupProbes() {
  p = ballSize + 4; // (n, s, e, w)
  s = Math.pow((ballSize*ballSize/2), 0.5) + 2; // (ne, se etc.)
  // w, e, s, n, se, ne, nw, sw
  probes = [[p,0],[-p,0],[0,p],[0,-p],[s,s],[-s,-s],[s,-s],[-s, s]];
}

init();
