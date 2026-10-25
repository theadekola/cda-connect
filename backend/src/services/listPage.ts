import {z} from 'zod';
export function listPage(query:Record<string,unknown>){const page=z.coerce.number().int().min(0).max(100000).parse(query.page??0);const size=z.coerce.number().int().min(1).max(100).parse(query.pageSize??50);return{page,size,offset:page*size,paged:query.page!==undefined}}
