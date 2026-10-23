import type {Plugin} from 'vite';
export type ReleaseMetadata={schema:number;sourceId:string;version:string};
export function sourceFingerprint(root:string):string;
export function releaseMetadata(root:string):ReleaseMetadata;
export function releasePlugin(metadata:ReleaseMetadata):Plugin;
