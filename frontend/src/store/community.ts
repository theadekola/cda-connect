import {create} from 'zustand'; import type {Community} from '../types';
export const useCommunity=create<{current:Community|null;setCurrent:(c:Community|null)=>void}>((set)=>({current:null,setCurrent:current=>set({current})}));
