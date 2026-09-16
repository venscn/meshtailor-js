import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();try{const {checkUVTriangles}=await c.load('packages/uv/src/index.js');
// Actual rejected similarity-join candidate from the hash-pinned FlightHelmet.
const sliver=[[[0.20365423757388756, 0.003112705553680298], [0.19905460872146002, 0.012099013551650429], [0.16466246114386146, 0.013618667981330011]], [[0.1646624611008836, 0.013618667996352599], [0.1604869176476238, 0.006014504801588175], [0.20365423751372339, 0.0031127055716383733]]];
assert.equal(checkUVTriangles(sliver).overlaps,1);
for(const scale of [1e-3,1,1e3])assert.equal(checkUVTriangles(sliver.map(t=>t.map(p=>[p[0]*scale+3,p[1]*scale-2]))).overlaps,1);
const contact=[[[0,0],[1,0],[0,1]],[[1,0],[1,1],[0,1]]];
assert.ok(checkUVTriangles(contact).valid);assert.equal(checkUVTriangles(contact).overlaps,0);
assert.equal(checkUVTriangles([contact[0],contact[0]]).overlaps,1);
assert.equal(checkUVTriangles([contact[0],contact[1].map(p=>[p[0]+1e-8,p[1]+1e-8])]).overlaps,0);
console.log('PASS: 8 thin-sliver/contact quality checks');
}finally{await c.cleanup();}
