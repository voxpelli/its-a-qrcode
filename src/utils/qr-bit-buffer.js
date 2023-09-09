
export class QrBitBuffer {
  /** @type {number[]} */
  #byteBuffer = []
  #bitLength = 0;


  /**
   * 
   * @param {number} num 
   * @param {number} length 
   */
  put(num, length) {
    const byteBuffer = this.#byteBuffer
    const bitLength = this.#bitLength
    const newBitLength = bitLength + length
    const newBufferLenght = (newBitLength + 7) >> 3

    let restBits = Math.min((byteBuffer.length << 3) - bitLength, length)
    let bufIndex = bitLength >> 3
    while (byteBuffer.length < newBufferLenght) {
      byteBuffer.push(0);
    }
    let i = 0
    if(restBits == 0){
      restBits = Math.min(8, length)
    }
    while (i < length){
      byteBuffer[bufIndex] |=  (num << (8 - restBits) >>> (length - i - restBits) ) & (0xff);
      i += restBits
      bufIndex++
      restBits = Math.min(8, length - i)
    }
    this.#bitLength=newBitLength

  };

  get byteBuffer(){
    return this.#byteBuffer.slice()
  }

  get bitLength(){
    return this.#bitLength
  }

  /**
   * Get bit value at index, value is either 0 or 1
   * @param {number} index 
   */
  getBitAt(index){
    const bufIndex = index >> 3;
    return (this.#byteBuffer[bufIndex] >>> (7 - index & 0b111) ) & 1;
  }

  /**
   * 
   * @param {0|1|boolean} bit 
   */
  putBit(bit){
    const byteBuffer = this.#byteBuffer
    const bitLength = this.#bitLength
    const bufIndex = bitLength >> 3
    if (byteBuffer.length <= bufIndex) {
      byteBuffer.push(0);
    }

    if (bit) {
      byteBuffer[bufIndex] |= (0x80 >>> (bitLength & 0b111) );
    }
    this.#bitLength+=1
  }


}
