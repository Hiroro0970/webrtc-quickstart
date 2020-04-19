"use strict";
const constraits = {
  video: true,
  audio: true,
};

const configuration = [{
  urls: [
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
  ]
}]

let localStream;
let remoteStream;
let peerConnection;

const localVideoElem = document.getElementById("local-video");
const remoteVideoElem = document.getElementById("remote-video");
const cameraBtn = document.getElementById("camera-btn");
const callBtn = document.getElementById("call-btn");
const hangupBtn = document.getElementById("hangup-btn");
const currentRoomTxt = document.getElementById('currentRoom')

/**
 * メディアへのアクセスを行い、自身と接続先のメディアを出力する
 */
function openUserMedia() {
  localStream = await navigator.mediaDevices.getUserMedia(constraits);
  localVideoElem.srcObject = localStream;

  remoteStream = new MediaStream();
  remoteVideoElem.srcObject = remoteStream;
}

/**
 * Roomを作成する
 * RTCを行うにはRTCSessionDescription情報を共有する必要があり、そのうちcaller(roomのホスト)が"offer"を生成して
 * Firestoreに保管する
 */
function createRoom() {
  const db = firebase.firestore();

  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListners();

  const offer = await peerConnection.createOffer()

  // 自身のRTCPeerConnectionにoffer情報をセットする
  await peerConnection.setLocalDescription(offer);

  const roomWithOffer = {
    offer : {
      type : offer.type,
      sdp: offer.sdp
    }
  }

  const roomRef = await db.collection('rooms').add(roomWithOffer);
  const roomId = roomRef.id;
  currentRoomTxt.innerText = `current room is ${roomId} - You are the caller!`

  // ここでcameraおよびaudioの情報を配信している
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // calleeが"answer"を保管したら処理が走る
  roomRef.onSnapshot(async snapshot => {
    console.log('Got updated room:', snapshot.data());
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data.answer) {
        console.log('Set remote description: ', data.answer);
        const answer = new RTCSessionDescription(data.answer)
        await peerConnection.setRemoteDescription(answer);
    }
  });

  // リモート側のcamera及びaudioの情報を配信する
  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });
}

/**
 * Roomに参加するためのID入力画面を表示
 */
function joinRoom() {
  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
      }, {once: true});
  roomDialog.open();
}

/**
 * 入力したRoomIDに合致する部屋に参加する
 * ここではcallee(roomのゲスト)が"answer"を生成してFirestoreに追加する
 * 
 * @param {*} id 
 */
async function joinRoomById(id) {
  const db = firebase.firestore()
  const roomRef = db.collection('rooms').doc(id);
  const roomSnapshot = await roomRef.get();

  if(roomSnapshot.exists) {
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListners();

    // ここでcameraおよびaudioの情報を配信している
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // callee側では"offer"をRemoteDescriptionにセットする
    const offer = roomSnapshot.data().offer;
    await peerConnection.setRemoteDescription(offer);

    // callee側では"answer"をLocalDescriptionにセットする
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      }
    }
    roomRef.update(roomWithAnswer)

    // リモート側のcamera及びaudioの情報を配信する
    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });
  }
}