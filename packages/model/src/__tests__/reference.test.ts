import { expect,it } from 'vitest';
import { fourierEncode } from '../index.js';
it('fourier encoding includes raw feature and sin/cos bands',()=>expect(fourierEncode([1],2)).toHaveLength(5));
