import { renderTo2dContext } from './canvas-2d-context.render.js'

/**
 *
 * @param {object} opts - function parameters
 * @param {number} [opts.cellSize] - cell size in pixels, defaults to 2
 * @param {number} [opts.margin] - margin in pixels, defaults to {@link cellSize} * 4
 * @param {import('../qr-code.js').QrCode} opts.qrcode - QR Code data
 * @returns {string} data url of qr code image
 */
export function createDataURL ({ cellSize = 2, margin, qrcode }) {
  margin ??= cellSize * 4

  const size = qrcode.moduleCount * cellSize + margin * 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    return ''
  }
  context.translate(margin, margin)
  renderTo2dContext({ context, cellSize, qrcode })
  return canvas.toDataURL('image/png', 1.0)
};
