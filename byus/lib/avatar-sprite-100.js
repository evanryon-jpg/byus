import part0 from './avatar-sprite-0';
import part1 from './avatar-sprite-1';
import part2 from './avatar-sprite-2';

// The verified 384×240 WebP is split across modules to keep each GitHub
// contents write comfortably below transport limits. Concatenation restores
// the original base64 stream byte-for-byte.
export default part0 + part1 + part2;
