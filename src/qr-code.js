import { getRSBlocks } from "./utils/qr-rs-block.utils.js";
import { fromString } from "./utils/qr-rs-correction-level.constants.js";
import * as QRUtil from './utils/qr-util.js'
import { createData } from "./utils/create-data.util.js";
import { QrKanji } from "./modes/kanji.mode.js";
import { Qr8BitByte } from "./modes/byte.mode.js";
import { QrNumber } from "./modes/number.mode.js";
import { QrAlphaNum } from "./modes/alphanum.mode.js";
import { QrBitBuffer } from "./utils/qr-bit-buffer.js";



export class QrCode {
  /** @type {number} */
  typeNumber = 0

  /** @type {number} */

  errorCorrectionLevel
  moduleCount
  modules
  /** @type {number[] | null} */
  #dataCache
  /** @type {(QrKanji | Qr8BitByte | QrNumber | QrAlphaNum)[] } */
  dataList
  
  /**
   * @param {number} typeNumber
   * @param { "L" | 'M' | 'Q' | 'H'} errorCorrectionLevel
   */
  constructor(typeNumber, errorCorrectionLevel){
    this.typeNumber = typeNumber;
    this.errorCorrectionLevel = fromString(errorCorrectionLevel).bit;
    this.moduleCount = 0
    this.modules = createModuleTable(this.moduleCount)
    this.#dataCache = null
    this.dataList = []

  }

  /**
   * 
   * @param {boolean} test 
   * @param {number} maskPattern 
   */
  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17

    const moduleCount = this.moduleCount
    this.modules = createModuleTable(moduleCount)

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(moduleCount - 7, 0);
    this.setupPositionProbePattern(0, moduleCount - 7);
    setupPositionAdjustPattern(this);
    this.setupTimingPattern();
    setupTypeInfo(test, maskPattern, this);

    if (this.typeNumber >= 7) {
      setupTypeNumber(test, this);
    }

    if (this.#dataCache == null) {
      this.#dataCache = createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
    }

    mapData(this.#dataCache, maskPattern, this);
  };


  /**
   * 
   * @param {number} row 
   * @param {number} col 
   */
  setupPositionProbePattern(row , col) {
    const {modules, moduleCount} = this
  
    for (var r = -1; r <= 7; r += 1) {

      if (row + r <= -1 || moduleCount <= row + r) continue;

      for (var c = -1; c <= 7; c += 1) {

        if (col + c <= -1 || moduleCount <= col + c) continue;

        if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
            || (0 <= c && c <= 6 && (r == 0 || r == 6) )
            || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
          modules[row + r][col + c] = true;
        } else {
          modules[row + r][col + c] = false;
        }
      }
    }
  };

  setupTimingPattern() {
    const {modules, moduleCount} = this

    for (var r = 8; r < moduleCount - 8; r += 1) {
      if (modules[r][6] != null) {
        continue;
      }
      modules[r][6] = (r % 2 == 0);
    }

    for (var c = 8; c < moduleCount - 8; c += 1) {
      if (modules[6][c] != null) {
        continue;
      }
      modules[6][c] = (c % 2 == 0);
    }
  };


  /**
   * 
   * @param {number} row 
   * @param {number} col 
   */
  isDark(row, col) {
    const {modules, moduleCount} = this

    if (row < 0 || moduleCount <= row || col < 0 || moduleCount <= col) {
      throw row + ',' + col;
    }
    return modules[row][col];
  };

  /**
   * 
   * @param {string} data 
   * @param {'Byte'|'Numeric'|'Alphanumeric'|'Kanji'} mode 
   */
  addData(data, mode) {
  
    mode = mode || 'Byte';

    var newData = null;

    switch(mode) {
    case 'Numeric' :
      newData = new QrNumber(data);
      break;
    case 'Alphanumeric' :
      newData = new QrAlphaNum(data);
      break;
    case 'Byte' :
      newData = new Qr8BitByte(data);
      break;
    case 'Kanji' :
      newData = new QrKanji(data);
      break;
    default :
      throw 'mode:' + mode;
    }

    this.dataList.push(newData);
    this.#dataCache = null;
  };



  make() {

    const {modules, errorCorrectionLevel, dataList} = this

    if (this.typeNumber < 1) {
      var typeNumber = 1;

      for (; typeNumber < 40; typeNumber++) {
        var rsBlocks = getRSBlocks(typeNumber, errorCorrectionLevel);
        var buffer = new QrBitBuffer();

        for (var i = 0; i < dataList.length; i++) {
          var data = dataList[i];
          buffer.put(data.mode, 4);
          buffer.put(data.length, QRUtil.getLengthInBits(data.mode, typeNumber) );
          data.write(buffer);
        }

        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount;
        }

        if (buffer.bitLength <= totalDataCount * 8) {
          break;
        }
      }

      this.typeNumber = typeNumber;
    }

    this.makeImpl(false, getBestMaskPattern(this) );



  };



}

