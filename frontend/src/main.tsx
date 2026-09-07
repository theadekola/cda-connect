import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {registerSW} from 'virtual:pwa-register';
import RootLayout from '../app/_layout';
import './web.css';

const updateServiceWorker=registerSW({
  immediate:true,
  onNeedRefresh(){
    void updateServiceWorker(true);
  },
});

class AppErrorBoundary extends React.Component<React.PropsWithChildren,{error:Error|null}>{
  state={error:null as Error|null};
  static getDerivedStateFromError(error:Error){return {error}}
  render(){return this.state.error?<main style={{padding:32,fontFamily:'system-ui',background:'#EEF3F8',minHeight:'100vh'}}><h1>CDA Connect could not start</h1><pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre></main>:this.props.children}
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppErrorBoundary><BrowserRouter><RootLayout/></BrowserRouter></AppErrorBoundary></React.StrictMode>,
);
