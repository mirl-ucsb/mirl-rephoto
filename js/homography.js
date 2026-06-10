/* homography.js — fit and apply a projective transform (a homography) from
   matched point pairs. This is what lets one photograph be warped onto the
   viewpoint of another, or a slanted facade be squared to a flat elevation.

   Pure vanilla JS, no dependencies. A 3x3 homography is stored as a flat
   row-major array of nine numbers. */

window.MR = window.MR || {};

MR.Homography = (function () {

  function mat3mul(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      let s = 0; for (let k = 0; k < 3; k++) s += A[r * 3 + k] * B[k * 3 + c];
      C[r * 3 + c] = s;
    }
    return C;
  }
  function mat3inv(M) {
    const a = M[0], b = M[1], c = M[2], d = M[3], e = M[4], f = M[5], g = M[6], h = M[7], i = M[8];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
    const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    const det = a * A + b * B + c * C, id = 1 / det;
    return [A * id, D * id, G * id, B * id, E * id, H * id, C * id, F * id, I * id];
  }
  function apply(H, p) {
    const x = p[0], y = p[1];
    const X = H[0] * x + H[1] * y + H[2];
    const Y = H[3] * x + H[4] * y + H[5];
    const W = H[6] * x + H[7] * y + H[8];
    return [X / W, Y / W];
  }

  /* solve an n x n system by Gaussian elimination with partial pivoting */
  function gauss(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat(b[i]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) return null;
      [M[col], M[piv]] = [M[piv], M[col]];
      const pv = M[col][col];
      for (let j = col; j <= n; j++) M[col][j] /= pv;
      for (let r = 0; r < n; r++) {
        if (r === col || !M[r][col]) continue;
        const fct = M[r][col];
        for (let j = col; j <= n; j++) M[r][j] -= fct * M[col][j];
      }
    }
    return M.map(row => row[n]);
  }

  /* Hartley normalization: centre on the origin, scale to mean distance sqrt(2) */
  function normalize(pts) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= pts.length; cy /= pts.length;
    let d = 0;
    for (const p of pts) d += Math.hypot(p[0] - cx, p[1] - cy);
    d /= pts.length;
    const s = d > 1e-9 ? Math.SQRT2 / d : 1;
    return { T: [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1], np: pts.map(p => [s * (p[0] - cx), s * (p[1] - cy)]) };
  }

  /* fit H mapping src -> dst from >= 4 pairs (least squares for more) */
  function compute(src, dst) {
    if (!src || src.length < 4 || src.length !== dst.length) return null;
    const ns = normalize(src), nd = normalize(dst);
    const S = ns.np, D = nd.np;
    const n = 8;
    const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
    const Atb = new Array(n).fill(0);
    for (let k = 0; k < S.length; k++) {
      const x = S[k][0], y = S[k][1], X = D[k][0], Y = D[k][1];
      const rows = [
        [x, y, 1, 0, 0, 0, -x * X, -y * X, X],
        [0, 0, 0, x, y, 1, -x * Y, -y * Y, Y],
      ];
      for (const row of rows) {
        for (let r = 0; r < n; r++) {
          Atb[r] += row[r] * row[n];
          for (let c = 0; c < n; c++) AtA[r][c] += row[r] * row[c];
        }
      }
    }
    const z = gauss(AtA, Atb);
    if (!z) return null;
    const Hn = [z[0], z[1], z[2], z[3], z[4], z[5], z[6], z[7], 1];
    let H = mat3mul(mat3inv(nd.T), mat3mul(Hn, ns.T));
    const inv = 1 / H[8];
    return H.map(v => v * inv);
  }

  function residualRMS(H, src, dst) {
    let s = 0;
    for (let k = 0; k < src.length; k++) {
      const p = apply(H, src[k]);
      s += (p[0] - dst[k][0]) ** 2 + (p[1] - dst[k][1]) ** 2;
    }
    return Math.sqrt(s / src.length);
  }

  /* CSS transform for an element whose local coords are the SOURCE pixels */
  function toMatrix3d(H) {
    const a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7], i = H[8];
    return 'matrix3d(' + [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i].join(',') + ')';
  }

  return { compute, apply, residualRMS, toMatrix3d, mat3mul, mat3inv };
})();
