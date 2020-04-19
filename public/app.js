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

function init() {
  document.querySelector("#cameraBtn").addEventListener("click", openUserMedia);
  document.querySelector("#hangupBtn").addEventListener("click", hangUp);
  document.querySelector("#createBtn").addEventListener("click", createRoom);
  document.querySelector("#joinBtn").addEventListener("click", joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector("#room-dialog"));
}
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

  await collectICECandidates(roomRef, peerConnection, "host", "guest");

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
/**
 * 通話を切る
 * RTCPeerConnectionを切断し、firestore内のシグナリング情報を削除する
 * @param {*} e
 */
async function hangUp(e) {
  const tracks = document.querySelector("#localVideo").srcObject.getTracks();
  tracks.forEach((track) => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector("#localVideo").srcObject = null;
  document.querySelector("#remoteVideo").srcObject = null;
  document.querySelector("#cameraBtn").disabled = false;
  document.querySelector("#joinBtn").disabled = true;
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#hangupBtn").disabled = true;
  document.querySelector("#currentRoom").innerText = "";

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection("rooms").doc(roomId);
    const calleeCandidates = await roomRef.collection("calleeCandidates").get();
    calleeCandidates.forEach(async (candidate) => {
      await candidate.delete();
    });
    const callerCandidates = await roomRef.collection("callerCandidates").get();
    callerCandidates.forEach(async (candidate) => {
      await candidate.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

/**
 * ICE(Internet Connectivity Establishment) candidates情報を取得する。
 * RTCPeerConnectionを使ってメディアのやり取りするには事前にConectivity情報が必要となる。
 *
 * @param {*} roomRef Firestoreのroomsコレクション
 * @param {*} peerConneciton
 * @param {*} localName 自身(local)側のname
 * @param {*} remoteName 相手(remote)側のname
 */
  async function collectICECandidates(roomRef, peerConneciton, localName, remoteName) {
  const candidatesCollection = roomRef.collection(localName);

  // 自身(local)のcandidates情報をFirestoreに保管する
    peerConnection.addEventListener('icecandidate', event => {
    if (event.candidate) {
      const json = event.candidate.toJSON();
      candidatesCollection.add(json);
    }
  });

  // 相手(remote)のcandidates情報を自身のRTCPeerConnectionに追加する
    roomRef.collection(remoteName).onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConneciton.addIceCandidate(candidate);
      }
    });
    })
}

}