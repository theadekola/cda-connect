import type {Response} from 'express';
// Public uploads and access-checked temporary media links are embedded by native WebViews.
// Apply only to these media responses; retain Helmet's same-origin policy elsewhere.
export function allowMediaEmbedding(res:Pick<Response,'setHeader'>){
 res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
}
