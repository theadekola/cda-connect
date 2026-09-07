const storage=typeof window==='undefined'?null:window.localStorage;
const BrowserStorage={
  async getItem(key:string){return storage?.getItem(key)??null},
  async setItem(key:string,value:string){storage?.setItem(key,value)},
  async removeItem(key:string){storage?.removeItem(key)},
};
export default BrowserStorage;