/**
 * 
 * @param {number} moduleCount 
 * @returns {boolean[][]}
 */
function createModuleTable(moduleCount){
  var modules = new Array(moduleCount);
  for (var row = 0; row < moduleCount; row += 1) {
    modules[row] = new Array(moduleCount).fill(null)
  }
  return modules;
}

/**
 * 
 * @param {QrCode} qrcode 
 * @returns {number}
 */
var getBestMaskPattern = function(qrcode) {
  
  let minLostPoint = 0;
  let pattern = 1
  for (let i = 0; i < 8; i += 1) {

    qrcode.makeImpl(true, i);

    var lostPoint = getLostPoint(qrcode);

    if (i == 0 || minLostPoint > lostPoint) {
      minLostPoint = lostPoint;
      pattern = i;
    }
  }

  return pattern;
};


/**
 * 
 * @param {QrCode} qrcode 
 */
var setupPositionAdjustPattern = function(qrcode) {
  const {modules} = qrcode
  
  var pos = QRUtil.getPatternPosition(qrcode.typeNumber);

  for (var i = 0; i < pos.length; i += 1) {

    for (var j = 0; j < pos.length; j += 1) {

      var row = pos[i];
      var col = pos[j];

      if (modules[row][col] != null) {
        continue;
      }

      for (var r = -2; r <= 2; r += 1) {

        for (var c = -2; c <= 2; c += 1) {

          if (r == -2 || r == 2 || c == -2 || c == 2
              || (r == 0 && c == 0) ) {
            modules[row + r][col + c] = true;
          } else {
            modules[row + r][col + c] = false;
          }
        }
      }
    }
  }
};

/**
 * 
 * @param {boolean} test 
 * @param {QrCode} qrcode 
 */
