export function speak(text:string,options:any={}){const utterance=new SpeechSynthesisUtterance(text);Object.assign(utterance,options);speechSynthesis.speak(utterance)}
export function stop(){speechSynthesis.cancel()}
export function isSpeakingAsync(){return Promise.resolve(speechSynthesis.speaking)}
