import test,{after} from 'node:test';
import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {localWeather}=await import('../dist/services/weather.js');
const originalFetch=globalThis.fetch;
after(()=>{globalThis.fetch=originalFetch});
const now=Math.floor(Date.now()/1000),hour=Math.floor(now/3600)*3600;
function payload(probability=70){return {current:{time:now,temperature_2m:12.5,weather_code:63,is_day:1},hourly:{time:[hour,hour+3600,hour+7200],precipitation_probability:[10,probability,90]}}}
test('weather rejects invalid coordinates before making provider calls',async()=>{let calls=0;globalThis.fetch=async()=>{calls++;throw Error()};for(const p of [{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:'0',longitude:0},{}])await assert.rejects(localWeather(p));assert.equal(calls,0)});
test('weather rounds location, selects matching hour and caches a successful result',async()=>{let calls=0;globalThis.fetch=async url=>{calls++;assert.equal(url.searchParams.get('latitude'),'51.51');assert.equal(url.hostname,'api.open-meteo.com');return Response.json(payload())};const p={latitude:51.5074,longitude:-.1278};const result=await localWeather(p);assert.equal(result.rainChance,70);assert.equal(result.temperature,12.5);assert.equal(result.code,63);assert.equal((await localWeather(p)).updatedAt,result.updatedAt);assert.equal(calls,1)});
test('missing probability stays unavailable instead of becoming zero',async()=>{globalThis.fetch=async()=>Response.json(payload(null));assert.equal((await localWeather({latitude:52,longitude:0})).rainChance,null)});
test('provider failure, invalid values and stale weather return a safe unavailable error',async()=>{for(const [i,data] of [{}, {...payload(),current:{...payload().current,time:now-10000}}, {...payload(),current:{...payload().current,temperature_2m:null}}].entries()){globalThis.fetch=async()=>Response.json(data);await assert.rejects(localWeather({latitude:53+i,longitude:0}),e=>e.status===503&&!e.message.includes('apikey'))}globalThis.fetch=async()=>new Response('',{status:429});await assert.rejects(localWeather({latitude:60,longitude:0}),e=>e.status===503)});