var setupTypeNumber = function(test, qrcode) {
  const {typeNumber, modules, moduleCount} = qrcode

  var bits = QRUtil.getBCHTypeNumber(typeNumber);

  for (var i = 0; i < 18; i += 1) {
    var mod = (!test && ( (bits >> i) & 1) == 1);
    modules[Math.floor(i / 3)][i % 3 + moduleCount - 8 - 3] = mod;
  }

  for (var i = 0; i < 18; i += 1) {
    var mod = (!test && ( (bits >> i) & 1) == 1);
    modules[i % 3 + moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
  }
};

/**
 * 
 * @param {number[]} data 
 * @param {number} maskPattern 
 * @param {QrCode} qrcode 
 */
var mapData = function(data, maskPattern, qrcode) {
  const {moduleCount, modules} = qrcode
  
  var inc = -1;
  var row = moduleCount - 1;
  var bitIndex = 7;
  var byteIndex = 0;
  var maskFunc = QRUtil.getMaskFunction(maskPattern);

  for (var col = moduleCount - 1; col > 0; col -= 2) {

    if (col == 6) col -= 1;

    while (true) {

      for (var c = 0; c < 2; c += 1) {

        if (modules[row][col - c] == null) {

          var dark = false;

          if (byteIndex < data.length) {
            dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
          }

          var mask = maskFunc(row, col - c);

          if (mask) {
            dark = !dark;
          }

          modules[row][col - c] = dark;
          bitIndex -= 1;

          if (bitIndex == -1) {
            byteIndex += 1;
            bitIndex = 7;
          }
        }
      }

      row += inc;

      if (row < 0 || moduleCount <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
};

/**
 * 
 * @param {QrCode} qrcode 
 */
export function getLostPoint(qrcode) {

  var moduleCount = qrcode.moduleCount;

  var lostPoint = 0;

  // LEVEL1

  for (var row = 0; row < moduleCount; row += 1) {
    for (var col = 0; col < moduleCount; col += 1) {

      var sameCount = 0;
      var dark = qrcode.isDark(row, col);

      for (var r = -1; r <= 1; r += 1) {

        if (row + r < 0 || moduleCount <= row + r) {
          continue;
        }

        for (var c = -1; c <= 1; c += 1) {

          if (col + c < 0 || moduleCount <= col + c) {
            continue;
          }

          if (r == 0 && c == 0) {
            continue;
          }

          if (dark == qrcode.isDark(row + r, col + c) ) {
            sameCount += 1;
          }
        }
      }

      if (sameCount > 5) {
        lostPoint += (3 + sameCount - 5);
      }
    }
  };

  // LEVEL2

  for (var row = 0; row < moduleCount - 1; row += 1) {
    for (var col = 0; col < moduleCount - 1; col += 1) {
      var count = 0;
      if (qrcode.isDark(row, col) ) count += 1;
      if (qrcode.isDark(row + 1, col) ) count += 1;
      if (qrcode.isDark(row, col + 1) ) count += 1;
      if (qrcode.isDark(row + 1, col + 1) ) count += 1;
      if (count == 0 || count == 4) {
        lostPoint += 3;
      }
    }
  }

  // LEVEL3

  for (var row = 0; row < moduleCount; row += 1) {
    for (var col = 0; col < moduleCount - 6; col += 1) {
      if (qrcode.isDark(row, col)
          && !qrcode.isDark(row, col + 1)
          &&  qrcode.isDark(row, col + 2)
          &&  qrcode.isDark(row, col + 3)
          &&  qrcode.isDark(row, col + 4)
          && !qrcode.isDark(row, col + 5)
          &&  qrcode.isDark(row, col + 6) ) {
        lostPoint += 40;
      }
    }
  }

  for (var col = 0; col < moduleCount; col += 1) {
    for (var row = 0; row < moduleCount - 6; row += 1) {
      if (qrcode.isDark(row, col)
          && !qrcode.isDark(row + 1, col)
          &&  qrcode.isDark(row + 2, col)
          &&  qrcode.isDark(row + 3, col)
          &&  qrcode.isDark(row + 4, col)
          && !qrcode.isDark(row + 5, col)
          &&  qrcode.isDark(row + 6, col) ) {
        lostPoint += 40;
      }
    }
  }

  // LEVEL4

  var darkCount = 0;

  for (var col = 0; col < moduleCount; col += 1) {
    for (var row = 0; row < moduleCount; row += 1) {
      if (qrcode.isDark(row, col) ) {
        darkCount += 1;
      }
    }
  }

  var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
  lostPoint += ratio * 10;

  return lostPoint;
};

/**
 * 
 * @param {boolean} test 
 * @param {number} maskPattern 
 * @param {QrCode} qrcode 
 */
function setupTypeInfo(test, maskPattern, qrcode) {
  const {errorCorrectionLevel, modules, moduleCount} = qrcode
  
  var data = (errorCorrectionLevel << 3) | maskPattern;
  var bits = QRUtil.getBCHTypeInfo(data);

  // vertical
  for (var i = 0; i < 15; i += 1) {

    var mod = (!test && ( (bits >> i) & 1) == 1);

    if (i < 6) {
      modules[i][8] = mod;
    } else if (i < 8) {
      modules[i + 1][8] = mod;
    } else {
      modules[moduleCount - 15 + i][8] = mod;
    }
  }

  // horizontal
  for (var i = 0; i < 15; i += 1) {

    var mod = (!test && ( (bits >> i) & 1) == 1);

    if (i < 8) {
      modules[8][moduleCount - i - 1] = mod;
    } else if (i < 9) {
      modules[8][15 - i - 1 + 1] = mod;
    } else {
      modules[8][15 - i - 1] = mod;
    }
  }

  // fixed module
  modules[moduleCount - 8][8] = (!test);
};


  