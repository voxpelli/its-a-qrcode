import { PATTERN_POSITION_TABLE } from './pattern-position-table.constants.js'
import { MODE_8BIT_BYTE, MODE_ALPHA_NUM, MODE_KANJI, MODE_NUMBER } from '../modes/mode-bits.constants.js'

/**
 * Get BCH code digit
 * @param {number} data - numeric data
 */
function getBCHDigit (data) {
  let digit = 0
  while (data !== 0) {
    digit += 1
    data >>>= 1
  }
  return digit
};

const G15 = 0b000010100110111
const G18 = 0b001111100100101
const G15_MASK = 0b101010000010010

/**
 * Get type info using Reed–Solomon error correction with Bose–Chaudhuri–Hocquenghem codes (BCH codes)
 * @param {number} data - masked error Correction Level info
 * @returns {number} bits of BHC code of type info
 */
export function getBCHTypeInfo (data) {
  let d = data << 10
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15)))
  }
  return ((data << 10) | d) ^ G15_MASK
};

/**
 * @param {number} data - QR code version
 * @returns {number} bits of BHC code of QR code version
 */
export function getBCHTypeNumber (data) {
  let d = data << 12
  while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
    d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18)))
  }
  return (data << 12) | d
};

/**
 * @param {number} typeNumber - QR code version
 * @returns {readonly number[]} pattern positions
 */
export const getPatternPosition = (typeNumber) => PATTERN_POSITION_TABLE[typeNumber - 1]

/** @type {((i: number, j: number) => boolean)[]} */
const maskPatternFunctions = [
  (i, j) => (i + j) % 2 === 0, // QRMaskPattern.PATTERN000
  (i, _) => i % 2 === 0, // QRMaskPattern.PATTERN001
  (_, j) => j % 3 === 0, // QRMaskPattern.PATTERN010
  (i, j) => (i + j) % 3 === 0, // QRMaskPattern.PATTERN011
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, // QRMaskPattern.PATTERN100
  (i, j) => (i * j) % 2 + (i * j) % 3 === 0, // QRMaskPattern.PATTERN101
  (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0, // QRMaskPattern.PATTERN110
  (i, j) => ((i * j) % 3 + (i + j) % 2) % 2 === 0, // QRMaskPattern.PATTERN110
]

/**
 * @param {number} maskPattern - mask pattern value
 * @returns {((i: number, j: number) => boolean)} mask pattern function
 */
export function getMaskFunction (maskPattern) {
  const result = maskPatternFunctions[maskPattern]
  if (!result) {
    throw Error(`bad maskPattern: ${maskPattern}`)
  }
  return result
};

/**
 * Get bit length to write on QR code data
 * @param {number} mode - mode balue
 * @param {number} type - qr version
 * @returns {number} bit length
 */
export function getLengthInBits (mode, type) {
  if (type >= 1 && type < 10) { // 1 - 9
    switch (mode) {
      case MODE_NUMBER : return 10
      case MODE_ALPHA_NUM : return 9
      case MODE_8BIT_BYTE : return 8
      case MODE_KANJI : return 8
      default :
        throw Error(`invalid mode: ${mode}`)
    }
  } else if (type < 27) { // 10 - 26
    switch (mode) {
      case MODE_NUMBER : return 12
      case MODE_ALPHA_NUM : return 11
      case MODE_8BIT_BYTE : return 16
      case MODE_KANJI : return 10
      default :
        throw Error(`invalid mode: ${mode}`)
    }
  } else if (type < 41) { // 27 - 40
    switch (mode) {
      case MODE_NUMBER : return 14
      case MODE_ALPHA_NUM : return 13
      case MODE_8BIT_BYTE : return 16
      case MODE_KANJI : return 12
      default :
        throw Error(`invalid mode: ${mode}`)
    }
  } else {
    throw Error(`invalid type: ${type}`)
  }
};