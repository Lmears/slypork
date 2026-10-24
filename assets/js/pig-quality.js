import { FrameQuality } from './frame-quality.js';

// Touch devices start conservatively; sustained headroom can restore full fidelity.
export const PIG_QUALITY = [
    { pixelRatio: 2, model: 'full' },
    { pixelRatio: 1.5, model: 'full' },
    { pixelRatio: 1.25, model: 'medium' },
    { pixelRatio: 1, model: 'low' },
    { pixelRatio: 0.75, model: 'low' },
];

export class PigQuality extends FrameQuality {
    constructor({ coarsePointer = false } = {}) {
        super(PIG_QUALITY.length, coarsePointer ? 3 : 0);
    }
}
