import {useEffect} from 'react';

let audioContext:AudioContext|undefined;

function context(){
 const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
 if(!AudioContextClass)return;
 audioContext??=new AudioContextClass();
 return audioContext;
}

function chime(){
 const audio=context();if(!audio||audio.state!=='running')return;
 const now=audio.currentTime;
 for(const [delay,frequency] of [[0,660],[.22,825]] as const){
  const oscillator=audio.createOscillator(),gain=audio.createGain();
  oscillator.type='sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,now+delay);gain.gain.exponentialRampToValueAtTime(.16,now+delay+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.19);
  oscillator.connect(gain).connect(audio.destination);oscillator.start(now+delay);oscillator.stop(now+delay+.22);
 }
}

export function useIncomingCallRingtone(active:boolean){
 useEffect(()=>{const unlock=()=>void context()?.resume();window.addEventListener('pointerdown',unlock,{once:true,passive:true});return()=>window.removeEventListener('pointerdown',unlock)},[]);
 useEffect(()=>{if(!active)return;let stopped=false;const play=async()=>{try{await context()?.resume();if(!stopped)chime()}catch{/* The next user interaction retries audio. */}};void play();const timer=window.setInterval(()=>void play(),1600);navigator.vibrate?.([500,250,500]);return()=>{stopped=true;window.clearInterval(timer);navigator.vibrate?.(0)}},[active]);
}
