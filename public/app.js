"use strict";
const constraits = {
  video: true,
  audio: true,
};

const configuration = [
  {
    urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
  },
];

let localStream;
let remoteStream;
let peerConnection;

const localVideoElem = document.getElementById("local-video");
const remoteVideoElem = document.getElementById("remote-video");
const cameraBtn = document.getElementById("camera-btn");
const callBtn = document.getElementById("call-btn");
const hangupBtn = document.getElementById("hangup-btn");
