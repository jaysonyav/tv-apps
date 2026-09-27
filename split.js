// Split-screen YouTube player for a Samsung TV.
// URL params: left / right = a YouTube video ID, or "list:<playlistId>".
//   e.g. split.html?left=list:PLxxxx&right=aqz-KE-bpKQ&diag=1
// Controlled by keyboard/remote keys directly, or by postMessage({cmd}) from the TV app shell.

var DEFAULTS = { left: "aqz-KE-bpKQ", right: "M7lc1UVf-VE" };
var SIDES = ["left", "right"];
var players = {};
var active = "left";
var fullSide = null;
var lastOk = 0;
var diagEl = document.getElementById("diag");
var hintEl = document.getElementById("hint");
var diagLines = [];

function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
}

var showDiag = param("diag") === "1";
if (!showDiag) diagEl.style.display = "none";
setTimeout(function () { hintEl.style.display = "none"; }, 8000);

function log(msg) {
    if (!showDiag || diagLines[diagLines.length - 1] === msg) return;
    diagLines.push(msg);
    diagEl.textContent = "Page: " + location.origin + "\n" + diagLines.slice(-7).join("\n");
}

function sourceFor(side) {
    var v = param(side) || DEFAULTS[side];
    if (v.indexOf("list:") === 0) return { list: v.slice(5) };
    return { video: v };
}

var STATE_NAMES = { "-1": "unstarted", "0": "ended", "1": "PLAYING", "2": "paused", "3": "buffering", "5": "cued" };

function onYouTubeIframeAPIReady() {
    SIDES.forEach(function (side) {
        var src = sourceFor(side);
        var vars = { autoplay: 1, mute: 1, controls: 1, playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin };
        if (src.list) {
            vars.listType = "playlist";
            vars.list = src.list;
        }
        players[side] = new YT.Player("player-" + side, {
            width: "100%",
            height: "100%",
            videoId: src.video,
            playerVars: vars,
            events: {
                onReady: function (e) {
                    log(side + ": ready");
                    e.target.playVideo();
                    applyAudio();
                },
                onStateChange: function (e) { log(side + ": " + (STATE_NAMES[e.data] || e.data)); },
                onError: function (e) { log(side + ": ERROR " + e.data); }
            }
        });
    });
}

function applyAudio() {
    SIDES.forEach(function (side) {
        var p = players[side];
        if (!p || !p.mute) return;
        if (side === active) {
            p.unMute();
            p.setVolume(100);
        } else {
            p.mute();
        }
    });
}

function setActive(side) {
    if (fullSide) return;
    active = side;
    SIDES.forEach(function (s) {
        document.getElementById(s).className = "pane" + (s === active ? " active" : "");
    });
    applyAudio();
}

function toggleFull() {
    var other = active === "left" ? "right" : "left";
    if (fullSide) {
        fullSide = null;
        document.getElementById(active).className = "pane active";
        document.getElementById(other).className = "pane";
        if (players[other] && players[other].playVideo) players[other].playVideo();
    } else {
        fullSide = active;
        document.getElementById(active).className = "pane full";
        document.getElementById(other).className = "pane hidden";
        if (players[other] && players[other].pauseVideo) players[other].pauseVideo();
    }
    applyAudio();
}

function togglePlay() {
    var p = players[active];
    if (!p || !p.getPlayerState) return;
    if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo();
}

function handle(cmd) {
    var p = players[active];
    switch (cmd) {
        case "left": setActive("left"); break;
        case "right": setActive("right"); break;
        case "ok":
            var now = new Date().getTime();
            if (now - lastOk < 450) {
                togglePlay();
                toggleFull();
                lastOk = 0;
            } else {
                togglePlay();
                lastOk = now;
            }
            break;
        case "next": if (p && p.nextVideo) p.nextVideo(); break;
        case "prev": if (p && p.previousVideo) p.previousVideo(); break;
        case "back":
            if (fullSide) { toggleFull(); return true; }
            return false;
    }
    return true;
}

window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object" || !d.tvcmd) return;
    var handled = handle(d.tvcmd);
    if (d.tvcmd === "back" && e.source) e.source.postMessage({ tvback: handled }, "*");
});

var KEYMAP = { 37: "left", 39: "right", 13: "ok", 38: "next", 40: "prev", 10009: "back", 415: "ok", 19: "ok", 10252: "ok" };
document.addEventListener("keydown", function (e) {
    var cmd = KEYMAP[e.keyCode];
    if (cmd) {
        handle(cmd);
        e.preventDefault();
    }
});
